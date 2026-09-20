import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.e2e.ts",
	fullyParallel: false,
	workers: 1,
	timeout: 45_000,
	expect: { timeout: 8_000 },
	reporter: [["list"]],
	use: { trace: "retain-on-failure" },
});
