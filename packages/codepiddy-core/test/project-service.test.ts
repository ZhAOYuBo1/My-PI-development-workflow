import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
	AgentRegistry,
	approveRequirement,
	archiveWorkItem,
	createWorkItem,
	deleteWorkItem,
	openProject,
	renameWorkItem,
	restoreWorkItem,
} from "../src/index.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

async function createTemporaryProject(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), "codepiddy-core-"));
	temporaryDirectories.push(directory);
	return directory;
}

describe("project service", () => {
	test("initializes the two fixed lanes", async () => {
		const projectRoot = await createTemporaryProject();
		const project = await openProject(projectRoot);
		expect(project.lanes.map((lane) => lane.kind)).toEqual(["requirements", "bugs"]);
		expect(
			await readFile(path.join(projectRoot, ".codepiddy", "agents", "requirement-analysis.md"), "utf8"),
		).toContain("Grill");
		expect(await readFile(path.join(projectRoot, ".codepiddy", "agents", "review.md"), "utf8")).toContain(
			"不修改生产代码",
		);
		await expect(readdir(path.join(projectRoot, ".codepiddy", ".pi", "skills"))).resolves.toEqual([]);
		const permissions = JSON.parse(
			await readFile(path.join(projectRoot, ".codepiddy", "permissions.jsonc"), "utf8"),
		) as { tools: Record<string, string> };
		expect(permissions.tools).toMatchObject({ read: "allow", grep: "allow", write: "allow", edit: "allow" });
	});

	test("creates and archives an isolated feature work item", async () => {
		const projectRoot = await createTemporaryProject();
		let project = await createWorkItem({
			projectRoot,
			lane: "requirements",
			title: "增加登录功能",
			description: "支持账号密码登录",
		});
		const feature = project.lanes[0]?.workItems[0];
		expect(feature?.id).toBe("FEAT-001");
		expect(feature?.agentSlots.map((slot) => slot.role)).toEqual(["requirement-analysis", "coding", "review"]);
		expect(
			await readFile(path.join(projectRoot, ".codepiddy", "requirements", "FEAT-001", "work-item.md"), "utf8"),
		).toContain("支持账号密码登录");
		for (const documentName of ["requirement.md", "design.md", "tasks.md", "implementation.md", "review.md"]) {
			await expect(
				readFile(path.join(projectRoot, ".codepiddy", "requirements", "FEAT-001", documentName), "utf8"),
			).rejects.toMatchObject({ code: "ENOENT" });
		}

		project = await archiveWorkItem({ projectRoot, lane: "requirements", workItemId: "FEAT-001" });
		expect(project.lanes[0]?.workItems[0]?.status).toBe("archived");

		project = await restoreWorkItem({ projectRoot, lane: "requirements", workItemId: "FEAT-001" });
		expect(project.lanes[0]?.workItems[0]?.status).toBe("active");
	});
	test("preserves documents produced by enabled skills without imposing filenames", async () => {
		const projectRoot = await createTemporaryProject();
		await createWorkItem({
			projectRoot,
			lane: "requirements",
			title: "增加登录功能",
			description: "支持账号密码登录",
		});
		const artifactPath = path.join(projectRoot, ".codepiddy", "requirements", "FEAT-001", "grill-notes.md");
		await writeFile(artifactPath, "# 澄清记录\n\n由 Grill 与 OpenSpec 工作流维护。\n", "utf8");

		await openProject(projectRoot);

		await expect(readFile(artifactPath, "utf8")).resolves.toContain("OpenSpec");
	});

	test("uses user approval without validating fixed handoff filenames", async () => {
		const projectRoot = await createTemporaryProject();
		let project = await createWorkItem({
			projectRoot,
			lane: "requirements",
			title: "增加登录功能",
			description: "支持账号密码登录",
		});
		const workItem = project.lanes[0]?.workItems[0];
		if (!workItem) throw new Error("Expected feature work item");
		expect(workItem.agentSlots.find((slot) => slot.role === "coding")?.blockedReason).toContain("尚未由用户批准");
		expect(workItem.agentSlots.find((slot) => slot.role === "review")?.blockedReason).toBeUndefined();

		project = await approveRequirement({ projectRoot, workItemId: workItem.id });
		const approved = project.lanes[0]?.workItems[0];
		expect(approved?.requirementApprovedAt).toBeDefined();
		expect(approved?.agentSlots.find((slot) => slot.role === "coding")?.blockedReason).toBeUndefined();
		expect(approved?.agentSlots.find((slot) => slot.role === "review")?.blockedReason).toBeUndefined();
	});

	test("renames and permanently deletes a work item", async () => {
		const projectRoot = await createTemporaryProject();
		let project = await createWorkItem({
			projectRoot,
			lane: "bugs",
			title: "旧标题",
			description: "复现步骤",
		});
		expect(
			project.lanes[1]?.workItems[0]?.agentSlots.find((slot) => slot.role === "review")?.blockedReason,
		).toBeUndefined();

		project = await renameWorkItem({
			projectRoot,
			lane: "bugs",
			workItemId: "BUG-001",
			title: "新标题",
		});
		expect(project.lanes[1]?.workItems[0]?.title).toBe("新标题");

		project = await deleteWorkItem({ projectRoot, lane: "bugs", workItemId: "BUG-001" });
		expect(project.lanes[1]?.workItems).toEqual([]);
		await expect(
			readFile(path.join(projectRoot, ".codepiddy", "bugs", "BUG-001", "work-item.json"), "utf8"),
		).rejects.toMatchObject({ code: "ENOENT" });
	});

	test("creates one persistent agent instance per slot", async () => {
		const projectRoot = await createTemporaryProject();
		let project = await createWorkItem({
			projectRoot,
			lane: "requirements",
			title: "增加登录功能",
			description: "支持账号密码登录",
		});
		const workItem = project.lanes[0]?.workItems[0];
		if (!workItem) throw new Error("Expected work item");
		const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "codepiddy-runtime-"));
		temporaryDirectories.push(runtimeRoot);
		const registry = new AgentRegistry(runtimeRoot);
		const createInput = {
			projectRoot,
			projectId: project.id,
			workItemId: workItem.id,
			workItemDirectory: workItem.directoryPath,
			lane: "requirements" as const,
			role: "coding" as const,
		};
		const first = await registry.create(createInput);
		const second = await registry.create(createInput);
		expect(second.id).toBe(first.id);
		await Promise.all(
			Array.from({ length: 20 }, (_, index) => registry.setStatus(first, index % 2 === 0 ? "running" : "idle")),
		);
		expect((await registry.get(project.id, workItem.id, "coding"))?.id).toBe(first.id);
		project = await registry.decorateProject(project);
		expect(project.lanes[0]?.workItems[0]?.agentSlots.find((slot) => slot.role === "coding")?.currentInstanceId).toBe(
			first.id,
		);
		const reset = await registry.reset({ ...createInput, agentInstanceId: first.id });
		expect(reset.id).not.toBe(first.id);
		expect((await registry.get(project.id, workItem.id, "coding"))?.id).toBe(reset.id);
		const archiveDirectory = path.join(
			runtimeRoot,
			"projects",
			project.id,
			"work-items",
			workItem.id,
			"agent-archive",
		);
		expect((await readdir(archiveDirectory)).some((entry) => entry.endsWith(first.id))).toBe(true);

		await registry.deleteWorkItem(project.id, workItem.id);
		await expect(registry.get(project.id, workItem.id, "coding")).resolves.toBeNull();
	});
});
