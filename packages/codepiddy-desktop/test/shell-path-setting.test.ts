import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("electron", () => ({
	safeStorage: { isEncryptionAvailable: () => false },
}));

const { AppSettingsStore } = await import("../src/main/settings-store.ts");

const temporaryDirectories: string[] = [];
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;

afterEach(async () => {
	if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

async function createStore(): Promise<{ store: InstanceType<typeof AppSettingsStore>; agentDir: string }> {
	const userData = await mkdtemp(path.join(os.tmpdir(), "codepiddy-shell-store-"));
	temporaryDirectories.push(userData);
	// Pi 的 settings.json 写到真实 ~/.pi/agent 会污染用户配置，测试里必须重定向。
	const agentDir = await mkdtemp(path.join(os.tmpdir(), "codepiddy-pi-agent-"));
	temporaryDirectories.push(agentDir);
	process.env.PI_CODING_AGENT_DIR = agentDir;
	return { store: new AppSettingsStore(userData), agentDir };
}

async function readPiSettings(agentDir: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(agentDir, "settings.json"), "utf8")) as Record<string, unknown>;
}

describe("shell path setting", () => {
	test("defaults to auto-detection when nothing is configured", async () => {
		const { store, agentDir } = await createStore();
		expect(await store.getShellPath()).toBeNull();
		expect((await store.status()).shellPath).toBeNull();
		await expect(readFile(path.join(agentDir, "settings.json"), "utf8")).rejects.toThrow();
	});

	test("persists a configured path and reports it in status", async () => {
		const { store } = await createStore();
		const bashPath = path.join(temporaryDirectories[0]!, "bash.exe");
		await writeFile(bashPath, "");
		const status = await store.setShellPath(bashPath);
		expect(status.shellPath).toBe(bashPath);
		expect(await store.getShellPath()).toBe(bashPath);
	});

	test("clears the configured path", async () => {
		const { store } = await createStore();
		const bashPath = path.join(temporaryDirectories[0]!, "bash.exe");
		await writeFile(bashPath, "");
		await store.setShellPath(bashPath);
		expect((await store.setShellPath("  ")).shellPath).toBeNull();
		expect(await store.getShellPath()).toBeNull();
	});

	test("rejects a path that does not exist", async () => {
		const { store } = await createStore();
		await expect(store.setShellPath(path.join(temporaryDirectories[0]!, "missing", "bash.exe"))).rejects.toThrow(
			/Shell 路径不存在/,
		);
		expect(await store.getShellPath()).toBeNull();
	});

	// Pi 只从 settings.json 读 shellPath，这是不依赖 Pi 私有补丁的唯一通路。
	test("writes shellPath into Pi settings.json so no Pi patch is needed", async () => {
		const { store, agentDir } = await createStore();
		const bashPath = path.join(temporaryDirectories[0]!, "bash.exe");
		await writeFile(bashPath, "");
		await store.setShellPath(bashPath);
		expect((await readPiSettings(agentDir)).shellPath).toBe(bashPath);
	});

	test("preserves unrelated Pi settings when writing shellPath", async () => {
		const { store, agentDir } = await createStore();
		await writeFile(
			path.join(agentDir, "settings.json"),
			JSON.stringify({ theme: "dark", defaultTools: ["read", "bash"] }),
		);
		const bashPath = path.join(temporaryDirectories[0]!, "bash.exe");
		await writeFile(bashPath, "");
		await store.setShellPath(bashPath);
		expect(await readPiSettings(agentDir)).toEqual({
			theme: "dark",
			defaultTools: ["read", "bash"],
			shellPath: bashPath,
		});
	});

	test("removes shellPath from Pi settings.json when cleared", async () => {
		const { store, agentDir } = await createStore();
		const bashPath = path.join(temporaryDirectories[0]!, "bash.exe");
		await writeFile(bashPath, "");
		await store.setShellPath(bashPath);
		await store.setShellPath("  ");
		expect(await readPiSettings(agentDir)).toEqual({});
	});
});
