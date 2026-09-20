import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
	AgentRole,
	PermissionDefaults,
	RoleModelDefault,
	RoleModelDefaults,
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

function isNotFound(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isAgentRole(value: string): value is AgentRole {
	return agentRoles.includes(value as AgentRole);
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
	private readonly roleDefaultsPath: string;
	private readonly roleSkillsPath: string;
	private readonly permissionDefaultsPath: string;
	private readonly permissionPolicyPath: string;

	constructor(userDataPath: string) {
		const settingsDirectory = path.join(userDataPath, "settings");
		this.secretsPath = path.join(settingsDirectory, "secrets.json");
		this.roleDefaultsPath = path.join(settingsDirectory, "role-model-defaults.json");
		this.roleSkillsPath = path.join(settingsDirectory, "role-skills.json");
		this.permissionDefaultsPath = path.join(settingsDirectory, "permission-defaults.json");
		this.permissionPolicyPath = path.join(userDataPath, "permissions", "policy", "pi-permissions.jsonc");
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

	async getRoleModelDefaults(): Promise<RoleModelDefaults> {
		try {
			const parsed = JSON.parse(await readFile(this.roleDefaultsPath, "utf8")) as unknown;
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
			const result: RoleModelDefaults = {};
			for (const [role, value] of Object.entries(parsed)) {
				if (!isAgentRole(role) || typeof value !== "object" || value === null || Array.isArray(value)) continue;
				const item = value as Record<string, unknown>;
				if (
					typeof item.provider !== "string" ||
					typeof item.modelId !== "string" ||
					typeof item.modelName !== "string" ||
					typeof item.thinkingLevel !== "string"
				)
					continue;
				result[role] = {
					role,
					provider: item.provider,
					modelId: item.modelId,
					modelName: item.modelName,
					thinkingLevel: item.thinkingLevel,
				};
			}
			return result;
		} catch (error) {
			if (isNotFound(error)) return {};
			throw error;
		}
	}

	private async writeRoleModelDefaults(defaults: RoleModelDefaults): Promise<void> {
		if (Object.keys(defaults).length === 0) {
			try {
				await unlink(this.roleDefaultsPath);
			} catch (error) {
				if (!isNotFound(error)) throw error;
			}
			return;
		}
		await mkdir(path.dirname(this.roleDefaultsPath), { recursive: true });
		await writeFile(this.roleDefaultsPath, `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
	}

	async getRoleModelDefault(role: AgentRole): Promise<RoleModelDefault | null> {
		return (await this.getRoleModelDefaults())[role] ?? null;
	}

	async setRoleModelDefault(input: RoleModelDefault): Promise<RoleModelDefaults> {
		const provider = input.provider.trim();
		const modelId = input.modelId.trim();
		const modelName = input.modelName.trim();
		const thinkingLevel = input.thinkingLevel.trim();
		if (!provider || !modelId || !modelName || !thinkingLevel) throw new Error("角色默认模型配置不完整");
		const defaults = await this.getRoleModelDefaults();
		defaults[input.role] = { role: input.role, provider, modelId, modelName, thinkingLevel };
		await this.writeRoleModelDefaults(defaults);
		return defaults;
	}

	async clearRoleModelDefault(role: AgentRole): Promise<RoleModelDefaults> {
		const defaults = await this.getRoleModelDefaults();
		delete defaults[role];
		await this.writeRoleModelDefaults(defaults);
		return defaults;
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
