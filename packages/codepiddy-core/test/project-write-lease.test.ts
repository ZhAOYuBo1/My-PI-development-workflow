import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ProjectWriteLeaseConflictError, ProjectWriteLeaseManager } from "../src/index.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

async function createManager(): Promise<ProjectWriteLeaseManager> {
	const directory = await mkdtemp(path.join(os.tmpdir(), "codepiddy-lease-"));
	temporaryDirectories.push(directory);
	return new ProjectWriteLeaseManager(directory);
}

describe("project write lease", () => {
	test("allows the same agent to refresh its lease", async () => {
		const manager = await createManager();
		const first = await manager.acquire({
			projectId: "project",
			agentInstanceId: "agent-a",
			workItemId: "FEAT-001",
			role: "coding",
		});
		await expect(manager.inspect("project")).resolves.toMatchObject({
			stale: false,
			lease: { ownerProcessId: process.pid },
		});
		const second = await manager.acquire({
			projectId: "project",
			agentInstanceId: "agent-a",
			workItemId: "FEAT-001",
			role: "coding",
		});
		expect(second.holderAgentInstanceId).toBe(first.holderAgentInstanceId);
	});

	test("detects and audits cleanup of a stale owner process", async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), "codepiddy-lease-"));
		temporaryDirectories.push(directory);
		const manager = new ProjectWriteLeaseManager(directory);
		const leaseDirectory = path.join(directory, "projects", "project");
		await mkdir(leaseDirectory, { recursive: true });
		await writeFile(
			path.join(leaseDirectory, "write-lease.json"),
			`${JSON.stringify({
				projectId: "project",
				holderAgentInstanceId: "agent-old",
				workItemId: "BUG-001",
				role: "bug-fix",
				acquiredAt: new Date(0).toISOString(),
				heartbeatAt: new Date(0).toISOString(),
				ownerProcessId: 999_999,
			})}\n`,
			"utf8",
		);

		await expect(manager.inspect("project")).resolves.toMatchObject({ stale: true });
		await manager.clearStale("project");
		await expect(manager.read("project")).resolves.toBeNull();
		expect(await readFile(path.join(directory, "audit", "write-lease-cleanup.jsonl"), "utf8")).toContain("agent-old");
	});

	test("blocks a second writer until the first releases", async () => {
		const manager = await createManager();
		await manager.acquire({
			projectId: "project",
			agentInstanceId: "agent-a",
			workItemId: "FEAT-001",
			role: "coding",
		});
		await expect(
			manager.acquire({ projectId: "project", agentInstanceId: "agent-b", workItemId: "BUG-001", role: "bug-fix" }),
		).rejects.toBeInstanceOf(ProjectWriteLeaseConflictError);
		await manager.release("project", "agent-a");
		await expect(
			manager.acquire({ projectId: "project", agentInstanceId: "agent-b", workItemId: "BUG-001", role: "bug-fix" }),
		).resolves.toMatchObject({ holderAgentInstanceId: "agent-b" });
	});
});
