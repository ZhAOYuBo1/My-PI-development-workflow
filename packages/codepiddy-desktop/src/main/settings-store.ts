import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type {
	AgentRole,
	PermissionDefaults,
	RoleSkillAssignments,
	SetRoleSkillAssignmentsInput,
	SettingsStatus,
} from "@codepiddy/shared";
import { safeStorage } from "electron";
import {
	createPermissionPolicy,
	DEFAULT_PERMISSION_DEFAULTS,
	normalizePermissionDefaults,
} from "./permission-settings.ts";
import { DEFAULT_ROLE_SKILL_ASSIGNMENTS } from "./skill-catalog.ts";

interface StoredSecrets {
	tavilyApiKey?: string;
	providerApiKeys?: Record<string, string>;
}

const agentRoles: AgentRole[] = ["requirement-analysis", "coding", "bug-fix", "review"];
const ROLE_SKILLS_SCHEMA_VERSION = 2;

/**
 * 写进 Pi 原生 settings.json 的重试默认值。
 * 与 @codepiddy/retry-extension 的 DEFAULT_RETRY_POLICY 保持一致。
 */
const DEFAULT_RETRY_SETTINGS = {
	maxRetries: 5,
	baseDelayMs: 1000,
	maxAgentDelayMs: 5000,
} as const;

function isNotFound(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

/**
 * Pi 的全局配置目录，对齐 packages/coding-agent/src/config.ts 的 getAgentDir()：
 * 环境变量名由 APP_NAME 推导为 PI_CODING_AGENT_DIR，缺省是 ~/.pi/agent。
 * 抄这里而不是引 Pi 的源码，外壳对 npm 版 Pi 升级免疫。
 */
function resolvePiAgentDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR?.trim();
	return configured ? path.resolve(configured) : path.join(homedir(), ".pi", "agent");
}

function normalizeRoleSkillAssignments(value: unknown): RoleSkillAssignments {
	const record =
		typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
	return Object.fromEntries(
		agentRoles.map((role) => {
			const roleValue = record[role];
			return [
				role,
				Array.isArray(roleValue)
					? [
							...new Set(
								roleValue.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
							),
						]
					: [...DEFAULT_ROLE_SKILL_ASSIGNMENTS[role]],
			];
		}),
	) as RoleSkillAssignments;
}

function addNewBuiltinDefaults(assignments: RoleSkillAssignments): RoleSkillAssignments {
	return Object.fromEntries(
		agentRoles.map((role) => [role, [...new Set([...assignments[role], ...DEFAULT_ROLE_SKILL_ASSIGNMENTS[role]])]]),
	) as RoleSkillAssignments;
}

export class AppSettingsStore {
	private readonly secretsPath: string;
	private readonly roleSkillsPath: string;
	private readonly permissionDefaultsPath: string;
	private readonly permissionPolicyPath: string;
	private readonly shellPathFile: string;
	private readonly piSettingsPath: string;

	constructor(userDataPath: string) {
		const settingsDirectory = path.join(userDataPath, "settings");
		this.secretsPath = path.join(settingsDirectory, "secrets.json");
		this.roleSkillsPath = path.join(settingsDirectory, "role-skills.json");
		this.permissionDefaultsPath = path.join(settingsDirectory, "permission-defaults.json");
		this.permissionPolicyPath = path.join(userDataPath, "permissions", "policy", "pi-permissions.jsonc");
		this.shellPathFile = path.join(settingsDirectory, "shell.json");
		this.piSettingsPath = path.join(resolvePiAgentDir(), "settings.json");
	}

	/**
	 * 把 shellPath 同步到 Pi 自己的 settings.json。
	 *
	 * Pi 只从 settings.json 读 shellPath（packages/coding-agent/src/core/settings-manager.ts
	 * 的 getShellPath），所以这是唯一不依赖 Pi 私有补丁的通路。曾经用 PI_SHELL_PATH
	 * 环境变量绕过，那段读取是我们往 Pi 源码里加的，用户从 npm 升级 Pi 后就没了，
	 * 而外壳毫无察觉地继续传一个没人读的环境变量。
	 *
	 * 合并写而不是覆盖：settings.json 里还有模型、主题等用户自己的配置。
	 */
	private async syncPiShellPath(shellPath: string | null): Promise<void> {
		let current: Record<string, unknown> = {};
		try {
			const parsed: unknown = JSON.parse(await readFile(this.piSettingsPath, "utf8"));
			if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
				current = parsed as Record<string, unknown>;
			}
		} catch (error) {
			if (!isNotFound(error)) throw error;
		}
		if (current.shellPath === (shellPath ?? undefined)) return;
		const next = { ...current };
		if (shellPath) next.shellPath = shellPath;
		else delete next.shellPath;
		await mkdir(path.dirname(this.piSettingsPath), { recursive: true });
		await writeFile(this.piSettingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	}

	async getShellPath(): Promise<string | null> {
		try {
			const parsed = JSON.parse(await readFile(this.shellPathFile, "utf8")) as unknown;
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
			const value = (parsed as Record<string, unknown>).shellPath;
			return typeof value === "string" && value.trim().length > 0 ? value : null;
		} catch (error) {
			if (isNotFound(error)) return null;
			throw error;
		}
	}

	/**
	 * 把 CodePIddy 的重试策略写进 Pi 原生 settings.json。
	 *
	 * Pi core 的 getRetrySettings() 只读 settings.retry.*，写这里就不需要在 core 里改默认值，
	 * Pi 更新后仍然生效。只补缺失字段，用户显式写过的值优先。
	 */
	private async syncPiRetrySettings(): Promise<void> {
		let current: Record<string, unknown> = {};
		try {
			const parsed: unknown = JSON.parse(await readFile(this.piSettingsPath, "utf8"));
			if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
				current = parsed as Record<string, unknown>;
			}
		} catch (error) {
			if (!isNotFound(error)) throw error;
		}
		const existing =
			typeof current.retry === "object" && current.retry !== null && !Array.isArray(current.retry)
				? (current.retry as Record<string, unknown>)
				: {};
		const nextRetry = { ...existing };
		let changed = false;
		for (const [key, value] of Object.entries(DEFAULT_RETRY_SETTINGS)) {
			if (typeof nextRetry[key] !== "number") {
				nextRetry[key] = value;
				changed = true;
			}
		}
		if (!changed) return;
		await mkdir(path.dirname(this.piSettingsPath), { recursive: true });
		await writeFile(this.piSettingsPath, `${JSON.stringify({ ...current, retry: nextRetry }, null, 2)}\n`, "utf8");
	}

	async ensurePiRetrySettings(): Promise<void> {
		await this.syncPiRetrySettings();
	}

	async setShellPath(value: string): Promise<SettingsStatus> {
		const shellPath = value.trim();
		if (shellPath && !existsSync(shellPath)) throw new Error(`Shell 路径不存在：${shellPath}`);
		if (shellPath) {
			await mkdir(path.dirname(this.shellPathFile), { recursive: true });
			await writeFile(this.shellPathFile, `${JSON.stringify({ shellPath }, null, 2)}\n`, "utf8");
		} else {
			try {
				await unlink(this.shellPathFile);
			} catch (error) {
				if (!isNotFound(error)) throw error;
			}
		}
		await this.syncPiShellPath(shellPath || null);
		return this.status();
	}

	async getPermissionDefaults(): Promise<PermissionDefaults> {
		try {
			return normalizePermissionDefaults(JSON.parse(await readFile(this.permissionDefaultsPath, "utf8")) as unknown);
		} catch (error) {
			if (isNotFound(error)) return { ...DEFAULT_PERMISSION_DEFAULTS };
			throw error;
		}
	}

	private async writePermissionPolicy(defaults: PermissionDefaults): Promise<void> {
		await mkdir(path.dirname(this.permissionPolicyPath), { recursive: true });
		await writeFile(
			this.permissionPolicyPath,
			`${JSON.stringify(createPermissionPolicy(defaults), null, 2)}\n`,
			"utf8",
		);
	}

	async ensurePermissionPolicy(): Promise<PermissionDefaults> {
		const defaults = await this.getPermissionDefaults();
		await this.writePermissionPolicy(defaults);
		return defaults;
	}

	async setPermissionDefaults(input: PermissionDefaults): Promise<PermissionDefaults> {
		const defaults = normalizePermissionDefaults(input);
		await mkdir(path.dirname(this.permissionDefaultsPath), { recursive: true });
		await writeFile(this.permissionDefaultsPath, `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
		await this.writePermissionPolicy(defaults);
		return defaults;
	}

	private async readSecrets(): Promise<StoredSecrets> {
		try {
			const parsed = JSON.parse(await readFile(this.secretsPath, "utf8")) as unknown;
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
			const record = parsed as Record<string, unknown>;
			const providerApiKeys = record.providerApiKeys;
			return {
				...(typeof record.tavilyApiKey === "string" ? { tavilyApiKey: record.tavilyApiKey } : {}),
				...(typeof providerApiKeys === "object" && providerApiKeys !== null && !Array.isArray(providerApiKeys)
					? {
							providerApiKeys: Object.fromEntries(
								Object.entries(providerApiKeys).filter(
									(entry): entry is [string, string] => typeof entry[1] === "string",
								),
							),
						}
					: {}),
			};
		} catch (error) {
			if (isNotFound(error)) return {};
			throw error;
		}
	}

	private async writeSecrets(secrets: StoredSecrets): Promise<void> {
		const hasProviderKeys = secrets.providerApiKeys && Object.keys(secrets.providerApiKeys).length > 0;
		if (!secrets.tavilyApiKey && !hasProviderKeys) {
			try {
				await unlink(this.secretsPath);
			} catch (error) {
				if (!isNotFound(error)) throw error;
			}
			return;
		}
		await mkdir(path.dirname(this.secretsPath), { recursive: true });
		await writeFile(this.secretsPath, `${JSON.stringify(secrets, null, 2)}\n`, "utf8");
	}

	private decrypt(value: string | undefined): string | null {
		if (!value || !safeStorage.isEncryptionAvailable()) return null;
		return safeStorage.decryptString(Buffer.from(value, "base64"));
	}

	private encrypt(value: string): string {
		if (!safeStorage.isEncryptionAvailable()) throw new Error("当前系统无法使用 Electron safeStorage");
		return safeStorage.encryptString(value).toString("base64");
	}

	async getRoleSkillAssignments(): Promise<RoleSkillAssignments> {
		try {
			const parsed = JSON.parse(await readFile(this.roleSkillsPath, "utf8")) as unknown;
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
				return structuredClone(DEFAULT_ROLE_SKILL_ASSIGNMENTS);
			}
			const record = parsed as Record<string, unknown>;
			if (record.schemaVersion === ROLE_SKILLS_SCHEMA_VERSION) {
				return normalizeRoleSkillAssignments(record.assignments);
			}
			const migrated = addNewBuiltinDefaults(normalizeRoleSkillAssignments(record));
			await this.writeRoleSkillAssignments(migrated);
			return migrated;
		} catch (error) {
			if (isNotFound(error)) return structuredClone(DEFAULT_ROLE_SKILL_ASSIGNMENTS);
			throw error;
		}
	}

	private async writeRoleSkillAssignments(assignments: RoleSkillAssignments): Promise<void> {
		await mkdir(path.dirname(this.roleSkillsPath), { recursive: true });
		await writeFile(
			this.roleSkillsPath,
			`${JSON.stringify({ schemaVersion: ROLE_SKILLS_SCHEMA_VERSION, assignments }, null, 2)}\n`,
			"utf8",
		);
	}

	async setRoleSkillAssignments(input: SetRoleSkillAssignmentsInput): Promise<RoleSkillAssignments> {
		const assignments = await this.getRoleSkillAssignments();
		assignments[input.role] = [
			...new Set(input.skillIds.map((skillId) => skillId.trim()).filter((skillId) => skillId.length > 0)),
		];
		await this.writeRoleSkillAssignments(assignments);
		return assignments;
	}

	async status(): Promise<SettingsStatus> {
		return {
			tavilyApiKeyConfigured: (await this.getTavilyApiKey()) !== null,
			encryptionAvailable: safeStorage.isEncryptionAvailable(),
			shellPath: await this.getShellPath(),
		};
	}

	async getTavilyApiKey(): Promise<string | null> {
		return this.decrypt((await this.readSecrets()).tavilyApiKey);
	}

	async saveTavilyApiKey(value: string): Promise<SettingsStatus> {
		const apiKey = value.trim();
		if (!apiKey) throw new Error("Tavily API Key 不能为空");
		const secrets = await this.readSecrets();
		secrets.tavilyApiKey = this.encrypt(apiKey);
		await this.writeSecrets(secrets);
		return this.status();
	}

	async clearTavilyApiKey(): Promise<SettingsStatus> {
		const secrets = await this.readSecrets();
		delete secrets.tavilyApiKey;
		await this.writeSecrets(secrets);
		return this.status();
	}
}
