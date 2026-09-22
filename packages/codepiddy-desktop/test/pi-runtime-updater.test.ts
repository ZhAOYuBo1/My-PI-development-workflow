import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { type InstalledPiRuntime, PiRuntimeUpdater } from "../src/main/pi-runtime-updater.ts";

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture(overrides: { latest?: string; probe?: (runtime: InstalledPiRuntime) => Promise<void> } = {}) {
	const userDataPath = await mkdtemp(path.join(tmpdir(), "codepiddy-update-"));
	directories.push(userDataPath);
	const probeVersions: string[] = [];
	const options = {
		userDataPath,
		bundledVersion: "0.85.1",
		nodeExecutable: process.execPath,
		requestLatest: async () => overrides.latest ?? "0.87.0",
		installPackage: async (stagingRoot: string, version: string) => {
			const packageDir = path.join(stagingRoot, "node_modules", "@earendil-works", "pi-coding-agent");
			await mkdir(path.join(packageDir, "dist", "bundle"), { recursive: true });
			await writeFile(
				path.join(packageDir, "package.json"),
				JSON.stringify({ name: "@earendil-works/pi-coding-agent", version }),
			);
			await writeFile(path.join(packageDir, "dist", "bundle", "cli.js"), "// pi cli");
		},
		probe: async (runtime: InstalledPiRuntime) => {
			probeVersions.push(runtime.version);
			await overrides.probe?.(runtime);
		},
	};
	const updater = new PiRuntimeUpdater(options);
	await updater.initialize();
	return { updater, options, userDataPath, probeVersions };
}

describe("Pi runtime update", () => {
	test("stages, verifies, activates on next launch, and restores bundled runtime", async () => {
		const { updater, options, userDataPath, probeVersions } = await fixture();
		expect(updater.status()).toMatchObject({ currentVersion: "0.85.1", restartRequired: false });
		expect(await updater.checkLatest()).toMatchObject({ latestVersion: "0.87.0", updateAvailable: true });
		expect(await updater.installLatest()).toMatchObject({ currentVersion: "0.87.0", restartRequired: true });
		expect(probeVersions).toEqual(["0.87.0"]);
		expect(updater.getLaunchRuntime()).toBeNull();
		const active = JSON.parse(await readFile(path.join(userDataPath, "pi-updates", "active.json"), "utf8")) as {
			version: string;
		};
		expect(active.version).toBe("0.87.0");
		const nextLaunch = new PiRuntimeUpdater(options);
		await nextLaunch.initialize();
		expect(nextLaunch.getLaunchRuntime()?.version).toBe("0.87.0");
		expect(nextLaunch.status().restartRequired).toBe(false);
		expect(await nextLaunch.restoreBundled()).toMatchObject({ currentVersion: "0.85.1", restartRequired: true });
		const restored = new PiRuntimeUpdater(options);
		await restored.initialize();
		expect(restored.getLaunchRuntime()).toBeNull();
	});

	test("replaces the active selection when a newer Pi version is installed", async () => {
		const { updater, options, userDataPath } = await fixture({ latest: "0.86.0" });
		await updater.installLatest();
		const nextLaunch = new PiRuntimeUpdater({ ...options, requestLatest: async () => "0.87.0" });
		await nextLaunch.initialize();
		expect(await nextLaunch.installLatest()).toMatchObject({
			currentVersion: "0.87.0",
			runningVersion: "0.86.0",
			restartRequired: true,
		});
		const active = JSON.parse(await readFile(path.join(userDataPath, "pi-updates", "active.json"), "utf8")) as {
			version: string;
		};
		expect(active.version).toBe("0.87.0");
	});

	test("failed probe leaves the bundled runtime selected and removes staging", async () => {
		const { updater, userDataPath } = await fixture({
			probe: async () => {
				throw new Error("RPC incompatible");
			},
		});
		await expect(updater.installLatest()).rejects.toThrow("RPC incompatible");
		expect(updater.status().currentVersion).toBe("0.85.1");
		expect(await readdir(path.join(userDataPath, "pi-updates"))).toEqual([]);
	});

	test("automatically falls back if an activated runtime later fails to start", async () => {
		const { updater, options } = await fixture();
		await updater.installLatest();
		const nextLaunch = new PiRuntimeUpdater(options);
		await nextLaunch.initialize();
		expect(await nextLaunch.fallbackAfterStartupFailure()).toBe(true);
		expect(nextLaunch.getLaunchRuntime()).toBeNull();
		expect(nextLaunch.status()).toMatchObject({ currentVersion: "0.85.1", warning: expect.any(String) });
	});

	test("does not install a different version than the user confirmed", async () => {
		const { updater } = await fixture({ latest: "0.87.0" });
		await expect(updater.installLatest("0.86.0")).rejects.toThrow("最新版本已变化");
		expect(updater.status().currentVersion).toBe("0.85.1");
	});

	test("rejects unexpected version strings before installation", async () => {
		const { updater } = await fixture({ latest: "../../other" });
		await expect(updater.installLatest()).rejects.toThrow("版本号无效");
		expect(updater.status().currentVersion).toBe("0.85.1");
	});

	test("ignores tampered active selection", async () => {
		const { options, userDataPath } = await fixture();
		await mkdir(path.join(userDataPath, "pi-updates"));
		await writeFile(
			path.join(userDataPath, "pi-updates", "active.json"),
			JSON.stringify({ version: "0.87.0", installId: "../../other" }),
		);
		const updater = new PiRuntimeUpdater(options);
		await updater.initialize();
		expect(updater.status()).toMatchObject({ currentVersion: "0.85.1", warning: expect.any(String) });
	});
});
