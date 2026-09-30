import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { PermissionManager } from "../../codepiddy-permission-extension/src/permission-manager.ts";
import {
	createPermissionPolicy,
	DEFAULT_PERMISSION_DEFAULTS,
	normalizePermissionDefaults,
} from "../src/main/permission-settings.ts";

describe("permission settings", () => {
	test("defaults every category to allow so a fresh install needs no prompts", () => {
		expect(DEFAULT_PERMISSION_DEFAULTS).toEqual({
			read: "allow",
			write: "allow",
			bash: "allow",
			mcp: "allow",
			skills: "allow",
			otherTools: "allow",
			externalDirectory: "allow",
		});
		expect(createPermissionPolicy(DEFAULT_PERMISSION_DEFAULTS)).toMatchObject({
			defaultPolicy: { tools: "allow", bash: "allow", mcp: "allow", skills: "allow" },
			tools: {
				read: "allow",
				grep: "allow",
				find: "allow",
				ls: "allow",
				write: "allow",
				edit: "allow",
				powershell: "allow",
			},
			bash: { "*": "allow" },
			skills: { "*": "allow" },
			special: { external_directory: "allow" },
		});
	});

	test("powershell follows the bash category, not otherTools", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "codepiddy-powershell-"));
		const configPath = path.join(directory, "policy.jsonc");
		try {
			const manager = new PermissionManager({ globalConfigPath: configPath, agentsDir: directory });
			let mtime = Date.now() / 1000;
			const writePolicy = (defaults: Parameters<typeof createPermissionPolicy>[0]) => {
				writeFileSync(configPath, JSON.stringify(createPermissionPolicy(defaults)));
				utimesSync(configPath, mtime, mtime);
				mtime += 1;
			};
			const check = (tool: string) => manager.checkPermission(tool, { command: "npm run check" }, "FEAT-002 Coding Agent").state;

			// 「命令执行」拒绝时，PowerShell 必须一起拒绝，不能落到「其他工具」。
			writePolicy({ ...DEFAULT_PERMISSION_DEFAULTS, bash: "deny" });
			expect(check("powershell")).toBe("deny");
			expect(check("bash")).toBe("deny");

			writePolicy({ ...DEFAULT_PERMISSION_DEFAULTS, bash: "ask" });
			expect(check("powershell")).toBe("ask");
			expect(check("bash")).toBe("ask");

			// 「其他工具」收紧不应误伤 PowerShell，它归 bash 管。
			writePolicy({ ...DEFAULT_PERMISSION_DEFAULTS, otherTools: "deny" });
			expect(check("powershell")).toBe("allow");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	test("migrates older read/write settings without broadening command permissions", () => {
		expect(normalizePermissionDefaults({ read: "deny", write: "ask" })).toEqual({
			...DEFAULT_PERMISSION_DEFAULTS,
			read: "deny",
			write: "ask",
		});
		expect(normalizePermissionDefaults({ read: "invalid", write: 1 })).toEqual(DEFAULT_PERMISSION_DEFAULTS);
	});

	test("applies a saved policy to both requirement and coding agents, including live changes", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "codepiddy-permissions-"));
		const configPath = path.join(directory, "policy.jsonc");
		try {
			const manager = new PermissionManager({ globalConfigPath: configPath, agentsDir: directory });
			// 权限引擎按 mtimeMs 缓存解析结果（permission-manager.ts:582），同一毫秒内的两次
			// 写入会命中旧缓存，所以每次落盘后显式推进 mtime。
			let mtime = Date.now() / 1000;
			const writePolicy = (defaults: Parameters<typeof createPermissionPolicy>[0]) => {
				writeFileSync(configPath, JSON.stringify(createPermissionPolicy(defaults)));
				utimesSync(configPath, mtime, mtime);
				mtime += 1;
			};

			writePolicy(DEFAULT_PERMISSION_DEFAULTS);
			for (const agent of ["FEAT-002 需求分析 Agent", "FEAT-002 Coding Agent"]) {
				expect(manager.checkPermission("bash", { command: "npm run check" }, agent).state).toBe("allow");
				expect(manager.checkPermission("write", { path: "index.ts" }, agent).state).toBe("allow");
			}
			const narrowed = { ...DEFAULT_PERMISSION_DEFAULTS, bash: "deny" as const, skills: "ask" as const };
			writePolicy(narrowed);
			for (const agent of ["FEAT-002 需求分析 Agent", "FEAT-002 Coding Agent"]) {
				expect(manager.checkPermission("bash", { command: "npm run check" }, agent).state).toBe("deny");
				expect(manager.checkPermission("skill", { name: "openspec" }, agent).state).toBe("ask");
			}
			writePolicy({ ...narrowed, bash: "allow" });
			expect(manager.checkPermission("bash", { command: "git status" }, "FEAT-002 Coding Agent").state).toBe("allow");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
