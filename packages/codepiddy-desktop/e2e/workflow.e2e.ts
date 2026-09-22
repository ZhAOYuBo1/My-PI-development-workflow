import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createFeatureWorkItem, launchCodePIddy, openRequirementAgent, type CodePIddyE2EApp } from "./helpers/app.ts";

let client: CodePIddyE2EApp;

test.beforeEach(async () => {
	client = await launchCodePIddy();
});

test.afterEach(async () => {
	await client.close();
});

test("creates a work item, runs an agent, and changes model with the keyboard", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await page.locator(".work-item-row").filter({ hasText: "FEAT-001" }).locator(".tree-label").click();
	await expect(page.locator(".agent-choice-list .agent-glyph")).toHaveCount(0);
	await openRequirementAgent(page);
	await page.getByRole("button", { name: "Agent 操作" }).click();
	const actionsMenu = page.getByRole("menu", { name: "Agent 操作" });
	await expect(actionsMenu).toBeVisible();
	const headerBox = await page.locator(".content-header").boundingBox();
	const menuBox = await actionsMenu.boundingBox();
	const transcriptBox = await page.locator(".transcript").boundingBox();
	expect(headerBox).not.toBeNull();
	expect(menuBox).not.toBeNull();
	expect(transcriptBox).not.toBeNull();
	expect(menuBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height + 6);
	expect(menuBox!.y).toBeLessThan(transcriptBox!.y + transcriptBox!.height);
	expect(await actionsMenu.evaluate((element) => getComputedStyle(element).zIndex)).toBe("40");
	await page.getByRole("button", { name: "Agent 操作" }).click();

	const composer = page.locator(".composer textarea");
	await composer.fill("hello from e2e");
	await composer.press("Enter");
	await expect(page.getByText("Fake Pi 已完成当前请求。")).toBeVisible();

	const modelButton = page.locator(".model-seat");
	await expect(modelButton).toContainText("Model One");
	await modelButton.click();
	await expect(page.getByRole("dialog", { name: "选择模型" })).toBeVisible();
	await expect(page.getByPlaceholder("搜索模型")).toBeFocused();
	await expect(page.getByRole("button", { name: /Model Two/ })).toBeEnabled();
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Enter");
	await expect(modelButton).toContainText("Model Two");
});

test("requires an explicit work item approval to unlock Coding", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await openRequirementAgent(page);
	const codingRow = page.locator(".agent-row").filter({ hasText: "Coding Agent" });
	if (!(await codingRow.isVisible())) {
		await page.locator(".work-item-row").filter({ hasText: "FEAT-001" }).locator(".chevron-button").click();
	}
	await expect(codingRow).toContainText("等待");
	await expect(page.getByText("对 Agent 说“批准”只是聊天消息。")).toBeVisible();

	const composer = page.locator(".composer textarea");
	await composer.fill("我批准这个需求");
	await composer.press("Enter");
	await expect(page.locator(".message-assistant").last()).toContainText("Fake Pi 已完成当前请求。");
	await expect(codingRow).toContainText("等待");

	await page.getByRole("button", { name: "批准需求并解锁 Coding" }).click();
	await expect(codingRow).toContainText("创建");
	await codingRow.click();
	await expect(page.getByRole("button", { name: "创建 Agent" })).toBeEnabled();
});

test("shows context usage beside the model and jumps through the transcript minimap", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await openRequirementAgent(page);
	await expect(page.locator(".agent-row .agent-glyph")).toHaveCount(0);
	await expect(page.locator(".agent-pane .empty-mark.small")).toHaveCount(0);
	await expect(page.locator(".content-header .context-gauge")).toHaveCount(0);
	const contextGauge = page.locator(".composer .context-gauge");
	await expect(contextGauge).toBeVisible();
	await expect(contextGauge.locator(".context-gauge-ring")).toHaveCount(1);
	await expect(contextGauge.locator("circle, svg")).toHaveCount(0);
	expect(await contextGauge.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
	await contextGauge.hover();
	await expect(page.getByRole("tooltip")).toContainText("1.2万 / 12.8万");

	const composer = page.locator(".composer textarea");
	const assistantReplies = page.locator(".message-assistant").filter({ hasText: "Fake Pi 已完成当前请求。" });
	for (let index = 0; index < 8; index++) {
		await composer.fill(`第 ${index + 1} 轮：请核对 OpenSpec proposal、design、specs 和 tasks 的一致性，并说明需要继续确认的边界。`);
		await composer.press("Enter");
		await expect(assistantReplies).toHaveCount(index + 1);
	}

	const minimap = page.getByRole("navigation", { name: "对话快速定位" });
	await expect(minimap).toBeVisible();
	await expect(minimap.locator("button")).toHaveCount(8);
	const minimapBox = await minimap.boundingBox();
	const firstTickBox = await minimap.locator("button").first().boundingBox();
	const lastTickBox = await minimap.locator("button").last().boundingBox();
	expect(minimapBox).not.toBeNull();
	expect(firstTickBox).not.toBeNull();
	expect(lastTickBox).not.toBeNull();
	const ticksCenter = (firstTickBox!.y + firstTickBox!.height / 2 + lastTickBox!.y + lastTickBox!.height / 2) / 2;
	const minimapCenter = minimapBox!.y + minimapBox!.height / 2;
	expect(Math.abs(ticksCenter - minimapCenter)).toBeLessThan(2);
	expect(Math.round(lastTickBox!.y - firstTickBox!.y)).toBe(140);
	await minimap.locator("button").first().hover();
	await expect(minimap.locator(".transcript-minimap-preview").first()).toContainText("第 1 轮");
	const transcript = page.locator(".transcript");
	await transcript.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	const before = await transcript.evaluate((element) => element.scrollTop);
	await minimap.locator("button").first().click();
	await expect.poll(() => transcript.evaluate((element) => element.scrollTop)).toBeLessThan(before);

	for (let index = 8; index < 22; index++) {
		await composer.fill(`第 ${index + 1} 轮：继续完善当前 Change，并核对剩余任务。`);
		await composer.press("Enter");
		await expect(assistantReplies).toHaveCount(index + 1);
	}
	await expect(minimap.locator("button")).toHaveCount(20);
});

test("defaults file reads and writes to allow and persists permission changes", async () => {
	const { page, userDataRoot } = client;
	await page.getByRole("button", { name: "打开项目", exact: true }).click();
	await page.getByRole("button", { name: "设置", exact: true }).click();
	const readPermission = page.getByLabel("读取文件");
	const writePermission = page.getByLabel("修改文件");
	await expect(readPermission).toHaveValue("allow");
	await expect(writePermission).toHaveValue("allow");
	const requirementSkillCard = page.locator(".role-skill-card").filter({ hasText: "需求分析 Agent" });
	const reviewSkillCard = page.locator(".role-skill-card").filter({ hasText: "Review Agent" });
	await expect(requirementSkillCard.getByText("grill-with-docs", { exact: true })).toBeVisible();
	await expect(requirementSkillCard.getByText("openspec-propose", { exact: true })).toBeVisible();
	await expect(requirementSkillCard.locator("label").filter({ hasText: "grill-with-docs" }).getByRole("checkbox")).toBeChecked();
	await expect(reviewSkillCard.getByText("open-code-review", { exact: true })).toBeVisible();
	await expect(reviewSkillCard.locator("label").filter({ hasText: "open-code-review" }).getByRole("checkbox")).toBeChecked();
	await expect(page.getByRole("button", { name: "打开项目 Skill 文件夹" })).toBeEnabled();

	await writePermission.selectOption("ask");
	await page.getByRole("button", { name: "保存权限" }).click();
	await expect(writePermission).toHaveValue("ask");

	const savedDefaults = JSON.parse(
		await readFile(path.join(userDataRoot, "settings", "permission-defaults.json"), "utf8"),
	) as Record<string, unknown>;
	const policy = JSON.parse(
		await readFile(path.join(userDataRoot, "permissions", "policy", "pi-permissions.jsonc"), "utf8"),
	) as { tools: Record<string, string> };
	 expect(savedDefaults).toEqual({ read: "allow", write: "ask" });
	 expect(policy.tools).toMatchObject({ read: "allow", grep: "allow", write: "ask", edit: "ask" });
});

test("restores a pending permission request after switching away from the agent", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await openRequirementAgent(page);

	const composer = page.locator(".composer textarea");
	await composer.fill("permission");
	await composer.press("Enter");
	await expect(page.getByRole("dialog", { name: "权限请求" })).toBeVisible();
	await page.getByRole("button", { name: "稍后处理" }).click();
	await expect(page.getByRole("dialog", { name: "权限请求" })).toBeHidden();

	await page.getByRole("button", { name: "设置", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "权限请求" })).toBeHidden();
	const requirementAgent = page.getByRole("button", { name: /需求分析 Agent/ });
	if (!(await requirementAgent.isVisible())) {
		const row = page.locator(".work-item-row").filter({ hasText: "FEAT-001" });
		await row.locator(".chevron-button").click();
	}
	await requirementAgent.click();
	await expect(page.getByRole("dialog", { name: "权限请求" })).toBeVisible();
	await page.getByRole("button", { name: "允许", exact: true }).evaluate((button) => {
		button.click();
		button.click();
		button.click();
	});
	await expect(page.getByText(/Permission request is no longer active/i)).toHaveCount(0);
	await expect(page.getByText("权限已允许，Fake Pi 继续完成请求。")).toBeVisible();
});

test("offers a manual continuation when a failed tool ends without a final response", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await openRequirementAgent(page);

	const composer = page.locator(".composer textarea");
	await composer.fill("tool-fail");
	await composer.press("Enter");
	await expect(page.getByText("工具失败后本轮已结束")).toBeVisible();
	await expect(page.getByRole("button", { name: /read.*路径不存在/ })).toBeVisible();

	await page.getByRole("button", { name: "让 Pi 继续处理" }).click();
	await expect(page.locator(".message-assistant").filter({ hasText: "Fake Pi 已完成当前请求。" }).last()).toBeVisible();
	await expect(page.getByText("工具失败后本轮已结束")).toBeHidden();
});


test("executes desktop built-ins and forwards extension commands to Pi", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await openRequirementAgent(page);
	const composer = page.locator(".composer textarea");

	await composer.fill("/hotkeys");
	await composer.press("Enter");
	await expect(page.getByText(/CodePIddy 快捷键/)).toBeVisible();

	await composer.fill("/ext-test");
	await composer.press("Enter");
	await expect(page.locator(".message-assistant").filter({ hasText: "Fake Pi 已完成当前请求。" }).last()).toBeVisible();
});
