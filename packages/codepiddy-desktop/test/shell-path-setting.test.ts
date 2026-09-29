import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("electron", () => ({
	safeStorage: { isEncryptionAvailable: () => false },
}));

const { AppSettingsStore } = await import("../src/main/settings-store.ts");

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

async function createStore(): Promise<InstanceType<typeof AppSettingsStore>> {
	const userData = await mkdtemp(path.join(os.tmpdir(), "codepiddy-shell-store-"));
	temporaryDirectories.push(userData);
	return new AppSettingsStore(userData);
}

describe("shell path setting", () => {
	test("defaults to auto-detection when nothing is configured", async () => {
		const store = await createStore();
		expect(await store.getShellPath()).toBeNull();
		expect((await store.status()).shellPath).toBeNull();
	});

	test("persists a configured path and reports it in status", async () => {
		const store = await createStore();
		const bashPath = path.join(temporaryDirectories[0]!, "bash.exe");
		await writeFile(bashPath, "");
		const status = await store.setShellPath(bashPath);
		expect(status.shellPath).toBe(bashPath);
		expect(await store.getShellPath()).toBe(bashPath);
	});

	test("clears the configured path", async () => {
		const store = await createStore();
		const bashPath = path.join(temporaryDirectories[0]!, "bash.exe");
		await writeFile(bashPath, "");
		await store.setShellPath(bashPath);
		expect((await store.setShellPath("  ")).shellPath).toBeNull();
		expect(await store.getShellPath()).toBeNull();
	});

	test("rejects a path that does not exist", async () => {
		const store = await createStore();
		await expect(store.setShellPath(path.join(temporaryDirectories[0]!, "missing", "bash.exe"))).rejects.toThrow(
			/Shell 路径不存在/,
		);
		expect(await store.getShellPath()).toBeNull();
	});
});
