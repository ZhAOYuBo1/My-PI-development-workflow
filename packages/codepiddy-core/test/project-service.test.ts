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
			"禁止修改生产代码",
		);
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
	test("removes legacy seeded input documents because producer agents start from runtime context", async () => {
		const projectRoot = await createTemporaryProject();
		await createWorkItem({
			projectRoot,
			lane: "requirements",
			title: "增加登录功能",
			description: "支持账号密码登录",
		});
		const requirementPath = path.join(projectRoot, ".codepiddy", "requirements", "FEAT-001", "requirement.md");
		await writeFile(requirementPath, "# 增加登录功能\n\n支持账号密码登录\n", "utf8");

		await openProject(projectRoot);

		await expect(readFile(requirementPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
	});

	test("removes obsolete empty workflow placeholders when reopening a project", async () => {
		const projectRoot = await createTemporaryProject();
		await createWorkItem({
			projectRoot,
			lane: "requirements",
			title: "增加登录功能",
			description: "支持账号密码登录",
		});
		const designPath = path.join(projectRoot, ".codepiddy", "requirements", "FEAT-001", "design.md");
		await writeFile(designPath, "", "utf8");

		await openProject(projectRoot);

		await expect(readFile(designPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
	});

	test("requires user approval and handoff artifacts before downstream agents", async () => {
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
		expect(workItem.agentSlots.find((slot) => slot.role === "review")?.blockedReason).toContain("implementation.md");

		await expect(approveRequirement({ projectRoot, workItemId: workItem.id })).rejects.toThrow(
			/requirement\.md.*design\.md.*tasks\.md/,
		);
		await Promise.all([
			writeFile(path.join(workItem.directoryPath, "requirement.md"), "# 需求\n\n支持登录。\n", "utf8"),
			writeFile(path.join(workItem.directoryPath, "design.md"), "# 设计\n\n登录服务设计。\n", "utf8"),
			writeFile(path.join(workItem.directoryPath, "tasks.md"), "# 任务\n\n实现登录。\n", "utf8"),
		]);
		await expect(approveRequirement({ projectRoot, workItemId: workItem.id })).rejects.toThrow(
			/缺少章节.*目标.*功能需求.*验收条件/,
		);
		await Promise.all([
			writeFile(
				path.join(workItem.directoryPath, "requirement.md"),
				"# 登录需求\n\n## 目标\n\n支持用户安全登录系统。\n\n## 功能需求\n\n用户可以使用账号和密码登录，并收到明确错误提示。\n\n## 验收条件\n\n正确凭据登录成功，错误凭据不会创建会话。\n",
				"utf8",
			),
			writeFile(
				path.join(workItem.directoryPath, "design.md"),
				"# 登录设计\n\n## 设计方案\n\n增加认证服务并复用现有用户仓储。\n\n## 影响范围\n\n影响认证入口、会话创建和错误处理。\n\n## 验证策略\n\n覆盖成功、错误密码、未知用户和会话持久化测试。\n",
				"utf8",
			),
			writeFile(
				path.join(workItem.directoryPath, "tasks.md"),
				"# 实施任务\n\n## 任务拆解\n\n- [ ] 增加认证服务。\n- [ ] 接入登录入口。\n- [ ] 补充成功和失败测试。\n",
				"utf8",
			),
		]);
		project = await approveRequirement({ projectRoot, workItemId: workItem.id });
		const approved = project.lanes[0]?.workItems[0];
		expect(approved?.requirementApprovedAt).toBeDefined();
		expect(approved?.agentSlots.find((slot) => slot.role === "coding")?.blockedReason).toBeUndefined();
		expect(approved?.agentSlots.find((slot) => slot.role === "review")?.blockedReason).toContain("implementation.md");

		await writeFile(path.join(workItem.directoryPath, "implementation.md"), "# 实现\n\n已完成。\n", "utf8");
		project = await openProject(projectRoot);
		expect(
			project.lanes[0]?.workItems[0]?.agentSlots.find((slot) => slot.role === "review")?.blockedReason,
		).toContain("缺少章节");

		await writeFile(
			path.join(workItem.directoryPath, "implementation.md"),
			"# 实现交接\n\n## 实现摘要\n\n实现账号密码登录和会话创建。\n\n## 修改文件\n\n- src/auth/login.ts：增加 login 函数。\n\n## 测试结果\n\n执行 npm test，登录测试全部通过。\n\n## 审查重点\n\n重点检查错误信息和会话创建边界。\n",
			"utf8",
		);
		project = await openProject(projectRoot);
		expect(
			project.lanes[0]?.workItems[0]?.agentSlots.find((slot) => slot.role === "review")?.blockedReason,
		).toBeUndefined();
	});

	test("renames and permanently deletes a work item", async () => {
		const projectRoot = await createTemporaryProject();
		let project = await createWorkItem({
			projectRoot,
			lane: "bugs",
			title: "旧标题",
			description: "复现步骤",
		});
		const bugDirectory = path.join(projectRoot, ".codepiddy", "bugs", "BUG-001");
		await expect(readFile(path.join(bugDirectory, "fix.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
		await expect(readFile(path.join(bugDirectory, "review.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
		await expect(readFile(path.join(bugDirectory, "bug.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
		await writeFile(path.join(bugDirectory, "fix.md"), "# 修复\n\n已修复。\n", "utf8");
		project = await openProject(projectRoot);
		expect(
			project.lanes[1]?.workItems[0]?.agentSlots.find((slot) => slot.role === "review")?.blockedReason,
		).toContain("缺少章节");
		await writeFile(
			path.join(bugDirectory, "fix.md"),
			"# 修复交接\n\n## 根因\n\n项目切换后缓存仍引用旧项目状态。\n\n## 修改文件\n\n- src/project/switch.ts：切换时重置缓存。\n\n## 验证结果\n\n执行回归测试，连续切换项目不再白屏。\n\n## 审查重点\n\n检查缓存释放和快速连续切换。\n",
			"utf8",
		);
		project = await openProject(projectRoot);
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
