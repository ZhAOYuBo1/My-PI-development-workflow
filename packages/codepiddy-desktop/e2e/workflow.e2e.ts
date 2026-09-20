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
	await openRequirementAgent(page);
	await page.getByRole("button", { name: "Agent 操作" }).click();
	const actionsPanel = page.getByRole("toolbar", { name: "Agent 操作" });
	await expect(actionsPanel).toBeVisible();
	const panelBox = await actionsPanel.boundingBox();
	const transcriptBox = await page.locator(".transcript").boundingBox();
	expect(panelBox).not.toBeNull();
	expect(transcriptBox).not.toBeNull();
	expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(transcriptBox!.y + 1);
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

test("defaults file reads and writes to allow and persists permission changes", async () => {
	const { page, userDataRoot } = client;
	await page.getByRole("button", { name: "设置", exact: true }).click();
	const readPermission = page.getByLabel("读取文件");
	const writePermission = page.getByLabel("修改文件");
	await expect(readPermission).toHaveValue("allow");
	await expect(writePermission).toHaveValue("allow");

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
	await expect(page.getByText("Fake Pi 已完成当前请求。")).toBeVisible();
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
	await expect(page.getByText("Fake Pi 已完成当前请求。")).toBeVisible();
});
