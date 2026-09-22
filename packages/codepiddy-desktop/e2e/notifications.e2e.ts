import { expect, test } from "@playwright/test";
import { createFeatureWorkItem, launchCodePIddy, openRequirementAgent, type CodePIddyE2EApp } from "./helpers/app.ts";

let client: CodePIddyE2EApp;
test.beforeEach(async () => { client = await launchCodePIddy(); });
test.afterEach(async () => { await client.close(); });

test("non-blocking errors appear above the header and dismiss themselves", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await openRequirementAgent(page);
	const composer = page.locator(".composer textarea");
	await composer.fill("/compact");
	await composer.press("Enter");
	const alert = page.getByRole("alert");
	await expect(alert).toContainText("Nothing to compact");
	await expect(alert.getByRole("button", { name: "关闭错误提示" })).toBeVisible();
	const layers = await page.evaluate(() => ({
		alert: Number(getComputedStyle(document.querySelector(".error-banner")!).zIndex),
		header: Number(getComputedStyle(document.querySelector(".content-header")!).zIndex),
	}));
	expect(layers.alert).toBeGreaterThan(layers.header);
	await expect(alert).toBeHidden({ timeout: 9_000 });
});

test("archive undo toast disappears automatically", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await page.getByRole("button", { name: "归档工作项" }).click();
	const toast = page.locator(".toast");
	await expect(toast).toContainText("已归档");
	await expect(toast.getByRole("button", { name: "撤销" })).toBeVisible();
	await expect(toast).toBeHidden({ timeout: 7_000 });
});
