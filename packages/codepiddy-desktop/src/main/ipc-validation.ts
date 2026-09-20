import path from "node:path";
import type {
	AgentInstanceLocator,
	AgentRole,
	ApproveRequirementInput,
	ArchiveWorkItemInput,
	CreateAgentInput,
	CreateWorkItemInput,
	ExtensionUiResponseInput,
	ForkAgentSessionInput,
	InvokeAgentBuiltinCommandInput,
	LaneKind,
	RenameWorkItemInput,
	ResetAgentInput,
	RoleModelDefault,
	SendAgentPromptInput,
	SetAgentModelInput,
	SetAgentThinkingInput,
	SetRoleSkillAssignmentsInput,
} from "@codepiddy/shared";

function record(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} 格式无效`);
	return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum: number, allowEmpty = false): string {
	if (typeof value !== "string") throw new Error(`${label} 必须是字符串`);
	const result = value.trim();
	if (!allowEmpty && !result) throw new Error(`${label} 不能为空`);
	if (result.length > maximum) throw new Error(`${label} 超过最大长度 ${maximum}`);
	if (result.includes("\0")) throw new Error(`${label} 包含非法字符`);
	return result;
}

function role(value: unknown): AgentRole {
	if (value === "requirement-analysis" || value === "coding" || value === "bug-fix" || value === "review")
		return value;
	throw new Error("Agent Role 无效");
}

function lane(value: unknown): LaneKind {
	if (value === "requirements" || value === "bugs") return value;
	throw new Error("Work Item Lane 无效");
}

function projectRoot(value: unknown): string {
	return path.resolve(text(value, "项目路径", 2048));
}

function projectId(value: unknown): string {
	const result = text(value, "Project ID", 128);
	if (!/^[a-zA-Z0-9-]+$/.test(result)) throw new Error("Project ID 格式无效");
	return result;
}

function workItemId(value: unknown): string {
	const result = text(value, "Work Item ID", 64);
	if (!/^(FEAT|BUG)-\d{3,}$/i.test(result)) throw new Error("Work Item ID 格式无效");
	return result.toUpperCase();
}

function agentInstanceId(value: unknown): string {
	const result = text(value, "Agent Instance ID", 128);
	if (!/^[a-zA-Z0-9-]+$/.test(result)) throw new Error("Agent Instance ID 格式无效");
	return result;
}

export function parseAgentRole(value: unknown): AgentRole {
	return role(value);
}

export function parseProjectRoot(value: unknown): string {
	return projectRoot(value);
}

export function parseCreateWorkItemInput(value: unknown): CreateWorkItemInput {
	const input = record(value, "Create Work Item");
	return {
		projectRoot: projectRoot(input.projectRoot),
		lane: lane(input.lane),
		title: text(input.title, "标题", 200),
		description: text(input.description, "初始描述", 20_000, true),
	};
}

export function parseArchiveWorkItemInput(value: unknown): ArchiveWorkItemInput {
	const input = record(value, "Work Item");
	return {
		projectRoot: projectRoot(input.projectRoot),
		lane: lane(input.lane),
		workItemId: workItemId(input.workItemId),
	};
}

export function parseApproveRequirementInput(value: unknown): ApproveRequirementInput {
	const input = record(value, "Approve Requirement");
	return { projectRoot: projectRoot(input.projectRoot), workItemId: workItemId(input.workItemId) };
}

export function parseRenameWorkItemInput(value: unknown): RenameWorkItemInput {
	const input = record(value, "Rename Work Item");
	return {
		projectRoot: projectRoot(input.projectRoot),
		lane: lane(input.lane),
		workItemId: workItemId(input.workItemId),
		title: text(input.title, "标题", 200),
	};
}

export function parseAgentLocator(value: unknown): AgentInstanceLocator {
	const input = record(value, "Agent Locator");
	return {
		agentInstanceId: agentInstanceId(input.agentInstanceId),
		projectId: projectId(input.projectId),
		workItemId: workItemId(input.workItemId),
		role: role(input.role),
	};
}

export function parseCreateAgentInput(value: unknown): CreateAgentInput {
	const input = record(value, "Create Agent");
	return {
		projectRoot: projectRoot(input.projectRoot),
		projectId: projectId(input.projectId),
		workItemId: workItemId(input.workItemId),
		workItemDirectory: path.resolve(text(input.workItemDirectory, "Work Item 路径", 2048)),
		lane: lane(input.lane),
		role: role(input.role),
	};
}

export function parseResetAgentInput(value: unknown): ResetAgentInput {
	const input = record(value, "Reset Agent");
	return { ...parseCreateAgentInput(input), agentInstanceId: agentInstanceId(input.agentInstanceId) };
}

export function parseSendAgentPromptInput(value: unknown): SendAgentPromptInput {
	const input = record(value, "Send Prompt");
	const streamingBehavior = input.streamingBehavior;
	if (streamingBehavior !== undefined && streamingBehavior !== "steer" && streamingBehavior !== "followUp") {
		throw new Error("Streaming Behavior 无效");
	}
	return {
		...parseAgentLocator(input),
		message: text(input.message, "消息", 200_000),
		...(streamingBehavior ? { streamingBehavior } : {}),
	};
}

export function parseSetAgentModelInput(value: unknown): SetAgentModelInput {
	const input = record(value, "Set Agent Model");
	return {
		...parseAgentLocator(input),
		provider: text(input.provider, "Provider", 200),
		modelId: text(input.modelId, "Model ID", 300),
	};
}

export function parseSetAgentThinkingInput(value: unknown): SetAgentThinkingInput {
	const input = record(value, "Set Thinking");
	return { ...parseAgentLocator(input), level: text(input.level, "Thinking Level", 32) };
}

export function parseForkAgentSessionInput(value: unknown): ForkAgentSessionInput {
	const input = record(value, "Fork Session");
	return { ...parseAgentLocator(input), entryId: text(input.entryId, "Session Entry ID", 200) };
}

export function parseExtensionUiResponseInput(value: unknown): ExtensionUiResponseInput {
	const input = record(value, "Permission Response");
	const result: ExtensionUiResponseInput = {
		...parseAgentLocator(input),
		requestId: text(input.requestId, "Permission Request ID", 200),
	};
	if (input.value !== undefined) result.value = text(input.value, "Permission Value", 100_000, true);
	if (input.confirmed !== undefined) {
		if (typeof input.confirmed !== "boolean") throw new Error("Permission confirmed 必须是布尔值");
		result.confirmed = input.confirmed;
	}
	if (input.cancelled !== undefined) {
		if (input.cancelled !== true) throw new Error("Permission cancelled 值无效");
		result.cancelled = true;
	}
	return result;
}

export function parseRoleSkillAssignmentsInput(value: unknown): SetRoleSkillAssignmentsInput {
	const input = record(value, "Role Skills");
	if (!Array.isArray(input.skillIds)) throw new Error("Skill IDs 必须是数组");
	return {
		role: role(input.role),
		skillIds: [...new Set(input.skillIds.map((item) => text(item, "Skill ID", 2048)))],
		...(input.projectRoot === undefined ? {} : { projectRoot: projectRoot(input.projectRoot) }),
	};
}

export function parseProjectId(value: unknown): string {
	return projectId(value);
}

export function parseBoundedText(value: unknown, label: string, maximum: number, allowEmpty = false): string {
	return text(value, label, maximum, allowEmpty);
}

export function parseInvokeAgentBuiltinCommandInput(value: unknown): InvokeAgentBuiltinCommandInput {
	const input = record(value, "Agent Command");
	return {
		...parseAgentLocator(input),
		name: text(input.name, "命令名称", 200),
		args: text(input.args, "命令参数", 20_000, true),
	};
}

export function parseRoleModelDefault(value: unknown): RoleModelDefault {
	const input = record(value, "Role Model Default");
	return {
		role: role(input.role),
		provider: text(input.provider, "Provider", 200),
		modelId: text(input.modelId, "Model ID", 300),
		modelName: text(input.modelName, "Model Name", 300),
		thinkingLevel: text(input.thinkingLevel, "Thinking Level", 32),
	};
}

export function assertPathInside(parentPath: string, candidatePath: string, label: string): void {
	const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
	if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)))
		return;
	throw new Error(`${label} 超出允许目录`);
}
