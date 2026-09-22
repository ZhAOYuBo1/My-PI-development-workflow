import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
	test("defaults file access to allow and other common operations to ask", () => {
		expect(DEFAULT_PERMISSION_DEFAULTS).toEqual({
			read: "allow",
			write: "allow",
			bash: "ask",
			mcp: "ask",
			skills: "ask",
			otherTools: "ask",
			externalDirectory: "ask",
		});
		expect(createPermissionPolicy(DEFAULT_PERMISSION_DEFAULTS)).toMatchObject({
			defaultPolicy: { tools: "ask", bash: "ask", mcp: "ask", skills: "ask" },
			tools: { read: "allow", grep: "allow", find: "allow", ls: "allow", write: "allow", edit: "allow" },
			bash: { "*": "ask", "git status*": "allow" },
			skills: { "*": "ask" },
			special: { external_directory: "ask" },
		});
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
			writeFileSync(configPath, JSON.stringify(createPermissionPolicy(DEFAULT_PERMISSION_DEFAULTS)));
			for (const agent of ["FEAT-002 需求分析 Agent", "FEAT-002 Coding Agent"]) {
				expect(manager.checkPermission("bash", { command: "npm run check" }, agent).state).toBe("ask");
				expect(manager.checkPermission("write", { path: "index.ts" }, agent).state).toBe("allow");
			}
			const allowed = { ...DEFAULT_PERMISSION_DEFAULTS, bash: "allow" as const, skills: "allow" as const };
			writeFileSync(configPath, JSON.stringify(createPermissionPolicy(allowed)));
			for (const agent of ["FEAT-002 需求分析 Agent", "FEAT-002 Coding Agent"]) {
				expect(manager.checkPermission("bash", { command: "npm run check" }, agent).state).toBe("allow");
				expect(manager.checkPermission("skill", { name: "openspec" }, agent).state).toBe("allow");
			}
			writeFileSync(configPath, JSON.stringify(createPermissionPolicy({ ...allowed, bash: "deny" })));
			expect(manager.checkPermission("bash", { command: "git status" }, "FEAT-002 Coding Agent").state).toBe("deny");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
