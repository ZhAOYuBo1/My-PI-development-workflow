import type { PermissionDefaults, PermissionState } from "@codepiddy/shared";

export const DEFAULT_PERMISSION_DEFAULTS: PermissionDefaults = {
	read: "allow",
	write: "allow",
	bash: "ask",
	mcp: "ask",
	skills: "ask",
	otherTools: "ask",
	externalDirectory: "ask",
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
		bash: isPermissionState(record.bash) ? record.bash : DEFAULT_PERMISSION_DEFAULTS.bash,
		mcp: isPermissionState(record.mcp) ? record.mcp : DEFAULT_PERMISSION_DEFAULTS.mcp,
		skills: isPermissionState(record.skills) ? record.skills : DEFAULT_PERMISSION_DEFAULTS.skills,
		otherTools: isPermissionState(record.otherTools) ? record.otherTools : DEFAULT_PERMISSION_DEFAULTS.otherTools,
		externalDirectory: isPermissionState(record.externalDirectory)
			? record.externalDirectory
			: DEFAULT_PERMISSION_DEFAULTS.externalDirectory,
	};
}

export function createPermissionPolicy(defaults: PermissionDefaults): Record<string, unknown> {
	return {
		defaultPolicy: {
			tools: defaults.otherTools,
			bash: defaults.bash,
			mcp: defaults.mcp,
			skills: defaults.skills,
			special: "ask",
		},
		tools: {
			read: defaults.read,
			grep: defaults.read,
			find: defaults.read,
			ls: defaults.read,
			write: defaults.write,
			edit: defaults.write,
		},
		bash: {
			...(defaults.bash === "ask"
				? { "git status*": "allow", "git diff*": "allow", "git log*": "allow", "git show*": "allow" }
				: {}),
			"*": defaults.bash,
		},
		mcp: {},
		skills: { "*": defaults.skills },
		special: { external_directory: defaults.externalDirectory },
	};
}
