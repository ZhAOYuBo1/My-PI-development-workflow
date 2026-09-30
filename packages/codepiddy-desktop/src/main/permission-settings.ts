import type { PermissionDefaults, PermissionState } from "@codepiddy/shared";

/**
 * 出厂全 allow：多 Agent 交接靠共享工作树和 OpenSpec 文档，创建与否完全由用户在
 * 客户端决定，不需要靠弹窗兜流程。设置页仍可逐项收紧。
 *
 * 注意 skills 必须是 allow —— 扩展会把非 allow 的 Skill 从 system prompt 的
 * <available_skills> 里删掉（skill-prompt-sanitizer.ts），ask 等于让模型看不见 Skill。
 */
export const DEFAULT_PERMISSION_DEFAULTS: PermissionDefaults = {
	read: "allow",
	write: "allow",
	bash: "allow",
	mcp: "allow",
	skills: "allow",
	otherTools: "allow",
	externalDirectory: "allow",
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
