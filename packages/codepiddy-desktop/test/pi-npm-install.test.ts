import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { type InstalledPiRuntime, PiRuntimeUpdater } from "../src/main/pi-runtime-updater.ts";

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
	for (const key of Object.keys(process.env)) {
		if (key.toLowerCase().startsWith("npm_config_")) delete process.env[key];
	}
});

/**
 * 假的 npm CLI：记录收到的 argv 与环境变量，并按需造出安装结果。
 * 让 runNpmInstall 的真实代码路径（而不是 installPackage 测试替身）被覆盖到。
 */
const FAKE_NPM = `
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const record = process.env.CODEPIDDY_TEST_RECORD;
if (record) {
	writeFileSync(
		record,
		JSON.stringify({
			args,
			npmConfigEnv: Object.fromEntries(
				Object.entries(process.env).filter(([k]) => k.toLowerCase().startsWith("npm_")),
			),
		}),
	);
}
if (process.env.CODEPIDDY_TEST_FAIL_CODE) {
	process.stderr.write("npm error code " + process.env.CODEPIDDY_TEST_FAIL_CODE + "\\n");
	process.stderr.write("npm error notarget No matching version found\\n");
	process.exit(1);
}
const prefix = args[args.indexOf("--prefix") + 1];
const spec = args[args.length - 1];
const version = spec.slice(spec.lastIndexOf("@") + 1);
const packageDir = path.join(prefix, "node_modules", "@earendil-works", "pi-coding-agent");
mkdirSync(path.join(packageDir, "dist", "bundle"), { recursive: true });
writeFileSync(
	path.join(packageDir, "package.json"),
	JSON.stringify({ name: "@earendil-works/pi-coding-agent", version }),
);
writeFileSync(path.join(packageDir, "dist", "bundle", "cli.js"), "// pi cli");
`;

interface NpmInvocation {
	args: string[];
	npmConfigEnv: Record<string, string>;
}

interface NpmHarness {
	updater: PiRuntimeUpdater;
	userDataPath: string;
	recordPath: string;
	readInvocation(): Promise<NpmInvocation>;
}

async function npmHarness(options: { latest?: string; failCode?: string } = {}): Promise<NpmHarness> {
	const root = await mkdtemp(path.join(tmpdir(), "codepiddy-npm-"));
	directories.push(root);
	const userDataPath = path.join(root, "user-data");
	const recordPath = path.join(root, "invocation.json");
	const fakeNpmPath = path.join(root, "npm-cli.js");
	await writeFile(fakeNpmPath, FAKE_NPM, "utf8");
	await mkdir(userDataPath, { recursive: true });

	process.env.CODEPIDDY_TEST_RECORD = recordPath;
	if (options.failCode) process.env.CODEPIDDY_TEST_FAIL_CODE = options.failCode;
	else delete process.env.CODEPIDDY_TEST_FAIL_CODE;

	const updater = new PiRuntimeUpdater({
		userDataPath,
		bundledVersion: "0.85.1",
		nodeExecutable: process.execPath,
		npmCliPath: fakeNpmPath,
		requestLatest: async () => options.latest ?? "0.99.1",
		probe: async (_runtime: InstalledPiRuntime) => undefined,
	});
	await updater.initialize();
	return {
		updater,
		userDataPath,
		recordPath,
		readInvocation: async () => JSON.parse(await readFile(recordPath, "utf8")) as NpmInvocation,
	};
}

describe("Pi 安装的 npm 调用", () => {
	test("钉住 registry 并关闭 min-release-age，否则装不上刚发布的版本", async () => {
		const { updater, readInvocation } = await npmHarness();
		await updater.installLatest();
		const { args } = await readInvocation();
		// 查版本用的是 registry.npmjs.org，安装必须同源，否则镜像延迟会 ETARGET。
		expect(args).toContain("--registry=https://registry.npmjs.org");
		// 仓库 .npmrc 设了 min-release-age=2，会把刚发布的最新版拒掉。
		expect(args).toContain("--min-release-age=0");
		expect(args).toContain("@earendil-works/pi-coding-agent@0.99.1");
	});

	test("不让父进程 npm 的 npm_config_* 泄漏进安装环境", async () => {
		// 模拟 `npm start` 启动应用时 npm 注入的环境变量。
		process.env.npm_config_min_release_age = "2";
		process.env.npm_config_registry = "https://registry.npmmirror.com";
		process.env.npm_config_prefix = "D:/some/global/prefix";
		const { updater, readInvocation } = await npmHarness();
		await updater.installLatest();
		const { npmConfigEnv } = await readInvocation();
		// 依赖年龄策略、镜像、prefix 都不该影响运行时更新。
		expect(npmConfigEnv).toEqual({});
	});

	test("安装失败时把 npm 错误码带进报错，不再只说「检查网络与配置」", async () => {
		const { updater, userDataPath } = await npmHarness({ failCode: "ETARGET" });
		await expect(updater.installLatest()).rejects.toThrow(/ETARGET/);
		// 失败后不激活任何版本，暂存目录清理掉。
		expect(updater.status().currentVersion).toBe("0.85.1");
		const { readdir } = await import("node:fs/promises");
		expect(await readdir(path.join(userDataPath, "pi-updates"))).toEqual([]);
	});
});
