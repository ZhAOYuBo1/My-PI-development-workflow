export const LANE_KINDS = ["requirements", "bugs"] as const;
export type LaneKind = (typeof LANE_KINDS)[number];

export const WORK_ITEM_STATUSES = ["active", "archived"] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const AGENT_ROLES = ["requirement-analysis", "coding", "bug-fix", "review"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_STATUSES = ["not-created", "idle", "running", "waiting", "completed", "failed"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export interface AgentSlotSummary {
	role: AgentRole;
	displayName: string;
	status: AgentStatus;
	currentInstanceId?: string;
	kickoffPrompt?: string;
	blockedReason?: string;
}

export interface WorkItemSummary {
	id: string;
	lane: LaneKind;
	title: string;
	description: string;
	status: WorkItemStatus;
	createdAt: string;
	archivedAt?: string;
	requirementApprovedAt?: string;
	directoryPath: string;
	agentSlots: AgentSlotSummary[];
}

export interface LaneSummary {
	kind: LaneKind;
	displayName: string;
	workItems: WorkItemSummary[];
}

export interface ProjectSummary {
	id: string;
	name: string;
	rootPath: string;
	codepiddyPath: string;
	lanes: LaneSummary[];
}

export interface CreateWorkItemInput {
	projectRoot: string;
	lane: LaneKind;
	title: string;
	description: string;
}

export interface ApproveRequirementInput {
	projectRoot: string;
	workItemId: string;
}

export interface ArchiveWorkItemInput {
	projectRoot: string;
	lane: LaneKind;
	workItemId: string;
}

export interface RenameWorkItemInput extends ArchiveWorkItemInput {
	title: string;
}

export type PersistedSelectionType = "project" | "lane" | "work-item" | "agent" | "settings";

export interface ProjectUiState {
	projectRoot: string;
	selectionType: PersistedSelectionType;
	lane?: LaneKind;
	workItemId?: string;
	role?: AgentRole;
	expandedKeys: string[];
}

export interface AgentUiState {
	agentInstanceId: string;
	draft: string;
	scrollTop: number;
	unreadCount: number;
}

export interface ProjectClientApi {
	openProject(): Promise<ProjectSummary | null>;
	getStartupProject(): Promise<ProjectSummary | null>;
	closeProject(projectRoot: string): Promise<RecentProject[]>;
	refreshProject(projectRoot: string): Promise<ProjectSummary>;
	createWorkItem(input: CreateWorkItemInput): Promise<ProjectSummary>;
	approveRequirement(input: ApproveRequirementInput): Promise<ProjectSummary>;
	archiveWorkItem(input: ArchiveWorkItemInput): Promise<ProjectSummary>;
	restoreWorkItem(input: ArchiveWorkItemInput): Promise<ProjectSummary>;
	renameWorkItem(input: RenameWorkItemInput): Promise<ProjectSummary>;
	deleteWorkItem(input: ArchiveWorkItemInput): Promise<ProjectSummary>;
	openWorkItemFolder(input: ArchiveWorkItemInput): Promise<void>;
	getProjectUiState(projectRoot: string): Promise<ProjectUiState | null>;
	saveProjectUiState(state: ProjectUiState): Promise<void>;
	getAgentUiState(agentInstanceId: string): Promise<AgentUiState | null>;
	saveAgentUiState(state: AgentUiState): Promise<void>;
}

export interface AgentInstanceSummary {
	id: string;
	projectId: string;
	workItemId: string;
	lane: LaneKind;
	role: AgentRole;
	status: Exclude<AgentStatus, "not-created">;
	sessionDirectory: string;
	createdAt: string;
}

export interface CreateAgentInput {
	projectRoot: string;
	projectId: string;
	workItemId: string;
	workItemDirectory: string;
	lane: LaneKind;
	role: AgentRole;
}

export interface AgentInstanceLocator {
	agentInstanceId: string;
	projectId: string;
	workItemId: string;
	role: AgentRole;
}

export interface InvokeAgentBuiltinCommandInput extends AgentInstanceLocator {
	name: string;
	args: string;
}

export interface AgentBuiltinCommandResult {
	message?: string;
	copiedText?: string;
	sessionReset?: boolean;
	commandsChanged?: boolean;
}

export const AGENT_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type AgentImageMimeType = (typeof AGENT_IMAGE_MIME_TYPES)[number];

export interface AgentImageAttachment {
	id: string;
	name: string;
	mimeType: AgentImageMimeType;
	data: string;
}

export interface SendAgentPromptInput extends AgentInstanceLocator {
	message: string;
	images?: AgentImageAttachment[];
	streamingBehavior?: "steer" | "followUp";
}

export interface ResetAgentInput extends CreateAgentInput {
	agentInstanceId: string;
}

export interface AgentSessionNode {
	entryId: string;
	parentId: string | null;
	type: string;
	role?: string;
	label?: string;
	text: string;
	timestamp?: string;
	depth: number;
	isLeaf: boolean;
	forkable: boolean;
}

export interface AgentContextUsage {
	tokens: number | null;
	contextWindow: number;
	percent: number | null;
}

export interface AgentSessionSnapshot {
	sessionId: string;
	sessionName?: string;
	sessionFile?: string;
	messageCount: number;
	pendingMessageCount: number;
	isStreaming: boolean;
	isCompacting: boolean;
	contextUsage?: AgentContextUsage;
	leafId: string | null;
	nodes: AgentSessionNode[];
}

export interface ForkAgentSessionInput extends AgentInstanceLocator {
	entryId: string;
}

export interface ForkAgentSessionResult {
	selectedText: string;
	cancelled: boolean;
	snapshot: AgentSessionSnapshot;
}

export interface AgentClientEvent {
	agentInstanceId: string;
	projectId: string;
	workItemId: string;
	role: AgentRole;
	event: Record<string, unknown>;
}

export interface CodePIddyClientApi extends ProjectClientApi {
	createAgent(input: CreateAgentInput): Promise<ProjectSummary>;
	activateAgent(input: AgentInstanceLocator): Promise<void>;
	sendAgentPrompt(input: SendAgentPromptInput): Promise<void>;
	abortAgent(input: AgentInstanceLocator): Promise<void>;
	reconnectAgent(input: AgentInstanceLocator): Promise<void>;
	compactAgent(input: AgentInstanceLocator): Promise<void>;
	invokeAgentBuiltinCommand(input: InvokeAgentBuiltinCommandInput): Promise<AgentBuiltinCommandResult>;
	cloneAgentSession(input: AgentInstanceLocator): Promise<void>;
	getAgentSessionSnapshot(input: AgentInstanceLocator): Promise<AgentSessionSnapshot>;
	forkAgentSession(input: ForkAgentSessionInput): Promise<ForkAgentSessionResult>;
	resetAgent(input: ResetAgentInput): Promise<ProjectSummary>;
	respondToExtensionUi(input: ExtensionUiResponseInput): Promise<void>;
	getPendingPermissionRequest(input: AgentInstanceLocator): Promise<PendingPermissionRequest | null>;
	getSettingsStatus(): Promise<SettingsStatus>;
	getPermissionDefaults(): Promise<PermissionDefaults>;
	setPermissionDefaults(input: PermissionDefaults): Promise<PermissionDefaults>;
	saveTavilyApiKey(apiKey: string): Promise<SettingsStatus>;
	clearTavilyApiKey(): Promise<SettingsStatus>;
	listAgentSkills(projectRoot?: string): Promise<AgentSkillSummary[]>;
	getRoleSkillAssignments(): Promise<RoleSkillAssignments>;
	setRoleSkillAssignments(input: SetRoleSkillAssignmentsInput): Promise<RoleSkillAssignments>;
	openPiConfigFolder(): Promise<void>;
	getRoleModelDefaults(): Promise<RoleModelDefaults>;
	setRoleModelDefault(input: RoleModelDefault): Promise<RoleModelDefaults>;
	clearRoleModelDefault(role: AgentRole): Promise<RoleModelDefaults>;
	getAgentModelSelection(input: AgentInstanceLocator): Promise<AgentModelSelection>;
	getAgentScopedModels(input: AgentInstanceLocator): Promise<AgentScopedModel[]>;
	getAgentCommands(input: AgentInstanceLocator): Promise<AgentCommandOption[]>;
	setAgentModel(input: SetAgentModelInput): Promise<AgentModelSelection>;
	setAgentScopedModels(input: SetAgentScopedModelsInput): Promise<AgentScopedModel[]>;
	setAgentThinking(input: SetAgentThinkingInput): Promise<AgentModelSelection>;
	listRecentProjects(): Promise<RecentProject[]>;
	openRecentProject(projectRoot: string): Promise<ProjectSummary>;
	forgetRecentProject(projectRoot: string): Promise<RecentProject[]>;
	searchProjectFiles(projectRoot: string, query: string): Promise<string[]>;
	getProjectWriteLeaseStatus(projectId: string): Promise<ProjectWriteLeaseStatus>;
	clearStaleProjectWriteLease(projectId: string): Promise<ProjectWriteLeaseStatus>;
	onAgentEvent(listener: (event: AgentClientEvent) => void): () => void;
}

export interface PendingPermissionRequest extends AgentInstanceLocator {
	requestId: string;
	method: "select" | "confirm" | "input" | "editor";
	title: string;
	message: string;
	options: string[];
	placeholder: string;
	prefill: string;
	createdAt: string;
}

export interface ExtensionUiResponseInput extends AgentInstanceLocator {
	requestId: string;
	value?: string;
	confirmed?: boolean;
	cancelled?: true;
}

export interface SettingsStatus {
	tavilyApiKeyConfigured: boolean;
	encryptionAvailable: boolean;
}

export const PERMISSION_STATES = ["allow", "ask", "deny"] as const;
export type PermissionState = (typeof PERMISSION_STATES)[number];

export interface PermissionDefaults {
	read: PermissionState;
	write: PermissionState;
}

export type AgentSkillSource = "builtin" | "codex" | "agents" | "pi" | "project";

export interface AgentSkillSummary {
	id: string;
	name: string;
	description: string;
	filePath: string;
	source: AgentSkillSource;
}

export type RoleSkillAssignments = Record<AgentRole, string[]>;

export interface SetRoleSkillAssignmentsInput {
	role: AgentRole;
	skillIds: string[];
	projectRoot?: string;
}

export const CUSTOM_PROVIDER_APIS = [
	"openai-completions",
	"openai-responses",
	"anthropic-messages",
	"google-generative-ai",
] as const;
export type CustomProviderApi = (typeof CUSTOM_PROVIDER_APIS)[number];

export interface CustomProviderInput {
	id: string;
	name: string;
	baseUrl: string;
	api: CustomProviderApi;
	apiKey?: string;
	modelId: string;
	modelName: string;
	reasoning: boolean;
	contextWindow: number;
	maxTokens: number;
}

export interface CustomProviderSummary extends Omit<CustomProviderInput, "apiKey"> {
	apiKeyConfigured: boolean;
}

export interface ProviderConnectionTestResult {
	ok: boolean;
	status?: number;
	message: string;
}

export interface RecentProject {
	id: string;
	name: string;
	rootPath: string;
	lastOpenedAt: string;
	available: boolean;
}

export interface ProjectWriteLeaseDetails {
	projectId: string;
	holderAgentInstanceId: string;
	workItemId: string;
	role: AgentRole;
	acquiredAt: string;
	heartbeatAt: string;
	ownerProcessId?: number;
}

export interface ProjectWriteLeaseStatus {
	lease: ProjectWriteLeaseDetails | null;
	stale: boolean;
}

export interface RoleModelDefault {
	role: AgentRole;
	provider: string;
	modelId: string;
	modelName: string;
	thinkingLevel: string;
}

export type RoleModelDefaults = Partial<Record<AgentRole, RoleModelDefault>>;

export interface AgentCommandOption {
	name: string;
	command: string;
	description: string;
	argumentHint?: string;
	source: "builtin" | "extension" | "prompt" | "skill";
}

export interface AgentModelOption {
	provider: string;
	id: string;
	name: string;
	reasoning: boolean;
}

export interface AgentModelSelection {
	model: AgentModelOption;
	thinkingLevel: string;
	availableThinkingLevels: string[];
	availableModels: AgentModelOption[];
}

export interface SetAgentModelInput extends AgentInstanceLocator {
	provider: string;
	modelId: string;
}

export interface AgentScopedModel {
	provider: string;
	modelId: string;
	thinkingLevel?: string;
}

export interface SetAgentScopedModelsInput extends AgentInstanceLocator {
	models: AgentScopedModel[];
}

export interface SetAgentThinkingInput extends AgentInstanceLocator {
	level: string;
}
