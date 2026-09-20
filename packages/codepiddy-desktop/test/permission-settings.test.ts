import { describe, expect, test } from "vitest";
import {
	createPermissionPolicy,
	DEFAULT_PERMISSION_DEFAULTS,
	normalizePermissionDefaults,
} from "../src/main/permission-settings.ts";

describe("permission settings", () => {
	test("defaults project file reads and writes to direct allow", () => {
		expect(DEFAULT_PERMISSION_DEFAULTS).toEqual({ read: "allow", write: "allow" });
		expect(createPermissionPolicy(DEFAULT_PERMISSION_DEFAULTS)).toMatchObject({
			tools: {
				read: "allow",
				grep: "allow",
				find: "allow",
				ls: "allow",
				write: "allow",
				edit: "allow",
			},
			bash: { "*": "ask" },
			special: { external_directory: "ask" },
		});
	});

	test("normalizes malformed stored settings without widening unrelated permissions", () => {
		expect(normalizePermissionDefaults({ read: "deny", write: "ask" })).toEqual({ read: "deny", write: "ask" });
		expect(normalizePermissionDefaults({ read: "invalid", write: 1 })).toEqual({ read: "allow", write: "allow" });
	});
});
