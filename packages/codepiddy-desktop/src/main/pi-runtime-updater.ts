import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PiRuntimeStatus } from "@codepiddy/shared";

const PACKAGE_NAME = "@earendil-works/pi-coding-agent";
const REGISTRY_URL = "https://registry.npmjs.org/@earendil-works%2Fpi-coding-agent/latest";
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const INSTALL_ID_PATTERN = /^v\d+\.\d+\.\d+-[0-9a-f-]{36}$/;
const INSTALL_TIMEOUT_MS = 5 * 60_000;

export interface InstalledPiRuntime {
	version: string;
	packageDir: string;
	cliPath: string;
}

interface ActiveRecord {
	installId: string;
	version: string;
}

interface UpdaterOptions {
	userDataPath: string;
	bundledVersion: string;
	nodeExecutable: string;
	probe(runtime: InstalledPiRuntime, stagingRoot: string): Promise<void>;
	requestLatest?: () => Promise<string>;
	installPackage?: (stagingRoot: string, version: string) => Promise<void>;
	npmCliPath?: string;
}

function parseVersion(value: unknown): string {
	if (typeof value !== "string" || !VERSION_PATTERN.test(value)) throw new Error("Pi 版本号无效");
	return value;
}

function compareVersions(left: string, right: string): number {
	const a = left.split(".").map(Number);
	const b = right.split(".").map(Number);
	for (let index = 0; index < 3; index++) {
		const difference = (a[index] ?? 0) - (b[index] ?? 0);
		if (difference !== 0) return Math.sign(difference);
	}
	return 0;
}

async function requestRegistryLatest(): Promise<string> {
	const response = await fetch(REGISTRY_URL, {
		signal: AbortSignal.timeout(15_000),
		headers: { accept: "application/json" },
	});
	if (!response.ok) throw new Error(`检查 Pi 更新失败：npm registry 返回 ${response.status}`);
	const data = (await response.json()) as unknown;
	if (typeof data !== "object" || data === null || !("version" in data))
		throw new Error("npm registry 未返回 Pi 版本");
	return parseVersion(data.version);
}

async function findNpmCli(): Promise<string | null> {
	const candidates = [
		process.env.CODEPIDDY_NPM_CLI,
		process.env.npm_execpath,
		...(process.env.PATH ?? "")
			.split(path.delimiter)
			.filter(Boolean)
			.map((directory) => path.join(directory, "node_modules", "npm", "bin", "npm-cli.js")),
	];
	for (const candidate of candidates) {
		if (!candidate || !candidate.endsWith("npm-cli.js")) continue;
		try {
			await access(candidate);
			return path.resolve(candidate);
		} catch {
			/* Try the next Node installation. */
		}
	}
	return null;
}

async function runNpmInstall(
	nodeExecutable: string,
	npmCliPath: string,
	stagingRoot: string,
	version: string,
): Promise<void> {
	const args = [
		npmCliPath,
		"install",
		"--prefix",
		stagingRoot,
		"--ignore-scripts",
		"--omit=dev",
		"--no-audit",
		"--no-fund",
		"--no-package-lock",
		"--no-save",
		`${PACKAGE_NAME}@${version}`,
	];
	await new Promise<void>((resolve, reject) => {
		const child = spawn(nodeExecutable, args, {
			cwd: stagingRoot,
			env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
			stdio: ["ignore", "pipe", "pipe"],
		});
		// Drain npm output without surfacing registry credentials or local npm configuration in the UI.
		child.stdout.resume();
		child.stderr.resume();
		const timer = setTimeout(() => {
			child.kill();
			reject(new Error("Pi 安装超时，原版本保持不变"));
		}, INSTALL_TIMEOUT_MS);
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("exit", (code) => {
			clearTimeout(timer);
			if (code === 0) resolve();
			else reject(new Error(`Pi 安装失败（退出码 ${code}），请检查 npm 网络与配置。原版本未变更。`));
		});
	});
}

export class PiRuntimeUpdater {
	private readonly root: string;
	private readonly versionsDir: string;
	private readonly activeFile: string;
	private readonly options: UpdaterOptions;
	private selected: InstalledPiRuntime | null = null;
	private launched: InstalledPiRuntime | null = null;
	private latest: string | null = null;
	private warning: string | null = null;
	private npmCli: string | null = null;
	private installing = false;

	constructor(options: UpdaterOptions) {
		this.options = options;
		this.root = path.join(options.userDataPath, "pi-updates");
		this.versionsDir = path.join(this.root, "versions");
		this.activeFile = path.join(this.root, "active.json");
		parseVersion(options.bundledVersion);
	}

	async initialize(): Promise<void> {
		if (this.options.installPackage) this.npmCli = "test-installer";
		else {
			try {
				if (!this.options.npmCliPath) throw new Error("No bundled npm");
				await access(this.options.npmCliPath);
				this.npmCli = this.options.npmCliPath;
			} catch {
				this.npmCli = await findNpmCli();
			}
		}
		try {
			const raw = JSON.parse(await readFile(this.activeFile, "utf8")) as unknown;
			if (
				typeof raw !== "object" ||
				raw === null ||
				!("installId" in raw) ||
				!("version" in raw) ||
				typeof raw.installId !== "string" ||
				!INSTALL_ID_PATTERN.test(raw.installId)
			)
				throw new Error("无效的更新记录");
			this.selected = await this.validateInstallation(raw.installId, parseVersion(raw.version));
		} catch (error) {
			if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) {
				this.warning = "已安装的 Pi 更新不可用，已回退至内置版本。可以在设置中恢复内置版本后重试。";
			}
		}
		this.launched = this.selected;
	}

	getLaunchRuntime(): InstalledPiRuntime | null {
		return this.launched;
	}

	status(): PiRuntimeStatus {
		const currentVersion = this.selected?.version ?? this.options.bundledVersion;
		return {
			bundledVersion: this.options.bundledVersion,
			currentVersion,
			runningVersion: this.launched?.version ?? this.options.bundledVersion,
			latestVersion: this.latest,
			updateAvailable: this.latest !== null && compareVersions(this.latest, currentVersion) > 0,
			restartRequired: this.selected?.packageDir !== this.launched?.packageDir,
			npmAvailable: this.npmCli !== null,
			warning: this.warning,
		};
	}

	async checkLatest(): Promise<PiRuntimeStatus> {
		this.latest = await (this.options.requestLatest ?? requestRegistryLatest)();
		parseVersion(this.latest);
		return this.status();
	}

	async installLatest(expectedVersion?: string): Promise<PiRuntimeStatus> {
		if (this.installing) throw new Error("Pi 更新正在进行中");
		if (!this.npmCli)
			throw new Error("未找到 npm。请先安装 Node.js/npm，或使用包含新版 Pi 的 CodePIddy 客户端。当前版本未变更。");
		this.installing = true;
		let stagingRoot: string | null = null;
		try {
			const version = await (this.options.requestLatest ?? requestRegistryLatest)();
			parseVersion(version);
			if (expectedVersion && version !== parseVersion(expectedVersion))
				throw new Error("Pi 最新版本已变化，请重新检查并确认后更新");
			if (compareVersions(version, this.selected?.version ?? this.options.bundledVersion) <= 0) {
				this.latest = version;
				return this.status();
			}
			await mkdir(this.root, { recursive: true });
			const installId = `v${version}-${randomUUID()}`;
			stagingRoot = path.join(this.root, `staging-${randomUUID()}`);
			await mkdir(stagingRoot);
			if (this.options.installPackage) await this.options.installPackage(stagingRoot, version);
			else await runNpmInstall(this.options.nodeExecutable, this.npmCli, stagingRoot, version);
			const packageDir = path.join(stagingRoot, "node_modules", "@earendil-works", "pi-coding-agent");
			const runtime = { version, packageDir, cliPath: path.join(packageDir, "dist", "bundle", "cli.js") };
			await this.validatePackage(runtime);
			await this.options.probe(runtime, stagingRoot);
			await mkdir(this.versionsDir, { recursive: true });
			const destination = path.join(this.versionsDir, installId);
			this.assertStagingPath(stagingRoot);
			await rename(stagingRoot, destination);
			stagingRoot = null;
			const selected = await this.validateInstallation(installId, version);
			await this.writeActive({ installId, version });
			this.selected = selected;
			this.latest = version;
			this.warning = null;
			return this.status();
		} finally {
			if (stagingRoot) {
				this.assertStagingPath(stagingRoot);
				await rm(stagingRoot, { recursive: true, force: true });
			}
			this.installing = false;
		}
	}

	async fallbackAfterStartupFailure(): Promise<boolean> {
		if (!this.launched) return false;
		await rm(this.activeFile, { force: true });
		this.selected = null;
		this.launched = null;
		this.warning = "新版 Pi 无法启动，已自动恢复内置版本。";
		return true;
	}

	async restoreBundled(): Promise<PiRuntimeStatus> {
		if (this.installing) throw new Error("Pi 更新进行中，请稍后重试");
		await rm(this.activeFile, { force: true });
		this.selected = null;
		this.warning = null;
		return this.status();
	}

	private assertStagingPath(target: string): void {
		const relative = path.relative(this.root, path.resolve(target));
		if (!/^staging-[0-9a-f-]{36}$/.test(relative)) throw new Error("Pi 临时更新目录超出预期范围");
	}

	private async validatePackage(runtime: InstalledPiRuntime): Promise<void> {
		const manifest = JSON.parse(await readFile(path.join(runtime.packageDir, "package.json"), "utf8")) as unknown;
		if (
			typeof manifest !== "object" ||
			manifest === null ||
			!("name" in manifest) ||
			!("version" in manifest) ||
			manifest.name !== PACKAGE_NAME ||
			manifest.version !== runtime.version
		)
			throw new Error("下载的 Pi 包名称或版本不匹配");
		await access(runtime.cliPath);
		const [actualCli, actualPackage] = await Promise.all([realpath(runtime.cliPath), realpath(runtime.packageDir)]);
		if (!actualCli.startsWith(`${actualPackage}${path.sep}`)) throw new Error("Pi 可执行文件超出安装目录");
	}

	private async validateInstallation(installId: string, version: string): Promise<InstalledPiRuntime> {
		if (!INSTALL_ID_PATTERN.test(installId) || !installId.startsWith(`v${version}-`))
			throw new Error("Pi 更新记录无效");
		const root = path.join(this.versionsDir, installId);
		const packageDir = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent");
		const actual = await realpath(packageDir);
		const expectedRoot = await realpath(root);
		if (!actual.startsWith(`${expectedRoot}${path.sep}`)) throw new Error("Pi 更新目录超出预期范围");
		const runtime = { version, packageDir, cliPath: path.join(packageDir, "dist", "bundle", "cli.js") };
		await this.validatePackage(runtime);
		return runtime;
	}

	private async writeActive(value: ActiveRecord): Promise<void> {
		const temporary = `${this.activeFile}.${randomUUID()}`;
		await writeFile(temporary, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "wx" });
		try {
			await rename(temporary, this.activeFile);
		} catch (error) {
			await rm(temporary, { force: true });
			throw error;
		}
	}
}
