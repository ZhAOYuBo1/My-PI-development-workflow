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
	await page.getByRole("button", { name: "允许", exact: true }).click();
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
