import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { RecentProjectStore } from "../src/main/recent-project-store.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

async function createUserData(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), "codepiddy-desktop-store-"));
	temporaryDirectories.push(directory);
	return directory;
}

describe("recent project SQLite store", () => {
	test("migrates JSON, recovers agent projects, and persists across reopen", async () => {
		const userData = await createUserData();
		const projectA = path.join(userData, "project-a");
		const projectB = path.join(userData, "project-b");
		const projectC = path.join(userData, "project-c");
		await Promise.all([mkdir(projectA), mkdir(projectB), mkdir(projectC)]);
		await mkdir(path.join(userData, "settings"), { recursive: true });
		await writeFile(
			path.join(userData, "settings", "recent-projects.json"),
			JSON.stringify([
				{ id: "a", name: "A", rootPath: projectA, lastOpenedAt: "2026-09-15T00:00:00.000Z" },
				{ id: "b", name: "B", rootPath: projectB, lastOpenedAt: "2026-09-16T00:00:00.000Z" },
			]),
		);
		await writeFile(
			path.join(userData, "settings", "project-state.json"),
			JSON.stringify({ activeProjectRoot: projectB }),
		);
		const agentDirectory = path.join(userData, "projects", "c", "work-items", "BUG-001", "agents", "bug-fix");
		await mkdir(agentDirectory, { recursive: true });
		await writeFile(
			path.join(agentDirectory, "agent.json"),
			JSON.stringify({ projectId: "c", projectRoot: projectC, createdAt: "2026-09-14T00:00:00.000Z" }),
		);

		let store = new RecentProjectStore(userData, { discoverKnownRoots: false });
		try {
			expect(await store.list()).toHaveLength(3);
			expect(await store.getActiveProjectRoot()).toBe(projectB);
			await store.record({
				id: "a",
				name: "A renamed",
				rootPath: projectA,
				codepiddyPath: path.join(projectA, ".codepiddy"),
				lanes: [],
			});
		} finally {
			store.close();
		}

		store = new RecentProjectStore(userData, { discoverKnownRoots: false });
		try {
			expect((await store.list())[0]?.name).toBe("A renamed");
			expect(await store.getActiveProjectRoot()).toBe(projectA);
			await store.saveProjectUiState({
				projectRoot: projectA,
				selectionType: "agent",
				lane: "requirements",
				workItemId: "FEAT-001",
				role: "coding",
				expandedKeys: ["lane:requirements", "work-item:FEAT-001"],
			});
			await store.saveAgentUiState({
				agentInstanceId: "agent-1",
				draft: "unfinished",
				scrollTop: 420,
				unreadCount: 2,
			});
			store.saveWindowState({ x: 100, y: 120, width: 1280, height: 800, maximized: true });
			expect((await store.getProjectUiState(projectA))?.workItemId).toBe("FEAT-001");
			expect(await store.getAgentUiState("agent-1")).toMatchObject({ draft: "unfinished", scrollTop: 420 });
			expect(store.getWindowState()).toEqual({ x: 100, y: 120, width: 1280, height: 800, maximized: true });
		} finally {
			store.close();
		}
	});
});
