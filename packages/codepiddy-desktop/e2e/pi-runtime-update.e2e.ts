import { expect, test } from "@playwright/test";
import { launchCodePIddy, type CodePIddyE2EApp } from "./helpers/app.ts";

let client: CodePIddyE2EApp;
test.beforeEach(async () => { client = await launchCodePIddy(); });
test.afterEach(async () => { await client.close(); });

test("shows the bundled Pi runtime and keeps update separate from the app and projects", async () => {
	const { page } = client;
	await page.getByRole("button", { name: "设置" }).click();
	const card = page.locator(".pi-runtime-card");
	await expect(card.getByRole("heading", { name: "Pi 运行时" })).toBeVisible();
	await expect(card).toContainText("单独更新 Agent 内核");
	await expect(card).toContainText("正在使用 v0.85.1");
	await expect(card.getByRole("button", { name: "检查更新" })).toBeEnabled();
	await expect(card.getByRole("button", { name: "重启客户端以生效" })).toHaveCount(0);
	const status = await page.evaluate(() => window.codepiddy.getPiRuntimeStatus());
	expect(status).toMatchObject({ bundledVersion: "0.85.1", currentVersion: "0.85.1", restartRequired: false });
});
