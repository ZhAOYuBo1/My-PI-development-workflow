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
		await expect(page.getByRole("combobox", { name: label })).toBeVisible();
	}
	await page.getByRole("combobox", { name: "命令执行" }).selectOption("allow");
	await page.getByRole("combobox", { name: "Skill" }).selectOption("allow");
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
	await expect(page.getByRole("combobox", { name: "命令执行" })).toHaveValue("allow");
	await expect(page.getByRole("combobox", { name: "Skill" })).toHaveValue("allow");
});
