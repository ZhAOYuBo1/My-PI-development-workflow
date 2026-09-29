import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.ts";

// normalizeWindowsShellPath 只转换 /c/... 这类 MSYS 路径，普通 "D:/..." 原样保留，
// Windows 的 existsSync 两种写法都接受，所以这里断言原样返回。
const WINDOWS_BASH = "D:/git/Git/bin/bash.exe";

describe("SettingsManager shell path", () => {
	const testDir = join(process.cwd(), "test-shell-path-tmp");
	const agentDir = join(testDir, "agent");
	const projectDir = join(testDir, "project");

	beforeEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		delete process.env.PI_SHELL_PATH;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		delete process.env.PI_SHELL_PATH;
	});

	function createManager(): SettingsManager {
		return SettingsManager.create(projectDir, agentDir);
	}

	it("has no shell path by default", () => {
		expect(createManager().getShellPath()).toBeUndefined();
	});

	it("reads shellPath from settings.json", async () => {
		const manager = createManager();
		manager.setShellPath("/bin/zsh");
		await manager.flush();
		expect(createManager().getShellPath()).toBe("/bin/zsh");
	});

	it("prefers PI_SHELL_PATH over settings.json so hosts can inject a path", async () => {
		const manager = createManager();
		manager.setShellPath("/bin/zsh");
		await manager.flush();
		process.env.PI_SHELL_PATH = WINDOWS_BASH;
		expect(createManager().getShellPath()).toBe(WINDOWS_BASH);
	});

	it("ignores a blank PI_SHELL_PATH", async () => {
		const manager = createManager();
		manager.setShellPath("/bin/zsh");
		await manager.flush();
		process.env.PI_SHELL_PATH = "   ";
		expect(createManager().getShellPath()).toBe("/bin/zsh");
	});

	it("uses PI_SHELL_PATH even when settings.json has none", () => {
		process.env.PI_SHELL_PATH = WINDOWS_BASH;
		expect(createManager().getShellPath()).toBe(WINDOWS_BASH);
	});
});
