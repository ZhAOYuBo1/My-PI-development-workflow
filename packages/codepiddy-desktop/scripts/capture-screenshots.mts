/**
 * 重新生成 README 用的三张界面截图。
 *
 * 走 Electron e2e 那条路（Playwright 直接驱动本机 Electron，不需要额外下载浏览器内核），
 * 项目目录、会话历史都由本脚本和 scripts/fixtures/shot-pi-rpc.mjs 造出来，因此截图内容可重复。
 *
 *   node --import tsx packages/codepiddy-desktop/scripts/capture-screenshots.mts
 *
 * 注意：会重建 dist/renderer，Electron 正在运行时不要执行。
 */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(desktopRoot, "..", "..");
const outputDirectory = path.join(repositoryRoot, "docs", "images");
// 右侧文件管理器会占掉约 40% 宽度，窗口太窄会把转录流挤到出现横向滚动，所以取 1600。
const VIEWPORT = { width: 1600, height: 900 };

const SAMPLE_FILES: Array<[string, string]> = [
	["package.json", '{\n  "name": "login-service",\n  "private": true\n}\n'],
	["README.md", "# 登录服务\n\n支持账号密码登录，并为后续第三方登录预留扩展点。\n"],
	["src/auth/login.ts", "export async function login(input: LoginInput) {\n  return authService.authenticate(input);\n}\n"],
	["src/auth/session.ts", "export function issueSession(userId: string) {\n  return { userId, issuedAt: Date.now() };\n}\n"],
	["src/auth/provider.ts", "export interface AuthProvider {\n  login(input: LoginInput): Promise<Session>;\n}\n"],
	["src/routes/index.ts", "export const routes = [\n  { path: '/login', handler: login },\n  { path: '/logout', handler: logout },\n];\n"],
	["docs/api.md", "# API\n\n## POST /login\n\n请求体 `{ username, password }`。\n"],
];

function buildRenderer(): void {
	const result = spawnSync("npm", ["run", "build:renderer"], {
		cwd: desktopRoot,
		shell: true,
		stdio: "inherit",
	});
	if (result.status !== 0) throw new Error("构建 renderer 失败");
}

async function main(): Promise<void> {
	const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "codepiddy-shots-"));
	const projectRoot = path.join(temporaryRoot, "login-service");
	const userDataRoot = path.join(temporaryRoot, "user-data");
	await Promise.all([mkdir(projectRoot, { recursive: true }), mkdir(userDataRoot)]);
	for (const [relative, content] of SAMPLE_FILES) {
		const target = path.join(projectRoot, ...relative.split("/"));
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, content, "utf8");
	}

	buildRenderer();
	await mkdir(outputDirectory, { recursive: true });

	const app = await electron.launch({
		args: [desktopRoot],
		cwd: desktopRoot,
		env: {
			...process.env,
			CODEPIDDY_REPO_ROOT: repositoryRoot,
			CODEPIDDY_PI_CLI: path.join(scriptDirectory, "fixtures", "shot-pi-rpc.mjs"),
			CODEPIDDY_NODE_EXECUTABLE: process.execPath,
			CODEPIDDY_USER_DATA: userDataRoot,
			CODEPIDDY_TEST_PROJECT_ROOT: projectRoot,
			CODEPIDDY_DISABLE_SINGLE_INSTANCE: "1",
			CODEPIDDY_DISABLE_PROJECT_DISCOVERY: "1",
		},
	});
	try {
		const page = await app.firstWindow();
		await page.waitForLoadState("domcontentloaded");
		// setViewportSize 对 Electron 无效，必须直接改 BrowserWindow，否则布局宽度不变。
		await app.evaluate(({ BrowserWindow }, size) => {
			BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height);
		}, VIEWPORT);
		await page.waitForTimeout(500);
		const shoot = async (name: string): Promise<void> => {
			// 转录流默认停在最底部，截图要展示完整一轮，所以先回到顶部。
			const transcript = page.locator(".transcript");
			if (await transcript.count()) await transcript.evaluate((element) => (element.scrollTop = 0));
			await page.waitForTimeout(500);
			await page.screenshot({ path: path.join(outputDirectory, name) });
			console.log(`captured ${name}`);
		};

		await page.getByRole("button", { name: "打开项目", exact: true }).click();
		await page.getByRole("button", { name: "创建新需求" }).click();
		await page.getByLabel("标题", { exact: true }).fill("增加登录功能");
		await page.getByLabel("初始描述").fill("支持账号密码登录，并为后续第三方登录预留扩展点。");
		await page.getByRole("button", { name: "创建", exact: true }).click();
		const workItem = page.locator(".work-item-row").filter({ hasText: "FEAT-001" });
		await workItem.waitFor();
		await workItem.locator(".chevron-button").click();
		await page.getByRole("button", { name: /需求分析 Agent/ }).click();
		const createRequirementAgent = page.getByRole("button", { name: "创建 Agent" });
		if (await createRequirementAgent.isVisible()) await createRequirementAgent.click();
		await page.locator(".content-header").getByRole("button", { name: "批准需求" }).click();
		const codingRow = page.locator(".agent-row, .tree-label").filter({ hasText: "Coding Agent" }).first();
		if (!(await codingRow.isVisible())) {
			await workItem.locator(".chevron-button").click();
			await codingRow.waitFor();
		}
		await codingRow.click();
		const createAgent = page.getByRole("button", { name: "创建 Agent" });
		if (await createAgent.isVisible()) await createAgent.click();
		await page.locator(".composer textarea").waitFor();
		for (const name of ["src", "auth", "login.ts"]) {
			await page.locator(".file-tree-row").filter({ hasText: name }).first().click();
			await page.waitForTimeout(250);
		}
		await shoot("codepiddy-agent.png");

		await page.locator(".tree-label").filter({ hasText: "FEAT-001" }).first().click();
		await shoot("codepiddy-overview.png");

		await page.getByRole("button", { name: "设置" }).click();
		await page.getByRole("heading", { name: "设置" }).waitFor();
		await shoot("codepiddy-settings.png");
	} finally {
		await app.close().catch(() => undefined);
		await rm(path.join(desktopRoot, "dist", "renderer"), { recursive: true, force: true });
		await rm(temporaryRoot, { recursive: true, force: true });
	}
	console.log("截图已写入", outputDirectory);
}

await main();
