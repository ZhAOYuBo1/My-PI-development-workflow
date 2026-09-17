import { appendFile, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentRole } from "@codepiddy/shared";

export interface ProjectWriteLease {
	projectId: string;
	holderAgentInstanceId: string;
	workItemId: string;
	role: AgentRole;
	acquiredAt: string;
	heartbeatAt: string;
	ownerProcessId?: number;
}

export class ProjectWriteLeaseConflictError extends Error {
	readonly lease: ProjectWriteLease;

	constructor(lease: ProjectWriteLease) {
		super(`项目正在被 ${lease.workItemId} / ${lease.role} Agent 修改`);
		this.name = "ProjectWriteLeaseConflictError";
		this.lease = lease;
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== "string") throw new Error(`Invalid write lease ${field}`);
	return value;
}

function parseRole(value: unknown): AgentRole {
	if (value === "requirement-analysis" || value === "coding" || value === "bug-fix" || value === "review") {
		return value;
	}
	throw new Error("Invalid write lease role");
}

function parseLease(value: unknown): ProjectWriteLease {
	if (!isObject(value)) throw new Error("Invalid project write lease");
	const ownerProcessId = value.ownerProcessId;
	if (ownerProcessId !== undefined && (typeof ownerProcessId !== "number" || !Number.isInteger(ownerProcessId))) {
		throw new Error("Invalid write lease ownerProcessId");
	}
	return {
		projectId: requireString(value.projectId, "projectId"),
		holderAgentInstanceId: requireString(value.holderAgentInstanceId, "holderAgentInstanceId"),
		workItemId: requireString(value.workItemId, "workItemId"),
		role: parseRole(value.role),
		acquiredAt: requireString(value.acquiredAt, "acquiredAt"),
		heartbeatAt: requireString(value.heartbeatAt, "heartbeatAt"),
		...(ownerProcessId === undefined ? {} : { ownerProcessId }),
	};
}

export class ProjectWriteLeaseManager {
	private readonly runtimeRoot: string;

	constructor(runtimeRoot: string) {
		this.runtimeRoot = runtimeRoot;
	}

	private leasePath(projectId: string): string {
		return path.join(this.runtimeRoot, "projects", projectId, "write-lease.json");
	}

	async read(projectId: string): Promise<ProjectWriteLease | null> {
		try {
			return parseLease(JSON.parse(await readFile(this.leasePath(projectId), "utf8")) as unknown);
		} catch (error) {
			if (isObject(error) && error.code === "ENOENT") return null;
			throw error;
		}
	}

	private isOwnerProcessAlive(processId: number): boolean {
		try {
			process.kill(processId, 0);
			return true;
		} catch (error) {
			return isObject(error) && error.code === "EPERM";
		}
	}

	async inspect(projectId: string): Promise<{ lease: ProjectWriteLease | null; stale: boolean }> {
		const lease = await this.read(projectId);
		if (!lease) return { lease: null, stale: false };
		const stale =
			lease.ownerProcessId === undefined
				? Date.now() - Date.parse(lease.heartbeatAt) > 120_000
				: !this.isOwnerProcessAlive(lease.ownerProcessId);
		return { lease, stale };
	}

	async clearStale(projectId: string): Promise<void> {
		const status = await this.inspect(projectId);
		if (!status.lease) return;
		if (!status.stale) throw new Error("写锁持有进程仍在运行，不能清理");
		try {
			await unlink(this.leasePath(projectId));
		} catch (error) {
			if (!isObject(error) || error.code !== "ENOENT") throw error;
		}
		const auditPath = path.join(this.runtimeRoot, "audit", "write-lease-cleanup.jsonl");
		await mkdir(path.dirname(auditPath), { recursive: true });
		await appendFile(
			auditPath,
			`${JSON.stringify({ clearedAt: new Date().toISOString(), lease: status.lease })}\n`,
			"utf8",
		);
	}

	async acquire(input: {
		projectId: string;
		agentInstanceId: string;
		workItemId: string;
		role: AgentRole;
	}): Promise<ProjectWriteLease> {
		const filePath = this.leasePath(input.projectId);
		await mkdir(path.dirname(filePath), { recursive: true });
		const now = new Date().toISOString();
		const lease: ProjectWriteLease = {
			projectId: input.projectId,
			holderAgentInstanceId: input.agentInstanceId,
			workItemId: input.workItemId,
			role: input.role,
			acquiredAt: now,
			heartbeatAt: now,
			ownerProcessId: process.pid,
		};
		try {
			const handle = await open(filePath, "wx");
			try {
				await handle.writeFile(`${JSON.stringify(lease, null, 2)}\n`, "utf8");
			} finally {
				await handle.close();
			}
			return lease;
		} catch (error) {
			if (!isObject(error) || error.code !== "EEXIST") throw error;
			const current = await this.read(input.projectId);
			if (!current) return this.acquire(input);
			if (current.holderAgentInstanceId !== input.agentInstanceId) throw new ProjectWriteLeaseConflictError(current);
			const refreshed = { ...current, heartbeatAt: now };
			await writeFile(filePath, `${JSON.stringify(refreshed, null, 2)}\n`, "utf8");
			return refreshed;
		}
	}

	async heartbeat(projectId: string, agentInstanceId: string): Promise<void> {
		const lease = await this.read(projectId);
		if (!lease || lease.holderAgentInstanceId !== agentInstanceId) return;
		const refreshed = { ...lease, heartbeatAt: new Date().toISOString() };
		await writeFile(this.leasePath(projectId), `${JSON.stringify(refreshed, null, 2)}\n`, "utf8");
	}

	async release(projectId: string, agentInstanceId: string): Promise<void> {
		const lease = await this.read(projectId);
		if (!lease || lease.holderAgentInstanceId !== agentInstanceId) return;
		try {
			await unlink(this.leasePath(projectId));
		} catch (error) {
			if (!isObject(error) || error.code !== "ENOENT") throw error;
		}
	}
}
