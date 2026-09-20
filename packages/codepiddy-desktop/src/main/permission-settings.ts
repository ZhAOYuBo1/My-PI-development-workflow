import type { PermissionDefaults, PermissionState } from "@codepiddy/shared";

export const DEFAULT_PERMISSION_DEFAULTS: PermissionDefaults = {
	read: "allow",
	write: "allow",
};

export function isPermissionState(value: unknown): value is PermissionState {
	return value === "allow" || value === "ask" || value === "deny";
}

export function normalizePermissionDefaults(value: unknown): PermissionDefaults {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return { ...DEFAULT_PERMISSION_DEFAULTS };
	}
	const record = value as Record<string, unknown>;
	return {
		read: isPermissionState(record.read) ? record.read : DEFAULT_PERMISSION_DEFAULTS.read,
		write: isPermissionState(record.write) ? record.write : DEFAULT_PERMISSION_DEFAULTS.write,
	};
}

export function createPermissionPolicy(defaults: PermissionDefaults): Record<string, unknown> {
	return {
		defaultPolicy: { tools: "ask", bash: "ask", mcp: "ask", skills: "ask", special: "ask" },
		tools: {
			read: defaults.read,
			grep: defaults.read,
			find: defaults.read,
			ls: defaults.read,
			write: defaults.write,
			edit: defaults.write,
		},
		bash: {
			"git status*": "allow",
			"git diff*": "allow",
			"git log*": "allow",
			"git show*": "allow",
			"*": "ask",
		},
		mcp: {},
		skills: { "*": "ask" },
		special: { external_directory: "ask" },
	};
}
