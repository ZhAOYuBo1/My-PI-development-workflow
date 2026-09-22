import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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
	await expect(card.getByRole("button", { name: /回退到 v/ })).toHaveCount(0);
	const status = await page.evaluate(() => window.codepiddy.getPiRuntimeStatus());
	expect(status).toMatchObject({ bundledVersion: "0.85.1", currentVersion: "0.85.1", rollbackVersion: null, restartRequired: false });
});

test("rolls back to the previous installed Pi and then the bundled version", async () => {
	await client.close();
	client = await launchCodePIddy({ seedUserData: async (userDataRoot) => {
		const root = path.join(userDataRoot, "pi-updates");
		const previousId = "v0.86.0-11111111-1111-4111-8111-111111111111";
		const currentId = "v0.87.0-22222222-2222-4222-8222-222222222222";
		for (const [installId, version] of [[previousId, "0.86.0"], [currentId, "0.87.0"]]) {
			const packageDir = path.join(root, "versions", installId, "node_modules", "@earendil-works", "pi-coding-agent");
			await mkdir(path.join(packageDir, "dist", "bundle"), { recursive: true });
			await writeFile(path.join(packageDir, "package.json"), JSON.stringify({ name: "@earendil-works/pi-coding-agent", version }));
			await writeFile(path.join(packageDir, "dist", "bundle", "cli.js"), "// fixture");
		}
		await writeFile(path.join(root, "active.json"), JSON.stringify({
			installId: currentId, version: "0.87.0",
			history: [{ kind: "bundled" }, { kind: "installed", installId: previousId, version: "0.86.0" }],
		}));
	} });
	const { page, userDataRoot } = client;
	await page.getByRole("button", { name: "设置" }).click();
	const card = page.locator(".pi-runtime-card");
	await expect(card.getByRole("button", { name: "回退到 v0.86.0" })).toBeVisible();
	await card.getByRole("button", { name: "回退到 v0.86.0" }).click();
	await expect(card).toContainText("重启后 v0.86.0");
	await expect(card.getByRole("button", { name: "回退到 v0.85.1" })).toBeVisible();
	const activePath = path.join(userDataRoot, "pi-updates", "active.json");
	const active = JSON.parse(await readFile(activePath, "utf8")) as { version: string };
	expect(active.version).toBe("0.86.0");
	await card.getByRole("button", { name: "回退到 v0.85.1" }).click();
	await expect(card.getByRole("button", { name: /回退到 v/ })).toHaveCount(0);
	await expect(card).toContainText("重启后 v0.85.1");
});
