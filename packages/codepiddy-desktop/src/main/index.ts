import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	AgentRegistry,
	approveRequirement,
	archiveWorkItem,
	createWorkItem,
	deleteWorkItem,
	openProject,
	PiRpcProcess,
	ProjectWriteLeaseManager,
	readRoleProfile,
	renameWorkItem,
	restoreWorkItem,
	type StoredAgentInstance,
	searchProjectFiles,
} from "@codepiddy/core";
import type {
	AgentBuiltinCommandResult,
	AgentClientEvent,
	AgentCommandOption,
	AgentContextUsage,
	AgentInstanceLocator,
	AgentModelOption,
	AgentModelSelection,
	AgentRole,
	AgentSessionNode,
	AgentSessionSnapshot,
	ApproveRequirementInput,
	ArchiveWorkItemInput,
	CreateAgentInput,
	CreateWorkItemInput,
	ExtensionUiResponseInput,
	ForkAgentSessionInput,
	ForkAgentSessionResult,
	InvokeAgentBuiltinCommandInput,
	PendingPermissionRequest,
	ProjectSummary,
	RenameWorkItemInput,
	ResetAgentInput,
	RoleModelDefault,
	SendAgentPromptInput,
	SetAgentModelInput,
	SetAgentThinkingInput,
	SetRoleSkillAssignmentsInput,
} from "@codepiddy/shared";
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { RecentProjectStore } from "./recent-project-store.ts";
import { AppSettingsStore } from "./settings-store.ts";
import { SingleFlightMap } from "./single-flight.ts";
import { discoverAgentSkills, resolveRoleSkillPaths } from "./skill-catalog.ts";

const channels = {
	abortAgent: "codepiddy:agent:abort",
	reconnectAgent: "codepiddy:agent:reconnect",
	compactAgent: "codepiddy:agent:compact",
	invokeAgentBuiltinCommand: "codepiddy:agent:command:invoke",
	cloneAgentSession: "codepiddy:agent:session:clone",
	getAgentSessionSnapshot: "codepiddy:agent:session:get",
	forkAgentSession: "codepiddy:agent:session:fork",
	resetAgent: "codepiddy:agent:reset",
	activateAgent: "codepiddy:agent:activate",
	agentEvent: "codepiddy:agent:event",
	approveRequirement: "codepiddy:work-item:approve-requirement",
	archiveWorkItem: "codepiddy:work-item:archive",
	createAgent: "codepiddy:agent:create",
	createWorkItem: "codepiddy:work-item:create",
	renameWorkItem: "codepiddy:work-item:rename",
	deleteWorkItem: "codepiddy:work-item:delete",
	getAgentModelSelection: "codepiddy:agent:model:get",
	getAgentCommands: "codepiddy:agent:commands:get",
	getProjectWriteLeaseStatus: "codepiddy:write-lease:get",
	clearStaleProjectWriteLease: "codepiddy:write-lease:clear-stale",
	setAgentModel: "codepiddy:agent:model:set",
	setAgentThinking: "codepiddy:agent:thinking:set",
	listRecentProjects: "codepiddy:project:recent:list",
	getStartupProject: "codepiddy:project:startup",
	closeProject: "codepiddy:project:close",
	openProject: "codepiddy:project:open",
	openRecentProject: "codepiddy:project:recent:open",
	forgetRecentProject: "codepiddy:project:recent:forget",
	openWorkItemFolder: "codepiddy:work-item:open-folder",
	refreshProject: "codepiddy:project:refresh",
	restoreWorkItem: "codepiddy:work-item:restore",
	respondToExtensionUi: "codepiddy:agent:extension-ui-response",
	getPendingPermissionRequest: "codepiddy:agent:permission:get-pending",
	settingsClearTavily: "codepiddy:settings:tavily:clear",
	settingsListSkills: "codepiddy:settings:skills:list",
	settingsGetRoleSkills: "codepiddy:settings:role-skills:get",
	settingsSetRoleSkills: "codepiddy:settings:role-skills:set",
	settingsOpenPiConfig: "codepiddy:settings:pi-config:open",
	settingsGetRoleDefaults: "codepiddy:settings:role-models:get",
	settingsSetRoleDefault: "codepiddy:settings:role-models:set",
	settingsClearRoleDefault: "codepiddy:settings:role-models:clear",
	settingsSaveTavily: "codepiddy:settings:tavily:save",
	settingsStatus: "codepiddy:settings:status",
	searchProjectFiles: "codepiddy:project:files:search",
	sendAgentPrompt: "codepiddy:agent:prompt",
} as const;

function roleLabel(role: AgentRole): string {
	if (role === "requirement-analysis") return "需求分析 Agent";
	if (role === "coding") return "Coding Agent";
	if (role === "bug-fix") return "Bug Fix Agent";
	return "Review Agent";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseContextUsage(value: unknown): AgentContextUsage | undefined {
	if (!isRecord(value) || typeof value.contextWindow !== "number" || value.contextWindow <= 0) return undefined;
	return {
		tokens: typeof value.tokens === "number" ? value.tokens : null,
		contextWindow: value.contextWindow,
		percent: typeof value.percent === "number" ? value.percent : null,
	};
}

function sessionEntryText(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(sessionEntryText).filter(Boolean).join("\n");
	if (!isRecord(value)) return "";
	if (value.type === "text" && typeof value.text === "string") return value.text;
	if ("content" in value) return sessionEntryText(value.content);
	if (typeof value.summary === "string") return value.summary;
	if (typeof value.text === "string") return value.text;
	return "";
}

function flattenSessionTree(
	tree: unknown[],
	leafId: string | null,
	forkableIds: ReadonlySet<string>,
): AgentSessionNode[] {
	const result: AgentSessionNode[] = [];
	const visit = (value: unknown, depth: number): void => {
		if (!isRecord(value) || !isRecord(value.entry)) return;
		const entry = value.entry;
		if (typeof entry.id !== "string" || typeof entry.type !== "string") return;
		const message = isRecord(entry.message) ? entry.message : null;
		const role = message && typeof message.role === "string" ? message.role : undefined;
		const label = typeof value.label === "string" ? value.label : undefined;
		const rawText = message ? sessionEntryText(message.content) : sessionEntryText(entry);
		const fallbackText =
			entry.type === "model_change" && typeof entry.modelId === "string"
				? `模型：${typeof entry.provider === "string" ? `${entry.provider}/` : ""}${entry.modelId}`
				: entry.type === "thinking_level_change" && typeof entry.thinkingLevel === "string"
					? `推理等级：${entry.thinkingLevel}`
					: entry.type.replaceAll("_", " ");
		result.push({
			entryId: entry.id,
			parentId: typeof entry.parentId === "string" ? entry.parentId : null,
			type: entry.type,
			...(role ? { role } : {}),
			...(label ? { label } : {}),
			text: (rawText || label || fallbackText).trim(),
			...(typeof entry.timestamp === "string" ? { timestamp: entry.timestamp } : {}),
			depth,
			isLeaf: entry.id === leafId,
			forkable: forkableIds.has(entry.id),
		});
		const children = Array.isArray(value.children) ? value.children : [];
		for (const child of children) visit(child, depth + 1);
	};
	for (const root of tree) visit(root, 0);
	return result;
}

async function readWorkItemPromptContext(agent: StoredAgentInstance): Promise<{ title: string; description: string }> {
	try {
		const value = JSON.parse(await readFile(path.join(agent.workItemDirectory, "work-item.json"), "utf8")) as unknown;
		if (!isRecord(value)) return { title: agent.workItemId, description: "" };
		return {
			title: typeof value.title === "string" ? value.title : agent.workItemId,
			description: typeof value.description === "string" ? value.description : "",
		};
	} catch {
		return { title: agent.workItemId, description: "" };
	}
}

function roleDocumentContract(agent: StoredAgentInstance): string {
	const document = (name: string): string => path.join(agent.workItemDirectory, name);
	const sharedRules = [
		"Use only the exact workflow document paths listed below. Do not guess alternate .codepiddy paths.",
		"An empty workflow file means that handoff has not been written yet. Do not search sibling Work Items for a substitute.",
		"Never read or write another Work Item directory unless the user explicitly names it.",
		"Project source files may be inspected when required by your role, but workflow state must stay inside this Work Item.",
	];
	if (agent.role === "requirement-analysis") {
		return [
			...sharedRules,
			"There are no prerequisite handoff documents for this role. Start from the user-provided title and description in the runtime context.",
			`Create and maintain: ${document("requirement.md")}`,
			`Maintain: ${document("design.md")}`,
			`Maintain: ${document("tasks.md")}`,
			"Use the grill-with-docs skill for requirement clarification and domain modeling.",
			"Host-required headings: requirement.md = 目标 / 功能需求 / 验收条件; design.md = 设计方案 / 影响范围 / 验证策略; tasks.md = 任务拆解 plus Markdown task checkboxes.",
		].join("\n");
	}
	if (agent.role === "coding") {
		return [
			...sharedRules,
			`Read: ${document("work-item.md")}`,
			`Read: ${document("requirement.md")}`,
			`Read: ${document("design.md")}`,
			`Read: ${document("tasks.md")}`,
			`Optional review input: ${document("review.md")}`,
			`Required output: ${document("implementation.md")}`,
			"Host-required headings in implementation.md: 实现摘要 / 修改文件 / 测试结果 / 审查重点. It must list every changed project-relative file, key symbols or code regions, behavior changes, commands, tests, and known issues.",
		].join("\n");
	}
	if (agent.role === "bug-fix") {
		return [
			...sharedRules,
			"There are no prerequisite handoff documents for this role. Start from the user-provided title and description in the runtime context, then inspect the project to reproduce the bug.",
			`Optional review input for a later correction pass: ${document("review.md")}`,
			`Required output: ${document("fix.md")}`,
			"Host-required headings in fix.md: 根因 / 修改文件 / 验证结果 / 审查重点. It must list the reproduction, root cause, every changed project-relative file, key symbols or code regions, behavior changes, commands, tests, and remaining risks.",
		].join("\n");
	}
	return [
		...sharedRules,
		`Read: ${document("work-item.md")}`,
		agent.lane === "requirements"
			? `Read feature handoff: ${document("requirement.md")}, ${document("design.md")}, ${document("tasks.md")}, ${document("implementation.md")}`
			: `Read bug handoff: ${document("fix.md")}`,
		`Required output: ${document("review.md")}`,
		"Use the implementation/fix handoff to locate changes, then verify against the real project diff and tests.",
	].join("\n");
}

async function rolePrompt(agent: StoredAgentInstance, webSearchAvailable: boolean): Promise<string> {
	const [profile, workItem] = await Promise.all([
		readRoleProfile(agent.projectRoot, agent.role),
		readWorkItemPromptContext(agent),
	]);
	return [
		`<active_agent name="${agent.role}">`,
		"# CodePIddy Runtime Context",
		`Project root: ${agent.projectRoot}`,
		`Work item: ${agent.workItemId}`,
		`Work item directory: ${agent.workItemDirectory}`,
		`User-provided title: ${workItem.title}`,
		`User-provided description: ${workItem.description || "No description provided."}`,
		"The listed handoff documents are the workflow source of truth once their producing Agent writes them.",
		"",
		"# Web Search Contract",
		webSearchAvailable
			? "web_search is a search engine only. It returns ranked results and snippets; it never opens, fetches, reads, crawls, maps, or extracts a webpage. If the user asks to inspect a specific URL, explain that limitation and use keyword/domain search only for discoverable snippets. Never claim that a webpage was read from web_search results."
			: "web_search is unavailable because Tavily is not configured. Do not attempt to call it; tell the user that web search requires configuration in CodePIddy Settings.",
		"",
		profile,
		"# Work Item File Contract",
		roleDocumentContract(agent),
		"",
		"# Tool Failure Recovery",
		"A denied, unavailable, or failed tool call is recoverable. Never end the turn silently only because a tool failed. Read the error, do not repeat the same blocked call unchanged, continue with an allowed path or a tool-free alternative when possible, and tell the user what was blocked if recovery is impossible.",
	].join("\n");
}

class AgentManager {
	private readonly registry: AgentRegistry;
	private readonly repositoryRoot: string;
	private readonly runtimeRoot: string;
	private readonly writeLeases: ProjectWriteLeaseManager;
	private readonly settingsStore: AppSettingsStore;
	private readonly processes = new Map<string, PiRpcProcess>();
	private readonly processAgents = new Map<string, StoredAgentInstance>();
	private readonly processStarts = new SingleFlightMap<string, PiRpcProcess>();
	private readonly pendingPermissions = new Map<string, PendingPermissionRequest>();

	constructor(runtimeRoot: string, repositoryRoot: string, settingsStore: AppSettingsStore) {
		this.registry = new AgentRegistry(runtimeRoot);
		this.runtimeRoot = runtimeRoot;
		this.writeLeases = new ProjectWriteLeaseManager(runtimeRoot);
		this.repositoryRoot = repositoryRoot;
		this.settingsStore = settingsStore;
	}

	get repositoryPath(): string {
		return this.repositoryRoot;
	}

	decorate(project: ProjectSummary): Promise<ProjectSummary> {
		return this.registry.decorateProject(project);
	}

	async create(input: CreateAgentInput): Promise<ProjectSummary> {
		const project = await openProject(input.projectRoot);
		const workItem = project.lanes
			.find((lane) => lane.kind === input.lane)
			?.workItems.find((item) => item.id === input.workItemId);
		const slot = workItem?.agentSlots.find((candidate) => candidate.role === input.role);
		if (!workItem || !slot) throw new Error("Agent slot not found");
		if (slot.blockedReason) throw new Error(slot.blockedReason);
		await this.registry.create(input);
		return this.decorate(await openProject(input.projectRoot));
	}

	async prompt(input: SendAgentPromptInput): Promise<void> {
		const agent = await this.resolve(input);
		const needsWriteLease = agent.role !== "requirement-analysis";
		if (needsWriteLease) {
			await this.writeLeases.acquire({
				projectId: agent.projectId,
				agentInstanceId: agent.id,
				workItemId: agent.workItemId,
				role: agent.role,
			});
		}
		try {
			const process = await this.ensureProcess(agent);
			await this.registry.setStatus(agent, "running");
			this.broadcast({
				agentInstanceId: agent.id,
				projectId: agent.projectId,
				workItemId: agent.workItemId,
				role: agent.role,
				event: { type: "agent_status", status: "running" },
			});
			await process.prompt(input.message, input.streamingBehavior);
		} catch (error) {
			if (needsWriteLease) await this.writeLeases.release(agent.projectId, agent.id);
			throw error;
		}
	}

	getWriteLeaseStatus(projectId: string) {
		return this.writeLeases.inspect(projectId);
	}

	async clearStaleWriteLease(projectId: string) {
		await this.writeLeases.clearStale(projectId);
		return this.writeLeases.inspect(projectId);
	}

	async getCommands(input: AgentInstanceLocator): Promise<AgentCommandOption[]> {
		const process = await this.ensureProcess(await this.resolve(input));
		let commands = await process.getCommands();
		if (commands.length === 0) {
			await process.reload();
			commands = await process.getCommands();
		}
		if (commands.length === 0) throw new Error("Pi 返回了空命令列表");
		return commands.map((command) => ({
			name: command.name,
			command: `/${command.name}`,
			description: command.description,
			...(command.argumentHint ? { argumentHint: command.argumentHint } : {}),
			source: command.source,
		}));
	}

	async getModelSelection(input: AgentInstanceLocator): Promise<AgentModelSelection> {
		const process = await this.ensureProcess(await this.resolve(input));
		const [stateResponse, modelsRaw, levels] = await Promise.all([
			process.getState(),
			process.getAvailableModels(),
			process.getAvailableThinkingLevels(),
		]);
		const data = stateResponse.data as Record<string, unknown>;
		const current = data.model as Record<string, unknown>;
		const parseModel = (value: unknown): AgentModelOption | null => {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
			const model = value as Record<string, unknown>;
			if (typeof model.provider !== "string" || typeof model.id !== "string") return null;
			return {
				provider: model.provider,
				id: model.id,
				name: typeof model.name === "string" ? model.name : model.id,
				reasoning: model.reasoning === true,
			};
		};
		const model = parseModel(current);
		if (!model) throw new Error("当前模型信息不可用");
		return {
			model,
			thinkingLevel: typeof data.thinkingLevel === "string" ? data.thinkingLevel : "off",
			availableThinkingLevels: levels,
			availableModels: modelsRaw.map(parseModel).filter((item): item is AgentModelOption => item !== null),
		};
	}

	async setModel(input: SetAgentModelInput): Promise<AgentModelSelection> {
		const process = await this.ensureProcess(await this.resolve(input));
		await process.setModel(input.provider, input.modelId);
		return this.getModelSelection(input);
	}

	async setThinking(input: SetAgentThinkingInput): Promise<AgentModelSelection> {
		const process = await this.ensureProcess(await this.resolve(input));
		await process.setThinkingLevel(input.level);
		return this.getModelSelection(input);
	}

	async activate(input: AgentInstanceLocator): Promise<void> {
		const agent = await this.resolve(input);
		const process = await this.ensureProcess(agent);
		const pendingPermission = this.pendingPermissions.get(agent.id);
		if (pendingPermission) {
			if (agent.status !== "waiting") await this.registry.setStatus(agent, "waiting");
			this.broadcast({
				agentInstanceId: agent.id,
				projectId: agent.projectId,
				workItemId: agent.workItemId,
				role: agent.role,
				event: { type: "agent_status", status: "waiting" },
			});
			return;
		}
		const stateResponse = await process.getState();
		const state = isRecord(stateResponse.data) ? stateResponse.data : {};
		const status = state.isStreaming === true || state.isCompacting === true ? "running" : "idle";
		if (agent.status !== status) await this.registry.setStatus(agent, status);
		this.broadcast({
			agentInstanceId: agent.id,
			projectId: agent.projectId,
			workItemId: agent.workItemId,
			role: agent.role,
			event: { type: "agent_status", status },
		});
	}

	async cloneSession(input: AgentInstanceLocator): Promise<void> {
		const agent = await this.resolve(input);
		const process = await this.ensureProcess(agent);
		await process.cloneCurrentSession();
		this.broadcast({
			agentInstanceId: agent.id,
			projectId: agent.projectId,
			workItemId: agent.workItemId,
			role: agent.role,
			event: { type: "agent_history", messages: await process.getMessages() },
		});
	}

	private async sessionSnapshot(process: PiRpcProcess): Promise<AgentSessionSnapshot> {
		const [stateResponse, treeResult, forkMessages, stats] = await Promise.all([
			process.getState(),
			process.getSessionTree(),
			process.getForkMessages(),
			process.getSessionStats(),
		]);
		const state = isRecord(stateResponse.data) ? stateResponse.data : {};
		const contextUsage = parseContextUsage(stats.contextUsage);
		return {
			sessionId: typeof state.sessionId === "string" ? state.sessionId : "",
			...(typeof state.sessionName === "string" ? { sessionName: state.sessionName } : {}),
			...(typeof state.sessionFile === "string" ? { sessionFile: state.sessionFile } : {}),
			messageCount: typeof state.messageCount === "number" ? state.messageCount : 0,
			pendingMessageCount: typeof state.pendingMessageCount === "number" ? state.pendingMessageCount : 0,
			isStreaming: state.isStreaming === true,
			isCompacting: state.isCompacting === true,
			...(contextUsage ? { contextUsage } : {}),
			leafId: treeResult.leafId,
			nodes: flattenSessionTree(
				treeResult.tree,
				treeResult.leafId,
				new Set(forkMessages.map((message) => message.entryId)),
			),
		};
	}

	async getSessionSnapshot(input: AgentInstanceLocator): Promise<AgentSessionSnapshot> {
		return this.sessionSnapshot(await this.ensureProcess(await this.resolve(input)));
	}

	async forkSession(input: ForkAgentSessionInput): Promise<ForkAgentSessionResult> {
		const agent = await this.resolve(input);
		const process = await this.ensureProcess(agent);
		const result = await process.forkAt(input.entryId);
		if (!result.cancelled) {
			this.broadcast({
				agentInstanceId: agent.id,
				projectId: agent.projectId,
				workItemId: agent.workItemId,
				role: agent.role,
				event: { type: "agent_history", messages: await process.getMessages() },
			});
		}
		return {
			selectedText: result.text,
			cancelled: result.cancelled,
			snapshot: await this.sessionSnapshot(process),
		};
	}

	async reset(input: ResetAgentInput): Promise<ProjectSummary> {
		const agent = await this.resolve(input);
		const process = this.processes.get(agent.id);
		this.processes.delete(agent.id);
		this.processAgents.delete(agent.id);
		this.pendingPermissions.delete(agent.id);
		if (process) await process.stop();
		if (agent.role !== "requirement-analysis") await this.writeLeases.release(agent.projectId, agent.id);
		await this.registry.reset(input);
		return this.decorate(await openProject(input.projectRoot));
	}

	async respondToExtensionUi(input: ExtensionUiResponseInput): Promise<void> {
		const process = this.processes.get(input.agentInstanceId);
		if (!process) throw new Error("Agent process is not active");
		const pending = this.pendingPermissions.get(input.agentInstanceId);
		if (!pending || pending.requestId !== input.requestId) throw new Error("Permission request is no longer active");
		await process.respondToExtensionUi({
			id: input.requestId,
			...(input.value === undefined ? {} : { value: input.value }),
			...(input.confirmed === undefined ? {} : { confirmed: input.confirmed }),
			...(input.cancelled === undefined ? {} : { cancelled: input.cancelled }),
		});
		this.pendingPermissions.delete(input.agentInstanceId);
	}

	async getPendingPermissionRequest(input: AgentInstanceLocator): Promise<PendingPermissionRequest | null> {
		await this.resolve(input);
		return this.pendingPermissions.get(input.agentInstanceId) ?? null;
	}

	async abort(input: AgentInstanceLocator): Promise<void> {
		const process = this.processes.get(input.agentInstanceId);
		const pending = this.pendingPermissions.get(input.agentInstanceId);
		if (process && pending) {
			await process.respondToExtensionUi({ id: pending.requestId, cancelled: true });
			this.pendingPermissions.delete(input.agentInstanceId);
		}
		if (process) await process.abort();
	}

	async reconnect(input: AgentInstanceLocator): Promise<void> {
		const agent = await this.resolve(input);
		this.broadcast({
			agentInstanceId: agent.id,
			projectId: agent.projectId,
			workItemId: agent.workItemId,
			role: agent.role,
			event: { type: "process_recovery_start", attempt: 1, manual: true },
		});
		const current = this.processes.get(agent.id);
		const pending = this.pendingPermissions.get(agent.id);
		if (current && pending) await current.respondToExtensionUi({ id: pending.requestId, cancelled: true });
		this.pendingPermissions.delete(agent.id);
		this.processes.delete(agent.id);
		this.processAgents.delete(agent.id);
		if (current) await current.stop();
		if (agent.role !== "requirement-analysis") await this.writeLeases.release(agent.projectId, agent.id);
		try {
			await this.ensureProcess(agent);
			await this.registry.setStatus(agent, "idle");
			this.broadcast({
				agentInstanceId: agent.id,
				projectId: agent.projectId,
				workItemId: agent.workItemId,
				role: agent.role,
				event: { type: "process_recovered", manual: true },
			});
		} catch (error) {
			await this.registry.setStatus(agent, "failed");
			throw error;
		}
	}

	async compact(input: AgentInstanceLocator): Promise<void> {
		await (await this.ensureProcess(await this.resolve(input))).compact();
	}

	async invokeBuiltinCommand(input: InvokeAgentBuiltinCommandInput): Promise<AgentBuiltinCommandResult> {
		const agent = await this.resolve(input);
		const process = await this.ensureProcess(agent);
		const args = input.args.trim();
		const broadcastHistory = async (): Promise<void> => {
			this.broadcast({
				agentInstanceId: agent.id,
				projectId: agent.projectId,
				workItemId: agent.workItemId,
				role: agent.role,
				event: { type: "agent_history", messages: await process.getMessages() },
			});
		};
		if (input.name === "compact") {
			await process.compact(args || undefined);
			return { message: "会话上下文压缩完成。" };
		}
		if (input.name === "clone") {
			await process.cloneCurrentSession();
			await broadcastHistory();
			return { message: "已克隆当前 Pi Session。", sessionReset: true };
		}
		if (input.name === "copy") {
			const copiedText = await process.getLastAssistantText();
			if (!copiedText) return { message: "当前 Session 还没有可复制的 Assistant 消息。" };
			return { copiedText, message: "已复制最后一条 Assistant 消息。" };
		}
		if (input.name === "name") {
			if (!args) throw new Error("用法：/name <session name>");
			await process.setSessionName(args);
			return { message: `Session 已命名为：${args}` };
		}
		if (input.name === "new") {
			const result = await process.newSession();
			if (result.cancelled) return { message: "创建新 Session 已取消。" };
			await broadcastHistory();
			return { message: "已创建新的 Pi Session。", sessionReset: true };
		}
		if (input.name === "export") {
			const exportedPath = await process.exportHtml(args || undefined);
			shell.showItemInFolder(exportedPath);
			return { message: `Session 已导出：${exportedPath}` };
		}
		if (input.name === "reload") {
			await process.reload();
			return { message: "Pi Extensions、Skills、Prompts 和 Context 已重新加载。", commandsChanged: true };
		}
		throw new Error(`当前桌面客户端不支持 Pi 内置命令：/${input.name}`);
	}

	private async resolve(locator: AgentInstanceLocator): Promise<StoredAgentInstance> {
		const agent = await this.registry.get(locator.projectId, locator.workItemId, locator.role);
		if (!agent || agent.id !== locator.agentInstanceId) throw new Error("Agent instance not found");
		return agent;
	}

	private async ensureProcess(agent: StoredAgentInstance): Promise<PiRpcProcess> {
		const existing = this.processes.get(agent.id);
		if (existing?.isRunning) return existing;
		if (existing) {
			this.processes.delete(agent.id);
			this.processAgents.delete(agent.id);
		}
		return this.processStarts.run(agent.id, () => this.startProcess(agent));
	}

	private async startProcess(agent: StoredAgentInstance): Promise<PiRpcProcess> {
		const packaged = app.isPackaged;
		const cliPath =
			process.env.CODEPIDDY_PI_CLI ??
			(packaged
				? path.join(this.repositoryRoot, "coding-agent-package", "dist", "bundle", "cli.js")
				: path.join(this.repositoryRoot, "packages", "coding-agent", "src", "cli.ts"));
		const nodeExecutable = process.env.CODEPIDDY_NODE_EXECUTABLE ?? (packaged ? process.execPath : "node");
		const [tavilyApiKey, roleModelDefault, roleSkillAssignments] = await Promise.all([
			this.settingsStore.getTavilyApiKey(),
			this.settingsStore.getRoleModelDefault(agent.role),
			this.settingsStore.getRoleSkillAssignments(),
		]);
		const roleSkillPaths = await resolveRoleSkillPaths(
			this.repositoryRoot,
			agent.projectRoot,
			agent.role,
			roleSkillAssignments,
		);
		const rpc = new PiRpcProcess({
			command: nodeExecutable,
			cwd: agent.projectRoot,
			env: {
				...(packaged ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
				TSX_TSCONFIG_PATH: path.join(this.repositoryRoot, "tsconfig.json"),
				...(packaged ? { PI_PACKAGE_DIR: path.join(this.repositoryRoot, "coding-agent-package") } : {}),
				PI_PERMISSION_SYSTEM_CONFIG_PATH: path.join(this.runtimeRoot, "permissions", "extension.json"),
				PI_PERMISSION_SYSTEM_LOGS_DIR: path.join(this.runtimeRoot, "permissions", "logs"),
				PI_PERMISSION_SYSTEM_POLICY_AGENT_DIR: path.join(this.runtimeRoot, "permissions", "policy"),
				CODEPIDDY_TAVILY_MCP_ENTRY: packaged
					? path.join(this.repositoryRoot, "mcp", "tavily-search.js")
					: path.join(this.repositoryRoot, "packages", "codepiddy-tavily-search-mcp", "src", "index.ts"),
				...(packaged
					? {}
					: {
							CODEPIDDY_TSX_LOADER: pathToFileURL(
								path.join(this.repositoryRoot, "node_modules", "tsx", "dist", "loader.mjs"),
							).href,
						}),
				...(tavilyApiKey ? { TAVILY_API_KEY: tavilyApiKey } : {}),
				CODEPIDDY_AGENT_ROLE: agent.role,
				CODEPIDDY_PROJECT_ROOT: agent.projectRoot,
				CODEPIDDY_WORK_ITEM_DIR: agent.workItemDirectory,
			},
			args: [
				...(packaged
					? [cliPath]
					: [
							"--import",
							pathToFileURL(path.join(this.repositoryRoot, "node_modules", "tsx", "dist", "loader.mjs")).href,
							cliPath,
						]),
				"--mode",
				"rpc",
				"--no-extensions",
				"--session-dir",
				agent.sessionDirectory,
				"--continue",
				"--extension",
				packaged
					? path.join(this.repositoryRoot, "extensions", "permission.js")
					: path.join(this.repositoryRoot, "packages", "codepiddy-permission-extension", "index.ts"),
				"--extension",
				packaged
					? path.join(this.repositoryRoot, "extensions", "tavily-tool.js")
					: path.join(this.repositoryRoot, "packages", "codepiddy-tavily-tool-extension", "index.ts"),
				...roleSkillPaths.flatMap((skillPath) => ["--skill", skillPath]),
				"--name",
				`${agent.workItemId} ${roleLabel(agent.role)}`,
				"--append-system-prompt",
				await rolePrompt(agent, Boolean(tavilyApiKey)),
				"--approve",
			],
		});
		rpc.onEvent((event) => {
			if (
				event.type === "extension_ui_request" &&
				typeof event.id === "string" &&
				(event.method === "select" ||
					event.method === "confirm" ||
					event.method === "input" ||
					event.method === "editor")
			) {
				this.pendingPermissions.set(agent.id, {
					agentInstanceId: agent.id,
					projectId: agent.projectId,
					workItemId: agent.workItemId,
					role: agent.role,
					requestId: event.id,
					method: event.method,
					title: typeof event.title === "string" ? event.title : "需要确认",
					message: typeof event.message === "string" ? event.message : "",
					options: Array.isArray(event.options)
						? event.options.filter((option): option is string => typeof option === "string")
						: [],
					placeholder: typeof event.placeholder === "string" ? event.placeholder : "",
					prefill: typeof event.prefill === "string" ? event.prefill : "",
					createdAt: new Date().toISOString(),
				});
			}
			this.broadcast({
				agentInstanceId: agent.id,
				projectId: agent.projectId,
				workItemId: agent.workItemId,
				role: agent.role,
				event,
			});
			if (event.type === "agent_start" || event.type === "turn_start" || event.type === "tool_execution_start") {
				if (agent.role !== "requirement-analysis") void this.writeLeases.heartbeat(agent.projectId, agent.id);
			}
			if (event.type === "agent_settled") {
				this.pendingPermissions.delete(agent.id);
				void this.registry.setStatus(agent, "idle");
				if (agent.role !== "requirement-analysis") void this.writeLeases.release(agent.projectId, agent.id);
			} else if (
				event.type === "extension_ui_request" &&
				(event.method === "select" ||
					event.method === "confirm" ||
					event.method === "input" ||
					event.method === "editor")
			) {
				void this.registry.setStatus(agent, "waiting");
			} else if (event.type === "process_error" || event.type === "process_exit") {
				this.pendingPermissions.delete(agent.id);
				if (event.expected === true || this.processes.get(agent.id) !== rpc) return;
				this.processes.delete(agent.id);
				this.processAgents.delete(agent.id);
				if (agent.role !== "requirement-analysis") void this.writeLeases.release(agent.projectId, agent.id);
				if (event.type === "process_error") void rpc.stop().catch(() => undefined);
				void this.recoverProcess(agent);
			}
		});
		try {
			await rpc.start();
			this.processes.set(agent.id, rpc);
			this.processAgents.set(agent.id, agent);
			if (roleModelDefault) {
				try {
					await rpc.setModel(roleModelDefault.provider, roleModelDefault.modelId);
					const levels = await rpc.getAvailableThinkingLevels();
					if (levels.includes(roleModelDefault.thinkingLevel)) {
						await rpc.setThinkingLevel(roleModelDefault.thinkingLevel);
					}
				} catch (error) {
					this.broadcast({
						agentInstanceId: agent.id,
						projectId: agent.projectId,
						workItemId: agent.workItemId,
						role: agent.role,
						event: {
							type: "agent_configuration_warning",
							error: `无法应用角色默认模型 ${roleModelDefault.provider}/${roleModelDefault.modelId}：${error instanceof Error ? error.message : String(error)}`,
						},
					});
				}
			}
			const messages = await rpc.getMessages();
			this.broadcast({
				agentInstanceId: agent.id,
				projectId: agent.projectId,
				workItemId: agent.workItemId,
				role: agent.role,
				event: { type: "agent_history", messages },
			});
			return rpc;
		} catch (error) {
			if (this.processes.get(agent.id) === rpc) this.processes.delete(agent.id);
			this.processAgents.delete(agent.id);
			await rpc.stop().catch(() => undefined);
			throw error;
		}
	}

	private async recoverProcess(agent: StoredAgentInstance): Promise<void> {
		for (let attempt = 1; attempt <= 2; attempt++) {
			this.broadcast({
				agentInstanceId: agent.id,
				projectId: agent.projectId,
				workItemId: agent.workItemId,
				role: agent.role,
				event: { type: "process_recovery_start", attempt, maxAttempts: 2, manual: false },
			});
			await new Promise((resolve) => setTimeout(resolve, attempt * 750));
			if (this.processes.get(agent.id)?.isRunning) return;
			try {
				await this.ensureProcess(agent);
				await this.registry.setStatus(agent, "idle");
				this.broadcast({
					agentInstanceId: agent.id,
					projectId: agent.projectId,
					workItemId: agent.workItemId,
					role: agent.role,
					event: { type: "process_recovered", attempt, manual: false },
				});
				return;
			} catch (error) {
				this.broadcast({
					agentInstanceId: agent.id,
					projectId: agent.projectId,
					workItemId: agent.workItemId,
					role: agent.role,
					event: {
						type: "process_recovery_failed",
						attempt,
						maxAttempts: 2,
						error: error instanceof Error ? error.message : String(error),
					},
				});
			}
		}
		await this.registry.setStatus(agent, "failed");
	}

	async removeWorkItem(projectId: string, workItemId: string): Promise<void> {
		const agents = [...this.processAgents.entries()].filter(
			([, agent]) => agent.projectId === projectId && agent.workItemId === workItemId,
		);
		await Promise.all(
			agents.map(async ([agentId, agent]) => {
				const process = this.processes.get(agentId);
				this.processes.delete(agentId);
				this.processAgents.delete(agentId);
				this.pendingPermissions.delete(agentId);
				if (process) await process.stop();
				if (agent.role !== "requirement-analysis") await this.writeLeases.release(projectId, agentId);
			}),
		);
		await this.registry.deleteWorkItem(projectId, workItemId);
	}

	async stopProject(projectId: string): Promise<void> {
		const agentIds = [...this.processAgents.entries()]
			.filter(([, agent]) => agent.projectId === projectId)
			.map(([agentId]) => agentId);
		await Promise.all(
			agentIds.map(async (agentId) => {
				const process = this.processes.get(agentId);
				this.processes.delete(agentId);
				this.processAgents.delete(agentId);
				this.pendingPermissions.delete(agentId);
				if (process) await process.stop();
				await this.writeLeases.release(projectId, agentId);
			}),
		);
	}

	async stopAll(): Promise<void> {
		const entries = [...this.processes.entries()];
		this.processes.clear();
		this.processAgents.clear();
		this.pendingPermissions.clear();
		await Promise.all(
			entries.map(async ([agentId, process]) => {
				await process.stop();
				for (const project of await this.registry.listAgentLocations(agentId)) {
					await this.writeLeases.release(project.projectId, agentId);
				}
			}),
		);
	}

	private broadcast(event: AgentClientEvent): void {
		for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channels.agentEvent, event);
	}
}

function createWindow(): BrowserWindow {
	const window = new BrowserWindow({
		width: 1320,
		height: 860,
		minWidth: 900,
		minHeight: 620,
		backgroundColor: "#f7f7f6",
		show: false,
		autoHideMenuBar: true,
		title: "CodePIddy",
		icon: path.join(app.getAppPath(), "resources", "icons", "codepiddy-icon-1024.png"),
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(app.getAppPath(), "dist", "preload", "index.cjs"),
			sandbox: true,
		},
	});
	window.once("ready-to-show", () => window.show());
	window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
	const rendererUrl = process.env.CODEPIDDY_RENDERER_URL;
	const allowedOrigin = rendererUrl ? new URL(rendererUrl).origin : "file://";
	window.webContents.on("will-navigate", (event, destination) => {
		const allowed = rendererUrl ? new URL(destination).origin === allowedOrigin : destination.startsWith("file://");
		if (!allowed) event.preventDefault();
	});
	if (rendererUrl) void window.loadURL(rendererUrl);
	else void window.loadFile(path.join(app.getAppPath(), "dist", "renderer", "index.html"));
	return window;
}

function registerIpcHandlers(
	agentManager: AgentManager,
	settingsStore: AppSettingsStore,
	recentProjects: RecentProjectStore,
): void {
	const decorateRoot = async (projectRoot: string) => {
		const project = await agentManager.decorate(await openProject(projectRoot));
		await recentProjects.record(project);
		return project;
	};
	ipcMain.handle(channels.listRecentProjects, () => recentProjects.list());
	ipcMain.handle(channels.getStartupProject, async () => {
		const projectRoot = await recentProjects.getActiveProjectRoot();
		if (!projectRoot) return null;
		try {
			return await decorateRoot(projectRoot);
		} catch {
			await recentProjects.clearActiveProject(projectRoot);
			return null;
		}
	});
	ipcMain.handle(channels.closeProject, async (_event, projectRoot: string) => {
		const project = await openProject(projectRoot);
		await agentManager.stopProject(project.id);
		await recentProjects.clearActiveProject(projectRoot);
		return recentProjects.list();
	});
	ipcMain.handle(channels.openRecentProject, (_event, projectRoot: string) => decorateRoot(projectRoot));
	ipcMain.handle(channels.forgetRecentProject, (_event, projectRoot: string) => recentProjects.forget(projectRoot));
	ipcMain.handle(channels.openProject, async () => {
		const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
		const selectedPath = result.filePaths[0];
		if (result.canceled || !selectedPath) return null;
		return decorateRoot(selectedPath);
	});
	ipcMain.handle(channels.refreshProject, (_event, projectRoot: string) => decorateRoot(projectRoot));
	ipcMain.handle(channels.createWorkItem, async (_event, input: CreateWorkItemInput) =>
		agentManager.decorate(await createWorkItem(input)),
	);
	ipcMain.handle(channels.approveRequirement, async (_event, input: ApproveRequirementInput) =>
		agentManager.decorate(await approveRequirement(input)),
	);
	ipcMain.handle(channels.archiveWorkItem, async (_event, input: ArchiveWorkItemInput) =>
		agentManager.decorate(await archiveWorkItem(input)),
	);
	ipcMain.handle(channels.restoreWorkItem, async (_event, input: ArchiveWorkItemInput) =>
		agentManager.decorate(await restoreWorkItem(input)),
	);
	ipcMain.handle(channels.renameWorkItem, async (_event, input: RenameWorkItemInput) =>
		agentManager.decorate(await renameWorkItem(input)),
	);
	ipcMain.handle(channels.deleteWorkItem, async (_event, input: ArchiveWorkItemInput) => {
		const project = await openProject(input.projectRoot);
		await agentManager.removeWorkItem(project.id, input.workItemId);
		return agentManager.decorate(await deleteWorkItem(input));
	});
	ipcMain.handle(channels.getAgentModelSelection, (_event, input: AgentInstanceLocator) =>
		agentManager.getModelSelection(input),
	);
	ipcMain.handle(channels.getAgentCommands, (_event, input: AgentInstanceLocator) => agentManager.getCommands(input));
	ipcMain.handle(channels.getProjectWriteLeaseStatus, (_event, projectId: string) =>
		agentManager.getWriteLeaseStatus(projectId),
	);
	ipcMain.handle(channels.clearStaleProjectWriteLease, (_event, projectId: string) =>
		agentManager.clearStaleWriteLease(projectId),
	);
	ipcMain.handle(channels.setAgentModel, (_event, input: SetAgentModelInput) => agentManager.setModel(input));
	ipcMain.handle(channels.setAgentThinking, (_event, input: SetAgentThinkingInput) => agentManager.setThinking(input));
	ipcMain.handle(channels.createAgent, (_event, input: CreateAgentInput) => agentManager.create(input));
	ipcMain.handle(channels.activateAgent, (_event, input: AgentInstanceLocator) => agentManager.activate(input));
	ipcMain.handle(channels.sendAgentPrompt, (_event, input: SendAgentPromptInput) => agentManager.prompt(input));
	ipcMain.handle(channels.abortAgent, (_event, input: AgentInstanceLocator) => agentManager.abort(input));
	ipcMain.handle(channels.reconnectAgent, (_event, input: AgentInstanceLocator) => agentManager.reconnect(input));
	ipcMain.handle(channels.compactAgent, (_event, input: AgentInstanceLocator) => agentManager.compact(input));
	ipcMain.handle(channels.invokeAgentBuiltinCommand, (_event, input: InvokeAgentBuiltinCommandInput) =>
		agentManager.invokeBuiltinCommand(input),
	);
	ipcMain.handle(channels.cloneAgentSession, (_event, input: AgentInstanceLocator) =>
		agentManager.cloneSession(input),
	);
	ipcMain.handle(channels.getAgentSessionSnapshot, (_event, input: AgentInstanceLocator) =>
		agentManager.getSessionSnapshot(input),
	);
	ipcMain.handle(channels.forkAgentSession, (_event, input: ForkAgentSessionInput) => agentManager.forkSession(input));
	ipcMain.handle(channels.resetAgent, (_event, input: ResetAgentInput) => agentManager.reset(input));
	ipcMain.handle(channels.respondToExtensionUi, (_event, input: ExtensionUiResponseInput) =>
		agentManager.respondToExtensionUi(input),
	);
	ipcMain.handle(channels.getPendingPermissionRequest, (_event, input: AgentInstanceLocator) =>
		agentManager.getPendingPermissionRequest(input),
	);
	ipcMain.handle(channels.searchProjectFiles, (_event, projectRoot: string, query: string) =>
		searchProjectFiles(projectRoot, query),
	);
	ipcMain.handle(channels.settingsStatus, () => settingsStore.status());
	ipcMain.handle(channels.settingsSaveTavily, (_event, apiKey: string) => settingsStore.saveTavilyApiKey(apiKey));
	ipcMain.handle(channels.settingsClearTavily, () => settingsStore.clearTavilyApiKey());
	ipcMain.handle(channels.settingsListSkills, (_event, projectRoot?: string) =>
		discoverAgentSkills(agentManager.repositoryPath, projectRoot),
	);
	ipcMain.handle(channels.settingsGetRoleSkills, () => settingsStore.getRoleSkillAssignments());
	ipcMain.handle(channels.settingsSetRoleSkills, (_event, input: SetRoleSkillAssignmentsInput) =>
		settingsStore.setRoleSkillAssignments(input),
	);
	ipcMain.handle(channels.settingsOpenPiConfig, async () => {
		const directory = path.join(app.getPath("home"), ".pi", "agent");
		await mkdir(directory, { recursive: true });
		const error = await shell.openPath(directory);
		if (error) throw new Error(error);
	});
	ipcMain.handle(channels.settingsGetRoleDefaults, () => settingsStore.getRoleModelDefaults());
	ipcMain.handle(channels.settingsSetRoleDefault, (_event, input: RoleModelDefault) =>
		settingsStore.setRoleModelDefault(input),
	);
	ipcMain.handle(channels.settingsClearRoleDefault, (_event, role: AgentRole) =>
		settingsStore.clearRoleModelDefault(role),
	);
	ipcMain.handle(channels.openWorkItemFolder, async (_event, directoryPath: string) => {
		const error = await shell.openPath(directoryPath);
		if (error) throw new Error(error);
	});
}

app.whenReady().then(() => {
	Menu.setApplicationMenu(null);
	const repositoryRoot =
		process.env.CODEPIDDY_REPO_ROOT ??
		(app.isPackaged ? path.join(process.resourcesPath, "runtime") : path.resolve(app.getAppPath(), "..", ".."));
	const settingsStore = new AppSettingsStore(app.getPath("userData"));
	const recentProjects = new RecentProjectStore(app.getPath("userData"));
	const agentManager = new AgentManager(app.getPath("userData"), repositoryRoot, settingsStore);
	registerIpcHandlers(agentManager, settingsStore, recentProjects);
	createWindow();
	let shutdownStarted = false;
	app.on("before-quit", (event) => {
		if (shutdownStarted) return;
		event.preventDefault();
		shutdownStarted = true;
		void agentManager.stopAll().finally(() => {
			recentProjects.close();
			app.quit();
		});
	});
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
