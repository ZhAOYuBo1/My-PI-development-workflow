import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

export interface CodePIddyE2EApp {
	app: ElectronApplication;
	page: Page;
	projectRoot: string;
	userDataRoot: string;
	close(): Promise<void>;
}

export async function launchCodePIddy(options?: {
	seedUserData?(userDataRoot: string): Promise<void>;
	fakePiCommandsWithoutBuiltins?: boolean;
	manyModels?: boolean;
}): Promise<CodePIddyE2EApp> {
	const desktopRoot = path.resolve(import.meta.dirname, "..", "..");
	const repositoryRoot = path.resolve(desktopRoot, "..", "..");
	const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "codepiddy-e2e-"));
	const projectRoot = path.join(temporaryRoot, "sample-project");
	const userDataRoot = path.join(temporaryRoot, "user-data");
	await Promise.all([mkdir(projectRoot), mkdir(userDataRoot)]);
	await writeFile(
		path.join(projectRoot, "package.json"),
		`${JSON.stringify({ name: "sample-project", private: true }, null, 2)}\n`,
		"utf8",
	);
	await options?.seedUserData?.(userDataRoot);
	const application = await electron.launch({
		args: [desktopRoot],
		cwd: desktopRoot,
		env: {
			...process.env,
			CODEPIDDY_REPO_ROOT: repositoryRoot,
			CODEPIDDY_PI_CLI: path.join(desktopRoot, "e2e", "fixtures", "fake-pi-rpc.mjs"),
			CODEPIDDY_NODE_EXECUTABLE: process.execPath,
			CODEPIDDY_USER_DATA: userDataRoot,
			CODEPIDDY_TEST_PROJECT_ROOT: projectRoot,
			CODEPIDDY_DISABLE_SINGLE_INSTANCE: "1",
			CODEPIDDY_DISABLE_PROJECT_DISCOVERY: "1",
			...(options?.fakePiCommandsWithoutBuiltins ? { CODEPIDDY_TEST_PI_COMMANDS_NO_BUILTINS: "1" } : {}),
			...(options?.manyModels ? { CODEPIDDY_TEST_MANY_MODELS: "1" } : {}),
		},
	});
	const page = await application.firstWindow();
	await page.waitForLoadState("domcontentloaded");
	return {
		app: application,
		page,
		projectRoot,
		userDataRoot,
		async close(): Promise<void> {
			await application.close().catch(() => undefined);
			await rm(temporaryRoot, { recursive: true, force: true });
		},
	};
}

export async function createFeatureWorkItem(page: Page): Promise<void> {
	await page.getByRole("button", { name: "打开项目", exact: true }).click();
	await page.getByRole("button", { name: "创建新需求" }).click();
	await page.getByLabel("标题").fill("E2E 登录功能");
	await page.getByLabel("初始描述").fill("验证 CodePIddy Electron 工作流");
	await page.getByRole("button", { name: "创建", exact: true }).click();
	await page.getByRole("button", { name: /FEAT-001/ }).waitFor();
	const row = page.locator(".work-item-row").filter({ hasText: "FEAT-001" });
	await row.locator(".chevron-button").click();
}

export async function openRequirementAgent(page: Page): Promise<void> {
	await page.getByRole("button", { name: /需求分析 Agent/ }).click();
	const createButton = page.getByRole("button", { name: "创建 Agent" });
	if (await createButton.isVisible()) await createButton.click();
	await page.locator(".composer textarea").waitFor();
}
