import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launchCodePIddy, type CodePIddyE2EApp } from "./helpers/app.ts";

let client: CodePIddyE2EApp;

test.beforeEach(async () => {
	client = await launchCodePIddy();
});

test.afterEach(async () => {
	await client.close();
});

test("global permission settings expose common operations and persist for every agent", async () => {
	const { page, userDataRoot } = client;
	await page.getByRole("button", { name: "设置" }).click();
	for (const label of ["读取文件", "修改文件", "命令执行", "MCP 工具", "Skill", "其他工具", "项目外路径"]) {
		await expect(page.getByRole("button", { name: new RegExp(`^${label}：`) })).toBeVisible();
	}
	await page.getByRole("button", { name: "命令执行：每次询问" }).click();
	await page.getByRole("listbox", { name: "命令执行权限" }).getByRole("option", { name: "直接允许" }).click();
	await page.getByRole("button", { name: "MCP 工具：每次询问" }).click();
	await expect(page.getByRole("listbox", { name: "MCP 工具权限" })).toBeVisible();
	await page.getByRole("heading", { name: "默认权限" }).click();
	await expect(page.getByRole("listbox", { name: "MCP 工具权限" })).toHaveCount(0);
	await page.getByRole("button", { name: "Skill：每次询问" }).focus();
	await page.keyboard.press("ArrowDown");
	await expect(page.getByRole("listbox", { name: "Skill权限" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("listbox", { name: "Skill权限" })).toHaveCount(0);
	await page.getByRole("button", { name: "Skill：每次询问" }).click();
	await page.getByRole("listbox", { name: "Skill权限" }).getByRole("option", { name: "直接允许" }).click();
	await page.getByRole("button", { name: "保存权限" }).click();
	const policyPath = path.join(userDataRoot, "permissions", "policy", "pi-permissions.jsonc");
	await expect.poll(async () => JSON.parse(await readFile(policyPath, "utf8"))).toMatchObject({
		defaultPolicy: { bash: "allow", skills: "allow", tools: "ask", mcp: "ask" },
		tools: { read: "allow", write: "allow" },
		bash: { "*": "allow" },
		skills: { "*": "allow" },
	});
	await page.reload();
	await page.getByRole("button", { name: "设置" }).click();
	await expect(page.getByRole("button", { name: "命令执行：直接允许" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Skill：直接允许" })).toBeVisible();
});
