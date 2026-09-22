import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createFeatureWorkItem, launchCodePIddy, openRequirementAgent, type CodePIddyE2EApp } from "./helpers/app.ts";

let client: CodePIddyE2EApp;
test.beforeEach(async () => {
	client = await launchCodePIddy({
		fakePiCommandsWithoutBuiltins: true,
		manyModels: true,
		seedUserData: async (userDataRoot) => {
			const installId = "v0.87.0-22222222-2222-4222-8222-222222222222";
			const root = path.join(userDataRoot, "pi-updates");
			const packageDir = path.join(root, "versions", installId, "node_modules", "@earendil-works", "pi-coding-agent");
			await mkdir(path.join(packageDir, "dist", "core"), { recursive: true });
			await mkdir(path.join(packageDir, "dist", "bundle"), { recursive: true });
			await writeFile(path.join(packageDir, "package.json"), JSON.stringify({ name: "@earendil-works/pi-coding-agent", version: "0.87.0", type: "module" }));
			await writeFile(path.join(packageDir, "dist", "bundle", "cli.js"), "// fixture");
			const names = ["settings", "model", "tree", "thinking", "scoped-models", "export", "import", "copy", "name", "session", "changelog", "hotkeys", "fork", "clone", "trust", "login", "logout", "new", "compact", "resume", "reload", "quit"];
			await writeFile(path.join(packageDir, "dist", "core", "slash-commands.js"), `export const BUILTIN_SLASH_COMMANDS = ${JSON.stringify(names.map((name) => ({ name, description: `Pi ${name}` })))};`);
			await writeFile(path.join(root, "active.json"), JSON.stringify({ installId, version: "0.87.0" }));
		},
	});
});
test.afterEach(async () => { await client.close(); });

test("new Pi RPC resources are merged with its own built-in slash commands without invalid-query flicker", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await openRequirementAgent(page);
	const composer = page.locator(".composer textarea");
	await composer.fill("/");
	const menu = page.getByRole("listbox", { name: "Pi 斜杠命令" });
	await expect(menu.getByRole("option", { name: /\/model/ })).toBeVisible();
	await expect(menu.getByRole("option", { name: /\/compact/ })).toBeVisible();
	await expect(menu.getByRole("option", { name: /\/ext-test/ })).toBeVisible();
	for (let index = 0; index < 15; index++) await page.keyboard.press("ArrowDown");
	await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	const selected = menu.getByRole("option", { selected: true });
	const listBox = await menu.boundingBox();
	const selectedBox = await selected.boundingBox();
	expect(listBox && selectedBox && selectedBox.y >= listBox.y && selectedBox.y + selectedBox.height <= listBox.y + listBox.height).toBe(true);
	await composer.fill("/command-that-does-not-exist");
	await expect(menu).toHaveCount(0);
	const flashes = await page.evaluate(async () => {
		let count = 0;
		const observer = new MutationObserver(() => { if (document.querySelector(".slash-menu-loading")) count++; });
		observer.observe(document.body, { subtree: true, childList: true });
		await new Promise((resolve) => setTimeout(resolve, 650));
		observer.disconnect();
		return count;
	});
	expect(flashes).toBe(0);
	await composer.fill("/model");
	await composer.press("Enter");
	await expect(page.getByRole("dialog", { name: "选择模型" })).toBeVisible();
});

test("model picker preserves mouse scrolling and arrow keys scroll the highlighted model into view", async () => {
	const { page } = client;
	await createFeatureWorkItem(page);
	await openRequirementAgent(page);
	await page.locator(".model-seat").click();
	const list = page.locator(".model-picker .model-list");
	await expect(list.locator("button")).toHaveCount(46);
	await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	const bottom = list.locator('[data-model-index="45"]');
	await bottom.hover();
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
	await bottom.click();
	await expect(page.locator(".model-seat")).toContainText("Model 46");
	await page.locator(".model-seat").click();
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
	await list.evaluate((element) => { element.scrollTop = 0; });
	await page.waitForTimeout(250);
	expect(await list.evaluate((element) => element.scrollTop)).toBe(0);
	const search = page.getByPlaceholder("搜索模型");
	await search.focus();
	await search.fill("Model");
	for (let index = 0; index < 24; index++) await page.keyboard.press("ArrowDown");
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	const selected = list.locator("button.keyboard-selected");
	const listBox = await list.boundingBox();
	const selectedBox = await selected.boundingBox();
	expect(listBox && selectedBox && selectedBox.y >= listBox.y && selectedBox.y + selectedBox.height <= listBox.y + listBox.height).toBe(true);
});
