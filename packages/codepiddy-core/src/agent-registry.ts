import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
	AgentInstanceSummary,
	AgentRole,
	CreateAgentInput,
	LaneKind,
	ProjectSummary,
	ResetAgentInput,
} from "@codepiddy/shared";

interface StoredAgentInstance extends AgentInstanceSummary {
	projectRoot: string;
	workItemDirectory: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== "string") throw new Error(`Invalid ${field}`);
	return value;
}

function parseLane(value: unknown): LaneKind {
	if (value === "requirements" || value === "bugs") return value;
	throw new Error("Invalid lane");
}

function parseRole(value: unknown): AgentRole {
	if (value === "requirement-analysis" || value === "coding" || value === "bug-fix" || value === "review") {
		return value;
	}
	throw new Error("Invalid agent role");
}

function parseAgent(value: unknown): StoredAgentInstance {
	if (!isObject(value)) throw new Error("Invalid agent metadata");
	const status = value.status;
	if (
		status !== "idle" &&
		status !== "running" &&
		status !== "waiting" &&
		status !== "completed" &&
		status !== "failed"
	) {
		throw new Error("Invalid agent status");
	}
	return {
		id: requireString(value.id, "id"),
		projectId: requireString(value.projectId, "projectId"),
		projectRoot: requireString(value.projectRoot, "projectRoot"),
		workItemId: requireString(value.workItemId, "workItemId"),
		workItemDirectory: requireString(value.workItemDirectory, "workItemDirectory"),
		lane: parseLane(value.lane),
		role: parseRole(value.role),
		status,
		sessionDirectory: requireString(value.sessionDirectory, "sessionDirectory"),
		createdAt: requireString(value.createdAt, "createdAt"),
	};
}

function roleDirectoryName(role: AgentRole): string {
	return role;
}

export class AgentRegistry {
	private readonly runtimeRoot: string;
	private writeChain: Promise<void> = Promise.resolve();

	constructor(runtimeRoot: string) {
		this.runtimeRoot = runtimeRoot;
	}

	private agentDirectory(projectId: string, workItemId: string, role: AgentRole): string {
		return path.join(
			this.runtimeRoot,
			"projects",
			projectId,
			"work-items",
			workItemId,
			"agents",
			roleDirectoryName(role),
		);
	}

	private metadataPath(projectId: string, workItemId: string, role: AgentRole): string {
		return path.join(this.agentDirectory(projectId, workItemId, role), "agent.json");
	}

	private writeAgent(agent: StoredAgentInstance): Promise<void> {
		const operation = this.writeChain.then(async () => {
			const filePath = this.metadataPath(agent.projectId, agent.workItemId, agent.role);
			const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
			try {
				await writeFile(temporaryPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");
				await rm(filePath, { force: true });
				await rename(temporaryPath, filePath);
			} finally {
				await rm(temporaryPath, { force: true });
			}
		});
		this.writeChain = operation.catch(() => undefined);
		return operation;
	}

	async get(projectId: string, workItemId: string, role: AgentRole): Promise<StoredAgentInstance | null> {
		await this.writeChain;
		try {
			return parseAgent(
				JSON.parse(await readFile(this.metadataPath(projectId, workItemId, role), "utf8")) as unknown,
			);
		} catch (error) {
			if (isObject(error) && error.code === "ENOENT") return null;
			throw error;
		}
	}

	async create(input: CreateAgentInput): Promise<StoredAgentInstance> {
		const existing = await this.get(input.projectId, input.workItemId, input.role);
		if (existing) return existing;
		const agentDirectory = this.agentDirectory(input.projectId, input.workItemId, input.role);
		const sessionDirectory = path.join(agentDirectory, "sessions");
		await mkdir(sessionDirectory, { recursive: true });
		const agent: StoredAgentInstance = {
			id: randomUUID(),
			projectId: input.projectId,
			projectRoot: path.resolve(input.projectRoot),
			workItemId: input.workItemId,
			workItemDirectory: path.resolve(input.workItemDirectory),
			lane: input.lane,
			role: input.role,
			status: "idle",
			sessionDirectory,
			createdAt: new Date().toISOString(),
		};
		await this.writeAgent(agent);
		return agent;
	}

	async reset(input: ResetAgentInput): Promise<StoredAgentInstance> {
		const existing = await this.get(input.projectId, input.workItemId, input.role);
		if (!existing || existing.id !== input.agentInstanceId) throw new Error("Agent instance not found");
		const currentDirectory = this.agentDirectory(input.projectId, input.workItemId, input.role);
		const archiveDirectory = path.join(
			this.runtimeRoot,
			"projects",
			input.projectId,
			"work-items",
			input.workItemId,
			"agent-archive",
			`${input.role}-${new Date().toISOString().replace(/[:.]/g, "-")}-${existing.id}`,
		);
		await mkdir(path.dirname(archiveDirectory), { recursive: true });
		await rename(currentDirectory, archiveDirectory);
		return this.create(input);
	}

	async deleteWorkItem(projectId: string, workItemId: string): Promise<void> {
		await rm(path.join(this.runtimeRoot, "projects", projectId, "work-items", workItemId), {
			recursive: true,
			force: true,
		});
	}

	async setStatus(agent: StoredAgentInstance, status: StoredAgentInstance["status"]): Promise<StoredAgentInstance> {
		const next = { ...agent, status };
		await this.writeAgent(next);
		return next;
	}

	async listAgentLocations(agentInstanceId: string): Promise<Array<{ projectId: string }>> {
		const projectsDirectory = path.join(this.runtimeRoot, "projects");
		try {
			const projects = await readdir(projectsDirectory, { withFileTypes: true });
			const matches: Array<{ projectId: string }> = [];
			for (const project of projects) {
				if (!project.isDirectory()) continue;
				const workItemsDirectory = path.join(projectsDirectory, project.name, "work-items");
				try {
					const workItems = await readdir(workItemsDirectory, { withFileTypes: true });
					for (const workItem of workItems) {
						if (!workItem.isDirectory()) continue;
						for (const role of ["requirement-analysis", "coding", "bug-fix", "review"] as const) {
							const agent = await this.get(project.name, workItem.name, role);
							if (agent?.id === agentInstanceId) matches.push({ projectId: project.name });
						}
					}
				} catch {}
			}
			return matches;
		} catch {
			return [];
		}
	}

	async decorateProject(project: ProjectSummary): Promise<ProjectSummary> {
		return {
			...project,
			lanes: await Promise.all(
				project.lanes.map(async (lane) => ({
					...lane,
					workItems: await Promise.all(
						lane.workItems.map(async (item) => ({
							...item,
							agentSlots: await Promise.all(
								item.agentSlots.map(async (slot) => {
									const agent = await this.get(project.id, item.id, slot.role);
									return agent ? { ...slot, status: agent.status, currentInstanceId: agent.id } : slot;
								}),
							),
						})),
					),
				})),
			),
		};
	}
}

export type { StoredAgentInstance };
