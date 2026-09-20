import type {
	AgentClientEvent,
	AgentCommandOption,
	AgentInstanceLocator,
	AgentModelSelection,
	AgentRole,
	AgentSessionSnapshot,
	AgentSkillSummary,
	AgentSlotSummary,
	AgentStatus,
	LaneKind,
	PendingPermissionRequest,
	ProjectSummary,
	ProjectUiState,
	ProjectWriteLeaseStatus,
	RecentProject,
	RoleModelDefaults,
	RoleSkillAssignments,
	SettingsStatus,
	WorkItemSummary,
} from "@codepiddy/shared";
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileMentionMenu } from "./components/FileMentionMenu.tsx";
import { SlashCommandMenu } from "./components/SlashCommandMenu.tsx";
import { ToolCallCard } from "./components/ToolCallCard.tsx";
import { demoProject } from "./demo-project.ts";

type Selection =
	| { type: "welcome" }
	| { type: "project" }
	| { type: "settings" }
	| { type: "lane"; lane: LaneKind }
	| { type: "work-item"; lane: LaneKind; workItemId: string }
	| { type: "agent"; lane: LaneKind; workItemId: string; role: AgentSlotSummary["role"] };

function restoreSelection(project: ProjectSummary, state: ProjectUiState): Selection {
	if (state.selectionType === "settings") return { type: "settings" };
	if (state.selectionType === "lane" && state.lane && project.lanes.some((lane) => lane.kind === state.lane)) {
		return { type: "lane", lane: state.lane };
	}
	if ((state.selectionType === "work-item" || state.selectionType === "agent") && state.lane && state.workItemId) {
		const item = project.lanes
			.find((lane) => lane.kind === state.lane)
			?.workItems.find((candidate) => candidate.id === state.workItemId);
		if (item) {
			if (
				state.selectionType === "agent" &&
				state.role &&
				item.agentSlots.some((slot) => slot.role === state.role)
			) {
				return { type: "agent", lane: state.lane, workItemId: state.workItemId, role: state.role };
			}
			return { type: "work-item", lane: state.lane, workItemId: state.workItemId };
		}
	}
	return { type: "project" };
}

interface WorkItemDialogState {
	lane: LaneKind;
	title: string;
	description: string;
}

interface ArchiveToast {
	lane: LaneKind;
	workItemId: string;
	title: string;
}

interface RenameDialogState {
	lane: LaneKind;
	item: WorkItemSummary;
	title: string;
}

interface DeleteDialogState {
	lane: LaneKind;
	item: WorkItemSummary;
}

interface ResetAgentDialogState {
	workItem: WorkItemSummary;
	slot: AgentSlotSummary;
}

interface SessionPanelState {
	agentInstanceId: string;
	projectId: string;
	workItemId: string;
	role: AgentRole;
	displayName: string;
	snapshot: AgentSessionSnapshot;
}

interface ExtensionDialogState {
	agentInstanceId: string;
	projectId: string;
	workItemId: string;
	role: AgentRole;
	requestId: string;
	method: "select" | "confirm" | "input" | "editor";
	title: string;
	message: string;
	options: string[];
	placeholder: string;
	value: string;
}

type AssistantMessageStatus = "streaming" | "complete" | "aborted" | "error";

type TranscriptItem =
	| { id: string; type: "user"; text: string; delivery?: "steer" | "followUp"; createdAt?: string }
	| {
			id: string;
			type: "assistant";
			text: string;
			thinking?: string;
			status: AssistantMessageStatus;
			createdAt?: string;
	  }
	| { id: string; type: "system"; text: string; createdAt?: string }
	| {
			id: string;
			type: "tool";
			name: string;
			args: string;
			text: string;
			status: "running" | "completed";
			isError: boolean;
	  };

interface ToolRecoveryOffer {
	toolName: string;
	reason: string;
}

function extensionDialogFromPermission(request: PendingPermissionRequest): ExtensionDialogState {
	return {
		agentInstanceId: request.agentInstanceId,
		projectId: request.projectId,
		workItemId: request.workItemId,
		role: request.role,
		requestId: request.requestId,
		method: request.method,
		title: request.title,
		message: request.message,
		options: request.options,
		placeholder: request.placeholder,
		value: request.prefill,
	};
}

interface AgentActivity {
	label: string;
	kind: "working" | "tool" | "compaction" | "retry" | "waiting" | "reconnecting";
	queued: number;
}

const statusLabels: Record<AgentSlotSummary["status"], string> = {
	"not-created": "创建",
	idle: "空闲",
	running: "运行中",
	waiting: "等待",
	completed: "完成",
	failed: "失败",
};

const roleLabels: Record<AgentRole, string> = {
	"requirement-analysis": "需求分析 Agent",
	coding: "Coding Agent",
	"bug-fix": "Bug Fix Agent",
	review: "Review Agent",
};

const roleGlyphs: Record<AgentSlotSummary["role"], string> = {
	"requirement-analysis": "◇",
	coding: "⌘",
	"bug-fix": "⌁",
	review: "✓",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractMessageText(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(extractMessageText).filter(Boolean).join("\n");
	if (!isRecord(value)) return "";
	if (value.type === "text" && typeof value.text === "string") return value.text;
	if ("content" in value) return extractMessageText(value.content);
	return "";
}

function extractThinkingText(value: unknown): string {
	if (Array.isArray(value)) return value.map(extractThinkingText).filter(Boolean).join("\n");
	if (!isRecord(value)) return "";
	if (value.type === "thinking" && typeof value.thinking === "string") return value.thinking;
	if ("content" in value) return extractThinkingText(value.content);
	return "";
}

function assistantMessageStatus(value: unknown): Exclude<AssistantMessageStatus, "streaming"> {
	if (!isRecord(value)) return "complete";
	if (value.stopReason === "aborted") return "aborted";
	if (value.stopReason === "error") return "error";
	return "complete";
}

function finalizeAssistantTranscript(
	items: TranscriptItem[],
	assistantId: string | undefined,
	message: unknown,
	fallbackStatus: Exclude<AssistantMessageStatus, "streaming"> = "complete",
): TranscriptItem[] {
	if (!assistantId) return items;
	const messageRecord = isRecord(message) ? message : null;
	const status = messageRecord ? assistantMessageStatus(messageRecord) : fallbackStatus;
	const finalText = messageRecord ? extractMessageText(messageRecord.content) : "";
	const finalThinking = messageRecord ? extractThinkingText(messageRecord.content) : "";
	const errorMessage =
		messageRecord && typeof messageRecord.errorMessage === "string" ? messageRecord.errorMessage : "";
	return items.flatMap((item) => {
		if (item.id !== assistantId || item.type !== "assistant") return [item];
		const text = finalText || item.text;
		const thinking = finalThinking || item.thinking;
		if (status === "complete" && !text && !thinking) return [];
		return [
			{
				...item,
				text:
					text ||
					(status === "aborted" ? "本轮已中断。" : status === "error" ? errorMessage || "本轮回复失败。" : ""),
				...(thinking ? { thinking } : {}),
				status,
			},
		];
	});
}

function normalizeHistory(messages: unknown[]): TranscriptItem[] {
	const items: TranscriptItem[] = [];
	for (const [index, message] of messages.entries()) {
		if (!isRecord(message)) continue;
		const text = extractMessageText(message.content);
		if (!text) continue;
		const role = message.role;
		if (role === "toolResult") {
			items.push({
				id: typeof message.toolCallId === "string" ? message.toolCallId : `history-tool-${index}`,
				type: "tool",
				name: typeof message.toolName === "string" ? message.toolName : "tool",
				args: "",
				text,
				status: "completed",
				isError: message.isError === true,
			});
		} else if (role === "assistant") {
			const thinking = extractThinkingText(message.content);
			items.push({
				id: `history-${index}`,
				type: "assistant",
				text,
				...(thinking ? { thinking } : {}),
				status: assistantMessageStatus(message),
				...(typeof message.timestamp === "string" ? { createdAt: message.timestamp } : {}),
			});
		} else {
			items.push({
				id: `history-${index}`,
				type: role === "user" ? "user" : "system",
				text,
				...(typeof message.timestamp === "string" ? { createdAt: message.timestamp } : {}),
			});
		}
	}
	return items;
}

type AppIconName =
	| "archive"
	| "arrow-up"
	| "branch"
	| "chevron"
	| "close"
	| "copy"
	| "edit"
	| "folder"
	| "more"
	| "plus"
	| "restore"
	| "search"
	| "settings"
	| "warning";

function AppIcon({ name, size = 16, className = "" }: { name: AppIconName; size?: number; className?: string }) {
	const paths: Record<AppIconName, React.ReactNode> = {
		archive: (
			<>
				<path d="M4 7h16" />
				<path d="M6 7l1 12h10l1-12" />
				<path d="M9 11h6" />
				<path d="M8 4h8l1 3H7l1-3Z" />
			</>
		),
		"arrow-up": (
			<>
				<path d="m7 11 5-5 5 5" />
				<path d="M12 6v12" />
			</>
		),
		branch: (
			<>
				<circle cx="7" cy="6" r="2" />
				<circle cx="17" cy="18" r="2" />
				<circle cx="7" cy="18" r="2" />
				<path d="M7 8v8" />
				<path d="M9 8c5 0 8 2 8 8" />
			</>
		),
		chevron: <path d="m9 6 6 6-6 6" />,
		close: (
			<>
				<path d="m7 7 10 10" />
				<path d="M17 7 7 17" />
			</>
		),
		copy: (
			<>
				<rect x="8" y="8" width="11" height="11" rx="2" />
				<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
			</>
		),
		edit: (
			<>
				<path d="M4 20h4l11-11-4-4L4 16v4Z" />
				<path d="m13.5 6.5 4 4" />
			</>
		),
		folder: <path d="M3.5 6.5h6l2 2H20.5v9.5H3.5z" />,
		more: (
			<>
				<circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
				<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
				<circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
			</>
		),
		plus: (
			<>
				<path d="M12 5v14" />
				<path d="M5 12h14" />
			</>
		),
		restore: (
			<>
				<path d="M4 8v5h5" />
				<path d="M5.5 12a7 7 0 1 0 2-5" />
			</>
		),
		search: (
			<>
				<circle cx="10.5" cy="10.5" r="5.5" />
				<path d="m15 15 4 4" />
			</>
		),
		settings: (
			<>
				<circle cx="12" cy="12" r="3" />
				<path d="M19 13.5v-3l-2-.7-.5-1.2.9-1.9-2.1-2.1-1.9.9-1.2-.5-.7-2h-3l-.7 2-1.2.5-1.9-.9-2.1 2.1.9 1.9-.5 1.2-2 .7v3l2 .7.5 1.2-.9 1.9 2.1 2.1 1.9-.9 1.2.5.7 2h3l.7-2 1.2-.5 1.9.9 2.1-2.1-.9-1.9.5-1.2 2-.7Z" />
			</>
		),
		warning: (
			<>
				<path d="M12 4 3.5 19h17L12 4Z" />
				<path d="M12 9v4" />
				<path d="M12 16h.01" />
			</>
		),
	};
	return (
		<svg
			className={`app-svg-icon ${className}`}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{paths[name]}
		</svg>
	);
}

function InlineText({ text }: { text: string }) {
	const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
	return (
		<>
			{tokens.map((token, index) => {
				if (token.startsWith("**") && token.endsWith("**")) {
					return <strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>;
				}
				if (token.startsWith("`") && token.endsWith("`")) {
					return (
						<code className="inline-code" key={`${index}-${token}`}>
							{token.slice(1, -1)}
						</code>
					);
				}
				return <span key={`${index}-${token}`}>{token}</span>;
			})}
		</>
	);
}

function RichText({ text }: { text: string }) {
	const lines = text.split("\n");
	const blocks: React.ReactNode[] = [];
	let paragraph: string[] = [];
	let list: { ordered: boolean; items: string[] } | null = null;
	const flushParagraph = (): void => {
		if (paragraph.length === 0) return;
		const value = paragraph.join("\n").trim();
		if (value)
			blocks.push(
				<p key={`p-${blocks.length}`}>
					<InlineText text={value} />
				</p>,
			);
		paragraph = [];
	};
	const flushList = (): void => {
		if (!list) return;
		const Tag = list.ordered ? "ol" : "ul";
		blocks.push(
			<Tag key={`list-${blocks.length}`}>
				{list.items.map((item, index) => (
					<li key={`${index}-${item}`}>
						<InlineText text={item} />
					</li>
				))}
			</Tag>,
		);
		list = null;
	};
	for (const line of lines) {
		const heading = /^(#{1,4})\s+(.+)$/.exec(line);
		const unordered = /^[-*]\s+(.+)$/.exec(line);
		const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
		const quote = /^>\s?(.*)$/.exec(line);
		if (heading) {
			flushParagraph();
			flushList();
			const level = Math.min(heading[1]!.length + 2, 6);
			const Tag = `h${level}` as "h3" | "h4" | "h5" | "h6";
			blocks.push(
				<Tag key={`h-${blocks.length}`}>
					<InlineText text={heading[2] ?? ""} />
				</Tag>,
			);
		} else if (unordered || ordered) {
			flushParagraph();
			const isOrdered = Boolean(ordered);
			if (list && list.ordered !== isOrdered) flushList();
			list ??= { ordered: isOrdered, items: [] };
			list.items.push((ordered?.[1] ?? unordered?.[1] ?? "").trim());
		} else if (quote) {
			flushParagraph();
			flushList();
			blocks.push(
				<blockquote key={`q-${blocks.length}`}>
					<InlineText text={quote[1] ?? ""} />
				</blockquote>,
			);
		} else if (!line.trim()) {
			flushParagraph();
			flushList();
		} else {
			flushList();
			paragraph.push(line);
		}
	}
	flushParagraph();
	flushList();
	return <>{blocks}</>;
}

function MessageCodeBlock({ value, language }: { value: string; language?: string }) {
	const [copied, setCopied] = useState(false);
	const [collapsed, setCollapsed] = useState(value.length > 3000 || value.split("\n").length > 24);
	const [wrapped, setWrapped] = useState(false);
	async function copyCode(): Promise<void> {
		try {
			await navigator.clipboard.writeText(value.replace(/\n$/, ""));
			setCopied(true);
			setTimeout(() => setCopied(false), 1400);
		} catch {}
	}
	return (
		<div className={`message-code-block ${collapsed ? "collapsed" : ""} ${wrapped ? "wrapped" : ""}`}>
			<div className="message-code-toolbar">
				<span>{language || "code"}</span>
				<div>
					<button type="button" onClick={() => setWrapped((current) => !current)}>
						{wrapped ? "不换行" : "自动换行"}
					</button>
					<button type="button" onClick={() => void copyCode()}>
						{copied ? "已复制" : "复制代码"}
					</button>
					<button type="button" onClick={() => setCollapsed((current) => !current)}>
						{collapsed ? "展开" : "折叠"}
					</button>
				</div>
			</div>
			<pre>
				<code>{value.replace(/\n$/, "")}</code>
			</pre>
		</div>
	);
}

const MessageContent = memo(function MessageContent({ text }: { text: string }) {
	const parts = useMemo(() => {
		const result: Array<{ type: "text" | "code"; value: string; language?: string }> = [];
		const pattern = /```([^\n`]*)\n?([\s\S]*?)```/g;
		let cursor = 0;
		for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
			if (match.index > cursor) result.push({ type: "text", value: text.slice(cursor, match.index) });
			result.push({ type: "code", value: match[2] ?? "", language: match[1]?.trim() || undefined });
			cursor = match.index + match[0].length;
		}
		if (cursor < text.length) result.push({ type: "text", value: text.slice(cursor) });
		if (result.length === 0) result.push({ type: "text", value: text });
		return result;
	}, [text]);
	return (
		<>
			{parts.map((part, index) =>
				part.type === "code" ? (
					<MessageCodeBlock
						key={`${index}-${part.value.slice(0, 20)}`}
						value={part.value}
						language={part.language}
					/>
				) : (
					<div className="message-rich-text" key={`${index}-${part.value.slice(0, 20)}`}>
						<RichText text={part.value} />
					</div>
				),
			)}
		</>
	);
});

function formatMessageTime(value: string | undefined): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

const TranscriptMessage = memo(function TranscriptMessage({
	item,
	assistantModel,
}: {
	item: Extract<TranscriptItem, { type: "user" | "assistant" | "system" }>;
	assistantModel?: string;
}) {
	const [copied, setCopied] = useState(false);
	const messageTime = formatMessageTime(item.createdAt);
	const systemOutputIsLong = item.type === "system" && (item.text.length > 360 || item.text.split("\n").length > 8);
	async function copyMessage(): Promise<void> {
		if (!item.text) return;
		try {
			await navigator.clipboard.writeText(item.text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1400);
		} catch {}
	}
	const assistantStatus =
		item.type === "assistant"
			? item.status === "streaming"
				? "回复中"
				: item.status === "aborted"
					? "已中断"
					: item.status === "error"
						? "失败"
						: null
			: null;
	return (
		<div className={`message message-${item.type} ${item.type === "assistant" ? `message-${item.status}` : ""}`}>
			<div className="message-body">
				<div className="message-role-label">
					{item.type === "assistant" ? <span className="pi-response-dot" /> : null}
					<strong>
						{item.type === "assistant"
							? `Pi${assistantModel ? ` · ${assistantModel}` : ""}`
							: item.type === "user"
								? "你"
								: "系统"}
					</strong>
					{item.type === "assistant" && assistantStatus ? (
						<span className={`message-status status-${item.status}`}>{assistantStatus}</span>
					) : null}
					{messageTime ? <time>{messageTime}</time> : null}
				</div>
				{item.type === "assistant" && item.thinking ? (
					<details className="thinking-block">
						<summary>思考过程</summary>
						<p>{item.thinking}</p>
					</details>
				) : null}
				{item.type === "assistant" && item.status === "streaming" && !item.text ? (
					<output className="message-streaming-placeholder" aria-live="polite">
						<span className="sr-only">Pi 正在生成回复</span>
						<span aria-hidden="true" />
						<span aria-hidden="true" />
						<span aria-hidden="true" />
					</output>
				) : systemOutputIsLong ? (
					<details className="system-output-fold">
						<summary>
							<span>系统输出</span>
							<small>{item.text.length.toLocaleString()} 字符</small>
						</summary>
						<div className="system-output-content">
							<MessageContent text={item.text} />
						</div>
					</details>
				) : item.text ? (
					<MessageContent text={item.text} />
				) : null}
				{item.type === "user" && item.delivery ? (
					<small className="message-delivery">
						{item.delivery === "steer" ? "已追加到当前运行" : "已排队等待"}
					</small>
				) : null}
			</div>
			{item.text ? (
				<button
					className="message-copy"
					type="button"
					aria-label="复制消息"
					title={copied ? "已复制" : "复制消息"}
					onClick={() => void copyMessage()}
				>
					<AppIcon name="copy" size={14} />
					<span>{copied ? "已复制" : "复制"}</span>
				</button>
			) : null}
		</div>
	);
});

function clientErrorMessage(caught: unknown, fallback: string): string {
	let message = caught instanceof Error ? caught.message : typeof caught === "string" ? caught : fallback;
	message = message.replace(/^Error invoking remote method '[^']+': Error:\s*/i, "");
	if (/Agent is already processing/i.test(message)) {
		return "Pi Agent 正在处理上一条消息。新消息会作为 steering 指令追加，请重试一次。";
	}
	if (/Timed out waiting for Pi RPC response/i.test(message)) {
		return `Pi RPC 响应超时：${message}`;
	}
	if (/Pi RPC process is not available|pipe.*closed|stdin/i.test(message)) {
		return "Pi Agent 连接已经断开，请重新打开当前 Agent 以恢复 Session。";
	}
	return message || fallback;
}

function readStoredScrollPositions(): Record<string, number> {
	try {
		const value = JSON.parse(localStorage.getItem("codepiddy:agent-scroll-positions") ?? "{}") as unknown;
		if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
		return Object.fromEntries(
			Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
		);
	} catch {
		return {};
	}
}

function Chevron({ expanded }: { expanded: boolean }) {
	return <AppIcon name="chevron" size={15} className={`chevron ${expanded ? "expanded" : ""}`} />;
}

function IconButton({ label, onClick, children }: { label: string; onClick(): void; children: React.ReactNode }) {
	return (
		<button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>
			{children}
		</button>
	);
}

function formatTokenCount(value: number): string {
	return new Intl.NumberFormat(undefined, {
		notation: value >= 10_000 ? "compact" : "standard",
		maximumFractionDigits: value >= 10_000 ? 1 : 0,
	}).format(value);
}

function ContextMeter({ snapshot, onClick }: { snapshot?: AgentSessionSnapshot; onClick(): void }) {
	const usage = snapshot?.contextUsage;
	if (!usage) {
		return (
			<button className="context-meter context-unknown" type="button" onClick={onClick} title="查看 Session 统计">
				<span>上下文</span>
				<strong>读取中</strong>
			</button>
		);
	}
	const percent = usage.percent ?? (usage.tokens === null ? null : (usage.tokens / usage.contextWindow) * 100);
	const level =
		percent !== null && percent >= 95
			? "critical"
			: percent !== null && percent >= 85
				? "high"
				: percent !== null && percent >= 70
					? "watch"
					: "normal";
	const label = `${usage.tokens === null ? "—" : formatTokenCount(usage.tokens)} / ${formatTokenCount(usage.contextWindow)}`;
	return (
		<button
			className={`context-meter context-${level}`}
			type="button"
			onClick={onClick}
			title={`当前上下文：${label}${percent === null ? "" : `（${Math.round(percent)}%）`}`}
		>
			<span>上下文</span>
			<strong>{label}</strong>
			<span className="context-meter-track" aria-hidden="true">
				<span style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }} />
			</span>
			<small>{percent === null ? "待下一次回复" : `${Math.round(percent)}%`}</small>
		</button>
	);
}

const demoMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");

const demoSessionSnapshot: AgentSessionSnapshot = {
	sessionId: "demo-session",
	sessionName: "FEAT-001 Coding Agent",
	messageCount: 6,
	pendingMessageCount: 0,
	isStreaming: false,
	isCompacting: false,
	contextUsage: { tokens: 42500, contextWindow: 128000, percent: 33.2 },
	leafId: "assistant-3",
	nodes: [
		{
			entryId: "user-1",
			parentId: null,
			type: "message",
			role: "user",
			text: "按照 design.md 和 tasks.md 实现登录功能。",
			timestamp: "2026-09-17T02:10:00.000Z",
			depth: 0,
			isLeaf: false,
			forkable: true,
		},
		{
			entryId: "assistant-1",
			parentId: "user-1",
			type: "message",
			role: "assistant",
			text: "我会先检查交接文档和现有认证代码。",
			timestamp: "2026-09-17T02:10:08.000Z",
			depth: 1,
			isLeaf: false,
			forkable: false,
		},
		{
			entryId: "user-2",
			parentId: "assistant-1",
			type: "message",
			role: "user",
			text: "先不要接第三方登录，只保留扩展接口。",
			timestamp: "2026-09-17T02:18:00.000Z",
			depth: 2,
			isLeaf: false,
			forkable: true,
		},
		{
			entryId: "assistant-2",
			parentId: "user-2",
			type: "message",
			role: "assistant",
			text: "已完成账号密码登录和扩展接口，并补充了基础测试。",
			timestamp: "2026-09-17T02:25:00.000Z",
			depth: 3,
			isLeaf: false,
			forkable: false,
		},
		{
			entryId: "user-3",
			parentId: "assistant-2",
			type: "message",
			role: "user",
			text: "修复 Review Agent 提出的会话过期边界问题。",
			timestamp: "2026-09-17T02:31:00.000Z",
			depth: 4,
			isLeaf: false,
			forkable: true,
		},
		{
			entryId: "assistant-3",
			parentId: "user-3",
			type: "message",
			role: "assistant",
			text: "边界问题已修复，implementation.md 已更新。",
			timestamp: "2026-09-17T02:38:00.000Z",
			depth: 5,
			isLeaf: true,
			forkable: false,
		},
	],
};

const demoAgentCommands: AgentCommandOption[] = [
	{ name: "settings", command: "/settings", description: "Open settings menu", source: "builtin" },
	{
		name: "model",
		command: "/model",
		description: "Select model (opens selector UI)",
		argumentHint: "<provider/model>",
		source: "builtin",
	},
	{ name: "tree", command: "/tree", description: "Navigate session tree (switch branches)", source: "builtin" },
	{
		name: "thinking",
		command: "/thinking",
		description: "Set thinking level",
		argumentHint: "<level>",
		source: "builtin",
	},
	{ name: "export", command: "/export", description: "Export session", argumentHint: "[path]", source: "builtin" },
	{ name: "copy", command: "/copy", description: "Copy last agent message to clipboard", source: "builtin" },
	{
		name: "name",
		command: "/name",
		description: "Set session display name",
		argumentHint: "<name>",
		source: "builtin",
	},
	{ name: "session", command: "/session", description: "Show session info and stats", source: "builtin" },
	{ name: "fork", command: "/fork", description: "Create a new fork from a previous user message", source: "builtin" },
	{
		name: "clone",
		command: "/clone",
		description: "Duplicate the current session at the current position",
		source: "builtin",
	},
	{ name: "new", command: "/new", description: "Start a new session", source: "builtin" },
	{ name: "compact", command: "/compact", description: "Manually compact the session context", source: "builtin" },
	{
		name: "reload",
		command: "/reload",
		description: "Reload extensions, skills, prompts and context",
		source: "builtin",
	},
	{
		name: "skill:grill",
		command: "/skill:grill",
		description: "Clarify requirements with focused questions",
		source: "skill",
	},
];

const demoModelSelection: AgentModelSelection = {
	model: { provider: "openai", id: "gpt-5.5", name: "GPT-5.5", reasoning: true },
	thinkingLevel: "medium",
	availableThinkingLevels: ["off", "low", "medium", "high", "xhigh"],
	availableModels: [
		{ provider: "openai", id: "gpt-5.5", name: "GPT-5.5", reasoning: true },
		{ provider: "openai", id: "gpt-5.4-mini", name: "GPT-5.4 Mini", reasoning: true },
		{ provider: "anthropic", id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", reasoning: true },
		{ provider: "custom-team", id: "deepseek-v3", name: "DeepSeek V3", reasoning: false },
	],
};

export function App() {
	const [project, setProject] = useState<ProjectSummary | null>(demoMode ? demoProject : null);
	const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
	const [selection, setSelection] = useState<Selection>(demoMode ? { type: "project" } : { type: "welcome" });
	const [expanded, setExpanded] = useState<Set<string>>(
		new Set(demoMode ? ["project:demo-project", "lane:requirements", "lane:bugs", "work-item:FEAT-001"] : []),
	);
	const [dialog, setDialog] = useState<WorkItemDialogState | null>(null);
	const [archiveToast, setArchiveToast] = useState<ArchiveToast | null>(null);
	const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
	const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
	const [resetAgentDialog, setResetAgentDialog] = useState<ResetAgentDialogState | null>(null);
	const [agentActionsOpen, setAgentActionsOpen] = useState<string | null>(null);
	const [sessionPanel, setSessionPanel] = useState<SessionPanelState | null>(null);
	const [sessionPanelLoading, setSessionPanelLoading] = useState(false);
	const [writeLeaseDialog, setWriteLeaseDialog] = useState<ProjectWriteLeaseStatus | null>(null);
	const [busy, setBusy] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [extensionDialog, setExtensionDialog] = useState<ExtensionDialogState | null>(null);
	const [settingsStatus, setSettingsStatus] = useState<SettingsStatus | null>(null);
	const [tavilyApiKey, setTavilyApiKey] = useState("");
	const [availableSkills, setAvailableSkills] = useState<AgentSkillSummary[]>([]);
	const [roleSkillAssignments, setRoleSkillAssignments] = useState<RoleSkillAssignments>({
		"requirement-analysis": [],
		coding: [],
		"bug-fix": [],
		review: [],
	});
	const [roleSkillSaving, setRoleSkillSaving] = useState<AgentRole | null>(null);
	const [roleModelDefaults, setRoleModelDefaults] = useState<RoleModelDefaults>({});
	const [transcripts, setTranscripts] = useState<Record<string, TranscriptItem[]>>(
		demoMode
			? {
					"CODE-001": [
						{
							id: "demo-user",
							type: "user",
							text: "按照交接文档实现登录功能，并给出关键修改。",
							createdAt: "2026-09-17T09:30:00.000Z",
						},
						{
							id: "demo-assistant",
							type: "assistant",
							text: "已完成核心实现：\n\n```ts\nexport async function login(input: LoginInput) {\n  return authService.authenticate(input);\n}\n```\n\n基础测试已经通过，implementation.md 也已更新。",
							status: "complete",
						},
					],
				}
			: {},
	);
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
	const [agentActivities, setAgentActivities] = useState<Record<string, AgentActivity>>({});
	const [pendingPermissionRequests, setPendingPermissionRequests] = useState<Record<string, PendingPermissionRequest>>(
		{},
	);
	const [deferredPermissionAgentId, setDeferredPermissionAgentId] = useState<string | null>(null);
	const [toolRecoveryOffers, setToolRecoveryOffers] = useState<Record<string, ToolRecoveryOffer>>({});
	const [agentSessionSnapshots, setAgentSessionSnapshots] = useState<Record<string, AgentSessionSnapshot>>(
		demoMode ? { "CODE-001": demoSessionSnapshot } : {},
	);
	const [abortingAgents, setAbortingAgents] = useState<Record<string, boolean>>({});
	const [agentCommandsLoading, setAgentCommandsLoading] = useState<Record<string, boolean>>({});
	const [agentCommands, setAgentCommands] = useState<Record<string, AgentCommandOption[]>>(
		demoMode
			? {
					"CODE-001": demoAgentCommands,
					"RA-001": demoAgentCommands,
					"RA-002": demoAgentCommands,
					"FIX-001": demoAgentCommands,
				}
			: {},
	);
	const [modelSelections, setModelSelections] = useState<Record<string, AgentModelSelection>>(
		demoMode
			? {
					"CODE-001": demoModelSelection,
					"RA-001": demoModelSelection,
					"RA-002": demoModelSelection,
					"FIX-001": demoModelSelection,
				}
			: {},
	);
	const [modelPickerAgentId, setModelPickerAgentId] = useState<string | null>(null);
	const [modelPickerBusy, setModelPickerBusy] = useState(false);
	const [modelSearch, setModelSearch] = useState("");
	const [modelPickerSelectedIndex, setModelPickerSelectedIndex] = useState(0);
	const [fileMatches, setFileMatches] = useState<string[]>([]);
	const activeAssistantIds = useRef(new Map<string, string>());
	const pendingToolFailures = useRef(new Map<string, ToolRecoveryOffer>());
	const agentCommandLoads = useRef(new Map<string, Promise<AgentCommandOption[]>>());
	const projectRef = useRef<ProjectSummary | null>(project);
	const transcriptRef = useRef<HTMLDivElement | null>(null);
	const modelSearchInputRef = useRef<HTMLInputElement | null>(null);
	const modelPickerSelectedIndexRef = useRef(0);
	const scrollPositions = useRef<Record<string, number>>(readStoredScrollPositions());
	const restoredProjectUiRoots = useRef(new Set<string>());
	const restoringProjectUiRoots = useRef(new Set<string>());
	const restoredAgentUiIds = useRef(new Set<string>());
	const restoringAgentUiIds = useRef(new Set<string>());
	const agentUiSaveTimers = useRef(new Map<string, number>());
	const [showJumpToLatest, setShowJumpToLatest] = useState(false);

	const loadAgentCommands = useCallback(async (locator: AgentInstanceLocator): Promise<AgentCommandOption[]> => {
		const existing = agentCommandLoads.current.get(locator.agentInstanceId);
		if (existing) return existing;
		setAgentCommandsLoading((current) => ({ ...current, [locator.agentInstanceId]: true }));
		const load = window.codepiddy.getAgentCommands(locator);
		agentCommandLoads.current.set(locator.agentInstanceId, load);
		try {
			const commands = await load;
			setAgentCommands((current) => ({ ...current, [locator.agentInstanceId]: commands }));
			return commands;
		} finally {
			if (agentCommandLoads.current.get(locator.agentInstanceId) === load) {
				agentCommandLoads.current.delete(locator.agentInstanceId);
			}
			setAgentCommandsLoading((current) => ({ ...current, [locator.agentInstanceId]: false }));
		}
	}, []);

	useEffect(() => {
		projectRef.current = project;
	}, [project]);

	useEffect(() => {
		if (
			demoMode ||
			!project ||
			!("codepiddy" in window) ||
			restoredProjectUiRoots.current.has(project.rootPath) ||
			restoringProjectUiRoots.current.has(project.rootPath)
		)
			return;
		restoringProjectUiRoots.current.add(project.rootPath);
		void window.codepiddy
			.getProjectUiState(project.rootPath)
			.then((state) => {
				if (!state) return;
				setExpanded(new Set(state.expandedKeys));
				setSelection(restoreSelection(project, state));
			})
			.catch(() => undefined)
			.finally(() => {
				restoringProjectUiRoots.current.delete(project.rootPath);
				restoredProjectUiRoots.current.add(project.rootPath);
			});
	}, [project]);

	useEffect(() => {
		if (demoMode || !project || !("codepiddy" in window) || !restoredProjectUiRoots.current.has(project.rootPath))
			return;
		const timer = window.setTimeout(() => {
			const state: ProjectUiState = {
				projectRoot: project.rootPath,
				selectionType: selection.type === "welcome" ? "project" : selection.type,
				expandedKeys: [...expanded],
				...("lane" in selection ? { lane: selection.lane } : {}),
				...("workItemId" in selection ? { workItemId: selection.workItemId } : {}),
				...(selection.type === "agent" ? { role: selection.role } : {}),
			};
			void window.codepiddy.saveProjectUiState(state);
		}, 200);
		return () => window.clearTimeout(timer);
	}, [expanded, project, selection]);

	const selectedWorkItem = useMemo(() => {
		if (
			!project ||
			selection.type === "welcome" ||
			selection.type === "project" ||
			selection.type === "lane" ||
			selection.type === "settings"
		)
			return null;
		return (
			project.lanes
				.find((lane) => lane.kind === selection.lane)
				?.workItems.find((item) => item.id === selection.workItemId) ?? null
		);
	}, [project, selection]);

	const activeAgentId = useMemo(() => {
		if (!selectedWorkItem || selection.type !== "agent") return null;
		return selectedWorkItem.agentSlots.find((slot) => slot.role === selection.role)?.currentInstanceId ?? null;
	}, [selectedWorkItem, selection]);

	useEffect(() => {
		if (
			demoMode ||
			!activeAgentId ||
			!("codepiddy" in window) ||
			restoredAgentUiIds.current.has(activeAgentId) ||
			restoringAgentUiIds.current.has(activeAgentId)
		)
			return;
		restoringAgentUiIds.current.add(activeAgentId);
		void window.codepiddy
			.getAgentUiState(activeAgentId)
			.then((state) => {
				if (!state) return;
				setDrafts((current) => ({ ...current, [activeAgentId]: state.draft }));
				setUnreadCounts((current) => ({ ...current, [activeAgentId]: state.unreadCount }));
				scrollPositions.current[activeAgentId] = state.scrollTop;
			})
			.catch(() => undefined)
			.finally(() => {
				restoringAgentUiIds.current.delete(activeAgentId);
				restoredAgentUiIds.current.add(activeAgentId);
			});
	}, [activeAgentId]);

	useEffect(() => {
		if (demoMode || !activeAgentId || !("codepiddy" in window) || !restoredAgentUiIds.current.has(activeAgentId))
			return;
		const existing = agentUiSaveTimers.current.get(activeAgentId);
		if (existing) window.clearTimeout(existing);
		const timer = window.setTimeout(() => {
			void window.codepiddy.saveAgentUiState({
				agentInstanceId: activeAgentId,
				draft: drafts[activeAgentId] ?? "",
				scrollTop: scrollPositions.current[activeAgentId] ?? 0,
				unreadCount: unreadCounts[activeAgentId] ?? 0,
			});
			agentUiSaveTimers.current.delete(activeAgentId);
		}, 250);
		agentUiSaveTimers.current.set(activeAgentId, timer);
		return () => window.clearTimeout(timer);
	}, [activeAgentId, drafts, unreadCounts]);

	useEffect(() => {
		if (!activeAgentId || showJumpToLatest) return;
		setUnreadCounts((current) =>
			(current[activeAgentId] ?? 0) === 0 ? current : { ...current, [activeAgentId]: 0 },
		);
	}, [activeAgentId, showJumpToLatest]);

	const activeDraftStartsWithSlash = Boolean(
		activeAgentId && (drafts[activeAgentId] ?? "").trimStart().startsWith("/"),
	);

	const modelPickerOptions = useMemo(() => {
		if (!modelPickerAgentId) return [];
		const modelSelection = modelSelections[modelPickerAgentId];
		if (!modelSelection) return [];
		const normalizedSearch = modelSearch.trim().toLowerCase();
		return modelSelection.availableModels.filter((model) =>
			`${model.provider} ${model.name} ${model.id}`.toLowerCase().includes(normalizedSearch),
		);
	}, [modelPickerAgentId, modelSearch, modelSelections]);

	const updateAgentStatus = useCallback((clientEvent: AgentClientEvent, status: AgentStatus): void => {
		setProject((current) =>
			current
				? {
						...current,
						lanes: current.lanes.map((lane) => ({
							...lane,
							workItems: lane.workItems.map((item) =>
								item.id === clientEvent.workItemId
									? {
											...item,
											agentSlots: item.agentSlots.map((slot) =>
												slot.role === clientEvent.role &&
												slot.currentInstanceId === clientEvent.agentInstanceId
													? { ...slot, status }
													: slot,
											),
										}
									: item,
							),
						})),
					}
				: current,
		);
	}, []);

	const updateTranscript = useCallback(
		(agentId: string, update: (items: TranscriptItem[]) => TranscriptItem[]): void => {
			setTranscripts((current) => ({ ...current, [agentId]: update(current[agentId] ?? []) }));
		},
		[],
	);

	const updateAgentActivity = useCallback((agentId: string, activity: AgentActivity | null): void => {
		setAgentActivities((current) => {
			if (activity) return { ...current, [agentId]: activity };
			if (!(agentId in current)) return current;
			const next = { ...current };
			delete next[agentId];
			return next;
		});
	}, []);

	const refreshAgentSessionSnapshot = useCallback(async (locator: AgentInstanceLocator): Promise<void> => {
		if (demoMode || !("codepiddy" in window)) return;
		try {
			const snapshot = await window.codepiddy.getAgentSessionSnapshot(locator);
			setAgentSessionSnapshots((current) => ({ ...current, [locator.agentInstanceId]: snapshot }));
			setSessionPanel((current) =>
				current?.agentInstanceId === locator.agentInstanceId ? { ...current, snapshot } : current,
			);
		} catch {
			// The process may be settling or restarting. The next activation will refresh it.
		}
	}, []);

	const markAgentUnread = useCallback(
		(agentId: string): void => {
			if (agentId === activeAgentId && !showJumpToLatest) return;
			setUnreadCounts((current) => ({ ...current, [agentId]: (current[agentId] ?? 0) + 1 }));
		},
		[activeAgentId, showJumpToLatest],
	);

	const handleAgentEvent = useCallback(
		(clientEvent: AgentClientEvent): void => {
			const { agentInstanceId, event } = clientEvent;
			const type = event.type;
			const locator: AgentInstanceLocator = {
				agentInstanceId,
				projectId: clientEvent.projectId,
				workItemId: clientEvent.workItemId,
				role: clientEvent.role,
			};
			const finishActiveAssistant = (
				message: unknown,
				fallbackStatus: Exclude<AssistantMessageStatus, "streaming"> = "complete",
			): void => {
				const id = activeAssistantIds.current.get(agentInstanceId);
				if (!id) return;
				updateTranscript(agentInstanceId, (items) =>
					finalizeAssistantTranscript(items, id, message, fallbackStatus),
				);
				activeAssistantIds.current.delete(agentInstanceId);
			};
			if (type === "extension_ui_request") {
				const method = event.method;
				if (
					typeof event.id === "string" &&
					(method === "select" || method === "confirm" || method === "input" || method === "editor")
				) {
					const request: PendingPermissionRequest = {
						agentInstanceId,
						projectId: clientEvent.projectId,
						workItemId: clientEvent.workItemId,
						role: clientEvent.role,
						requestId: event.id,
						method,
						title: typeof event.title === "string" ? event.title : "需要确认",
						message: typeof event.message === "string" ? event.message : "",
						options: Array.isArray(event.options)
							? event.options.filter((option): option is string => typeof option === "string")
							: [],
						placeholder: typeof event.placeholder === "string" ? event.placeholder : "",
						prefill: typeof event.prefill === "string" ? event.prefill : "",
						createdAt: new Date().toISOString(),
					};
					setPendingPermissionRequests((current) => ({ ...current, [agentInstanceId]: request }));
					setDeferredPermissionAgentId((current) => (current === agentInstanceId ? null : current));
					if (activeAgentId === agentInstanceId) setExtensionDialog(extensionDialogFromPermission(request));
					markAgentUnread(agentInstanceId);
					updateAgentStatus(clientEvent, "waiting");
					updateAgentActivity(agentInstanceId, { label: "等待权限确认", kind: "waiting", queued: 0 });
				}
				return;
			}
			if (type === "agent_status" && typeof event.status === "string") {
				if (
					event.status === "idle" ||
					event.status === "running" ||
					event.status === "waiting" ||
					event.status === "completed" ||
					event.status === "failed"
				) {
					updateAgentStatus(clientEvent, event.status);
					if (event.status === "running") {
						updateAgentActivity(agentInstanceId, { label: "Pi 正在处理", kind: "working", queued: 0 });
					} else if (event.status !== "waiting") {
						updateAgentActivity(agentInstanceId, null);
						if (event.status === "failed") finishActiveAssistant(undefined, "error");
					}
				}
				return;
			}
			if (type === "agent_start" || type === "turn_start") {
				updateAgentStatus(clientEvent, "running");
				updateAgentActivity(agentInstanceId, { label: "Pi 正在思考", kind: "working", queued: 0 });
			}
			if (type === "agent_end") {
				const lastAssistant = Array.isArray(event.messages)
					? [...event.messages].reverse().find((message) => isRecord(message) && message.role === "assistant")
					: undefined;
				finishActiveAssistant(lastAssistant);
				updateAgentActivity(agentInstanceId, null);
				void refreshAgentSessionSnapshot(locator);
				return;
			}
			if (type === "agent_settled") {
				setPendingPermissionRequests((current) => {
					if (!(agentInstanceId in current)) return current;
					const next = { ...current };
					delete next[agentInstanceId];
					return next;
				});
				if (extensionDialog?.agentInstanceId === agentInstanceId) setExtensionDialog(null);
				finishActiveAssistant(undefined);
				const unresolvedToolFailure = pendingToolFailures.current.get(agentInstanceId);
				if (unresolvedToolFailure) {
					pendingToolFailures.current.delete(agentInstanceId);
					setToolRecoveryOffers((current) => ({ ...current, [agentInstanceId]: unresolvedToolFailure }));
					updateTranscript(agentInstanceId, (items) => [
						...items,
						{
							id: crypto.randomUUID(),
							type: "system",
							text: `本轮在 ${unresolvedToolFailure.toolName} 工具失败后结束，Pi 没有产生最终文本回复。你可以让 Pi 使用替代方案继续处理。`,
							createdAt: new Date().toISOString(),
						},
					]);
				}
				updateAgentActivity(agentInstanceId, null);
				updateAgentStatus(clientEvent, "idle");
				setAbortingAgents((current) => ({ ...current, [agentInstanceId]: false }));
				void refreshAgentSessionSnapshot(locator);
				const currentProject = projectRef.current;
				if (currentProject && "codepiddy" in window) {
					void window.codepiddy
						.refreshProject(currentProject.rootPath)
						.then(setProject)
						.catch(() => undefined);
				}
				return;
			}
			if (type === "agent_history" && Array.isArray(event.messages)) {
				activeAssistantIds.current.delete(agentInstanceId);
				setTranscripts((current) => ({
					...current,
					[agentInstanceId]: normalizeHistory(event.messages as unknown[]),
				}));
				return;
			}
			if (type === "message_start") {
				const message = event.message;
				if (isRecord(message) && message.role === "assistant") {
					const id = crypto.randomUUID();
					activeAssistantIds.current.set(agentInstanceId, id);
					updateAgentActivity(agentInstanceId, { label: "正在生成回复", kind: "working", queued: 0 });
					updateTranscript(agentInstanceId, (items) => [
						...items,
						{
							id,
							type: "assistant",
							text: "",
							thinking: "",
							status: "streaming",
							createdAt: new Date().toISOString(),
						},
					]);
				}
				return;
			}
			if (type === "message_update") {
				const assistantEvent = event.assistantMessageEvent;
				if (isRecord(assistantEvent)) {
					const update = assistantEvent;
					if (update.type === "text_delta" && typeof update.delta === "string") {
						const delta = update.delta;
						pendingToolFailures.current.delete(agentInstanceId);
						setToolRecoveryOffers((current) => {
							if (!(agentInstanceId in current)) return current;
							const next = { ...current };
							delete next[agentInstanceId];
							return next;
						});
						const id = activeAssistantIds.current.get(agentInstanceId) ?? crypto.randomUUID();
						if (!activeAssistantIds.current.has(agentInstanceId))
							activeAssistantIds.current.set(agentInstanceId, id);
						updateTranscript(agentInstanceId, (items) => {
							const index = items.findIndex((item) => item.id === id);
							if (index === -1)
								return [
									...items,
									{
										id,
										type: "assistant",
										text: delta,
										status: "streaming",
										createdAt: new Date().toISOString(),
									},
								];
							return items.map((item) =>
								item.id === id && item.type === "assistant"
									? { ...item, text: item.text + delta, status: "streaming" }
									: item,
							);
						});
					}
					if (update.type === "thinking_delta" && typeof update.delta === "string") {
						const delta = update.delta;
						const id = activeAssistantIds.current.get(agentInstanceId) ?? crypto.randomUUID();
						if (!activeAssistantIds.current.has(agentInstanceId))
							activeAssistantIds.current.set(agentInstanceId, id);
						updateAgentActivity(agentInstanceId, { label: "Pi 正在思考", kind: "working", queued: 0 });
						updateTranscript(agentInstanceId, (items) => {
							const index = items.findIndex((item) => item.id === id);
							if (index === -1)
								return [
									...items,
									{
										id,
										type: "assistant",
										text: "",
										thinking: delta,
										status: "streaming",
										createdAt: new Date().toISOString(),
									},
								];
							return items.map((item) =>
								item.id === id && item.type === "assistant"
									? { ...item, thinking: (item.thinking ?? "") + delta, status: "streaming" }
									: item,
							);
						});
					}
				}
				return;
			}
			if (type === "message_end") {
				const message = event.message;
				if (isRecord(message) && message.role === "assistant") {
					finishActiveAssistant(message);
					if (extractMessageText(message.content)) markAgentUnread(agentInstanceId);
					const status = assistantMessageStatus(message);
					updateAgentActivity(
						agentInstanceId,
						status === "complete" ? { label: "正在处理后续步骤", kind: "working", queued: 0 } : null,
					);
				}
				return;
			}
			if (type === "turn_end" && isRecord(event.message)) {
				const status = assistantMessageStatus(event.message);
				if (status !== "complete") {
					finishActiveAssistant(event.message, status);
					updateAgentActivity(agentInstanceId, null);
				}
				return;
			}
			if (type === "tool_execution_start" && typeof event.toolCallId === "string") {
				pendingToolFailures.current.delete(agentInstanceId);
				const toolCallId = event.toolCallId;
				const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
				updateAgentActivity(agentInstanceId, { label: `正在运行 ${toolName}`, kind: "tool", queued: 0 });
				updateTranscript(agentInstanceId, (items) => [
					...items,
					{
						id: toolCallId,
						type: "tool",
						name: toolName,
						args: event.args === undefined ? "" : JSON.stringify(event.args, null, 2),
						text: "",
						status: "running",
						isError: false,
					},
				]);
				return;
			}
			if (type === "tool_execution_update" && typeof event.toolCallId === "string") {
				const toolCallId = event.toolCallId;
				updateTranscript(agentInstanceId, (items) =>
					items.map((item) =>
						item.id === toolCallId && item.type === "tool"
							? { ...item, text: extractMessageText(event.partialResult) || item.text || "正在执行…" }
							: item,
					),
				);
				return;
			}
			if (type === "tool_execution_end" && typeof event.toolCallId === "string") {
				const toolCallId = event.toolCallId;
				if (event.isError === true) {
					pendingToolFailures.current.set(agentInstanceId, {
						toolName: typeof event.toolName === "string" ? event.toolName : "tool",
						reason: extractMessageText(event.result) || "工具执行失败",
					});
				}
				markAgentUnread(agentInstanceId);
				updateAgentActivity(
					agentInstanceId,
					event.isError === true
						? { label: "工具失败，Pi 正在处理错误", kind: "retry", queued: 0 }
						: { label: "正在继续处理", kind: "working", queued: 0 },
				);
				updateTranscript(agentInstanceId, (items) =>
					items.map((item) =>
						item.id === toolCallId && item.type === "tool"
							? {
									...item,
									status: "completed",
									text: extractMessageText(event.result) || item.text || "已完成",
									isError: event.isError === true,
								}
							: item,
					),
				);
				return;
			}
			if (type === "queue_update") {
				const steering = Array.isArray(event.steering) ? event.steering.length : 0;
				const followUp = Array.isArray(event.followUp) ? event.followUp.length : 0;
				const queued = steering + followUp;
				if (queued > 0)
					updateAgentActivity(agentInstanceId, { label: `已追加 ${queued} 条消息`, kind: "working", queued });
				return;
			}
			if (type === "compaction_start") {
				updateAgentActivity(agentInstanceId, { label: "正在压缩上下文", kind: "compaction", queued: 0 });
				return;
			}
			if (type === "compaction_end") {
				updateAgentActivity(agentInstanceId, null);
				void refreshAgentSessionSnapshot(locator);
				return;
			}
			if (type === "auto_retry_start") {
				const attempt = typeof event.attempt === "number" ? event.attempt : 1;
				const maxAttempts = typeof event.maxAttempts === "number" ? event.maxAttempts : 1;
				updateAgentActivity(agentInstanceId, {
					label: `请求失败，正在重试 ${attempt}/${maxAttempts}`,
					kind: "retry",
					queued: 0,
				});
				return;
			}
			if (type === "auto_retry_end") {
				updateAgentActivity(
					agentInstanceId,
					event.success === true
						? { label: "重试成功，正在恢复回复", kind: "working", queued: 0 }
						: { label: "重试失败，Pi 正在结束本轮", kind: "retry", queued: 0 },
				);
				return;
			}
			if (type === "rpc_timeout") {
				const command = typeof event.command === "string" ? event.command : "unknown";
				updateAgentActivity(agentInstanceId, {
					label: `Pi RPC 超时（${command}），可从 Agent 菜单重新连接`,
					kind: "retry",
					queued: 0,
				});
				updateTranscript(agentInstanceId, (items) => [
					...items,
					{
						id: crypto.randomUUID(),
						type: "system",
						text: `Pi RPC 命令 ${command} 响应超时。进程可能仍在运行；如果状态没有恢复，请使用“重新连接 Pi”。`,
						createdAt: new Date().toISOString(),
					},
				]);
				return;
			}
			if (type === "process_recovery_start") {
				setPendingPermissionRequests((current) => {
					if (!(agentInstanceId in current)) return current;
					const next = { ...current };
					delete next[agentInstanceId];
					return next;
				});
				if (extensionDialog?.agentInstanceId === agentInstanceId) setExtensionDialog(null);
				const attempt = typeof event.attempt === "number" ? event.attempt : 1;
				finishActiveAssistant(undefined, "error");
				updateAgentActivity(agentInstanceId, {
					label: event.manual === true ? "正在重新连接 Pi" : `Pi 意外退出，正在恢复连接（${attempt}/2）`,
					kind: "reconnecting",
					queued: 0,
				});
				return;
			}
			if (type === "process_recovered") {
				markAgentUnread(agentInstanceId);
				updateAgentActivity(agentInstanceId, null);
				updateAgentStatus(clientEvent, "idle");
				updateTranscript(agentInstanceId, (items) => [
					...items,
					{
						id: crypto.randomUUID(),
						type: "system",
						text:
							event.manual === true
								? "已重新连接 Pi，并恢复当前 Session。"
								: "Pi 进程已自动恢复并重新载入当前 Session。中断前尚未完成的请求需要重新发送。",
						createdAt: new Date().toISOString(),
					},
				]);
				void refreshAgentSessionSnapshot(locator);
				return;
			}
			if (type === "process_recovery_failed") {
				const attempt = typeof event.attempt === "number" ? event.attempt : 1;
				const maxAttempts = typeof event.maxAttempts === "number" ? event.maxAttempts : 2;
				if (attempt >= maxAttempts) {
					updateAgentActivity(agentInstanceId, null);
					updateAgentStatus(clientEvent, "failed");
					updateTranscript(agentInstanceId, (items) => [
						...items,
						{
							id: crypto.randomUUID(),
							type: "system",
							text: `Pi 自动恢复失败：${typeof event.error === "string" ? event.error : "未知错误"}。请使用 Agent 菜单手动重新连接。`,
							createdAt: new Date().toISOString(),
						},
					]);
				}
				return;
			}
			if (type === "agent_configuration_warning" && typeof event.error === "string") {
				const warning = event.error;
				updateTranscript(agentInstanceId, (items) => [
					...items,
					{ id: crypto.randomUUID(), type: "system", text: warning, createdAt: new Date().toISOString() },
				]);
				return;
			}
			if (type === "process_error" || type === "process_exit") {
				if (event.expected === true) return;
				finishActiveAssistant(undefined, "error");
				updateAgentActivity(agentInstanceId, {
					label: "Pi 连接已中断，等待自动恢复",
					kind: "reconnecting",
					queued: 0,
				});
			}
		},
		[
			activeAgentId,
			extensionDialog,
			refreshAgentSessionSnapshot,
			updateAgentActivity,
			updateAgentStatus,
			updateTranscript,
			markAgentUnread,
		],
	);

	useEffect(() => {
		if (!("codepiddy" in window)) return;
		return window.codepiddy.onAgentEvent(handleAgentEvent);
	}, [handleAgentEvent]);

	useEffect(() => {
		if (!("codepiddy" in window) || demoMode) return;
		void (async () => {
			try {
				const restored = await window.codepiddy.getStartupProject();
				setRecentProjects(await window.codepiddy.listRecentProjects());
				if (!restored) return;
				setProject(restored);
				setSelection({ type: "project" });
				setExpanded(new Set([`project:${restored.id}`, "lane:requirements", "lane:bugs"]));
			} catch (caught) {
				setError(caught instanceof Error ? caught.message : "恢复项目失败");
			}
		})();
	}, []);

	useEffect(() => {
		if (!("codepiddy" in window) || !project || !selectedWorkItem || selection.type !== "agent") return;
		const slot = selectedWorkItem.agentSlots.find((candidate) => candidate.role === selection.role);
		if (!slot?.currentInstanceId) return;
		const locator = {
			agentInstanceId: slot.currentInstanceId,
			projectId: project.id,
			workItemId: selectedWorkItem.id,
			role: slot.role,
		};
		void window.codepiddy
			.activateAgent(locator)
			.then(async () => {
				const permission = await window.codepiddy.getPendingPermissionRequest(locator);
				if (permission) {
					setPendingPermissionRequests((current) => ({
						...current,
						[slot.currentInstanceId!]: permission,
					}));
					setExtensionDialog(extensionDialogFromPermission(permission));
				}
				const [modelResult, commandResult, snapshotResult] = await Promise.allSettled([
					window.codepiddy.getAgentModelSelection(locator),
					loadAgentCommands(locator),
					window.codepiddy.getAgentSessionSnapshot(locator),
				]);
				if (modelResult.status === "fulfilled") {
					setModelSelections((current) => ({ ...current, [slot.currentInstanceId!]: modelResult.value }));
				}
				if (snapshotResult.status === "fulfilled") {
					setAgentSessionSnapshots((current) => ({
						...current,
						[slot.currentInstanceId!]: snapshotResult.value,
					}));
				}

				if (modelResult.status === "rejected") {
					setError(modelResult.reason instanceof Error ? modelResult.reason.message : "读取 Pi 模型失败");
				} else if (commandResult.status === "rejected") {
					setError(commandResult.reason instanceof Error ? commandResult.reason.message : "读取 Pi 命令失败");
				} else if (snapshotResult.status === "rejected") {
					setError(
						snapshotResult.reason instanceof Error ? snapshotResult.reason.message : "读取 Session 状态失败",
					);
				}
			})
			.catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "恢复 Agent 失败"));
	}, [loadAgentCommands, project, selectedWorkItem, selection]);

	useEffect(() => {
		if (!activeAgentId) {
			setExtensionDialog(null);
			setDeferredPermissionAgentId(null);
			return;
		}
		if (deferredPermissionAgentId === activeAgentId) {
			setExtensionDialog(null);
			return;
		}
		const pending = pendingPermissionRequests[activeAgentId];
		setExtensionDialog((current) => {
			if (current?.agentInstanceId === activeAgentId) return current;
			return pending ? extensionDialogFromPermission(pending) : null;
		});
	}, [activeAgentId, deferredPermissionAgentId, pendingPermissionRequests]);

	useEffect(() => {
		if (
			demoMode ||
			!activeDraftStartsWithSlash ||
			!("codepiddy" in window) ||
			!project ||
			!selectedWorkItem ||
			selection.type !== "agent"
		)
			return;
		const slot = selectedWorkItem.agentSlots.find((candidate) => candidate.role === selection.role);
		if (!slot?.currentInstanceId) return;
		void loadAgentCommands({
			agentInstanceId: slot.currentInstanceId,
			projectId: project.id,
			workItemId: selectedWorkItem.id,
			role: slot.role,
		}).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "读取 Pi 命令失败"));
	}, [activeDraftStartsWithSlash, loadAgentCommands, project, selectedWorkItem, selection]);

	useEffect(() => {
		if (!("codepiddy" in window) || !project || selection.type !== "agent") {
			setFileMatches([]);
			return;
		}
		const item = project.lanes
			.find((lane) => lane.kind === selection.lane)
			?.workItems.find((workItem) => workItem.id === selection.workItemId);
		const slot = item?.agentSlots.find((candidate) => candidate.role === selection.role);
		const draft = slot?.currentInstanceId ? (drafts[slot.currentInstanceId] ?? "") : "";
		const match = /(?:^|\s)@([^\s]*)$/.exec(draft);
		if (!match) {
			setFileMatches([]);
			return;
		}
		const timer = setTimeout(() => {
			void window.codepiddy.searchProjectFiles(project.rootPath, match[1] ?? "").then(setFileMatches);
		}, 120);
		return () => clearTimeout(timer);
	}, [drafts, project, selection]);

	useEffect(() => {
		if (!archiveToast) return;
		const timer = window.setTimeout(() => setArchiveToast(null), 4500);
		return () => window.clearTimeout(timer);
	}, [archiveToast]);

	useEffect(() => {
		const element = transcriptRef.current;
		if (!element || !activeAgentId) {
			setShowJumpToLatest(false);
			return;
		}
		const frame = requestAnimationFrame(() => {
			const stored = scrollPositions.current[activeAgentId];
			element.scrollTop = stored ?? element.scrollHeight;
			setShowJumpToLatest(element.scrollHeight - element.scrollTop - element.clientHeight > 160);
		});
		return () => cancelAnimationFrame(frame);
	}, [activeAgentId]);

	useEffect(() => {
		const element = transcriptRef.current;
		if (!element || !activeAgentId || showJumpToLatest) return;
		const scrollToBottom = (): void => {
			const frame = requestAnimationFrame(() => {
				element.scrollTop = element.scrollHeight;
				scrollPositions.current[activeAgentId] = element.scrollTop;
			});
			requestAnimationFrame(() => cancelAnimationFrame(frame));
		};
		scrollToBottom();
		const observer = new MutationObserver(scrollToBottom);
		observer.observe(element, { childList: true, subtree: true, characterData: true });
		return () => observer.disconnect();
	}, [activeAgentId, showJumpToLatest]);

	function handleTranscriptScroll(): void {
		const element = transcriptRef.current;
		if (!element || !activeAgentId) return;
		scrollPositions.current[activeAgentId] = element.scrollTop;
		localStorage.setItem("codepiddy:agent-scroll-positions", JSON.stringify(scrollPositions.current));
		const existing = agentUiSaveTimers.current.get(activeAgentId);
		if (existing) window.clearTimeout(existing);
		const timer = window.setTimeout(() => {
			void window.codepiddy.saveAgentUiState({
				agentInstanceId: activeAgentId,
				draft: drafts[activeAgentId] ?? "",
				scrollTop: scrollPositions.current[activeAgentId] ?? 0,
				unreadCount: unreadCounts[activeAgentId] ?? 0,
			});
			agentUiSaveTimers.current.delete(activeAgentId);
		}, 200);
		agentUiSaveTimers.current.set(activeAgentId, timer);
		const awayFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight > 160;
		setShowJumpToLatest(awayFromBottom);
		if (!awayFromBottom) {
			setUnreadCounts((current) =>
				(current[activeAgentId] ?? 0) === 0 ? current : { ...current, [activeAgentId]: 0 },
			);
		}
	}

	function jumpToLatest(): void {
		const element = transcriptRef.current;
		if (!element) return;
		element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
		setShowJumpToLatest(false);
		if (activeAgentId) setUnreadCounts((current) => ({ ...current, [activeAgentId]: 0 }));
	}

	async function openProject(): Promise<void> {
		setBusy(true);
		setError(null);
		try {
			const nextProject = await window.codepiddy.openProject();
			if (!nextProject) return;
			if (project && project.rootPath.toLowerCase() !== nextProject.rootPath.toLowerCase()) {
				await window.codepiddy.closeProject(project.rootPath);
			}
			setProject(nextProject);
			setRecentProjects(await window.codepiddy.listRecentProjects());
			setSelection({ type: "project" });
			setExpanded(new Set([`project:${nextProject.id}`, "lane:requirements", "lane:bugs"]));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "打开项目失败");
		} finally {
			setBusy(false);
		}
	}

	async function switchProject(recent: RecentProject): Promise<void> {
		if (!recent.available) return;
		if (project?.rootPath.toLowerCase() === recent.rootPath.toLowerCase()) {
			setSelection({ type: "project" });
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const previousProject = project;
			const nextProject = await window.codepiddy.openRecentProject(recent.rootPath);
			if (previousProject) await window.codepiddy.closeProject(previousProject.rootPath);
			setProject(nextProject);
			setRecentProjects(await window.codepiddy.listRecentProjects());
			setSelection({ type: "project" });
			setExpanded(new Set([`project:${nextProject.id}`, "lane:requirements", "lane:bugs"]));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "切换项目失败");
			setRecentProjects(await window.codepiddy.listRecentProjects());
		} finally {
			setBusy(false);
		}
	}

	async function closeCurrentProject(): Promise<void> {
		if (!project) return;
		setBusy(true);
		setError(null);
		try {
			setRecentProjects(await window.codepiddy.closeProject(project.rootPath));
			setProject(null);
			setSelection({ type: "welcome" });
			setExpanded(new Set());
			setExtensionDialog(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "关闭项目失败");
		} finally {
			setBusy(false);
		}
	}

	async function forgetRecentProject(recent: RecentProject): Promise<void> {
		if (project?.rootPath.toLowerCase() === recent.rootPath.toLowerCase()) return;
		try {
			setRecentProjects(await window.codepiddy.forgetRecentProject(recent.rootPath));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "移除最近项目失败");
		}
	}

	function toggle(key: string): void {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	async function createWorkItem(): Promise<void> {
		if (!project || !dialog) return;
		setBusy(true);
		setError(null);
		try {
			const nextProject = await window.codepiddy.createWorkItem({
				projectRoot: project.rootPath,
				lane: dialog.lane,
				title: dialog.title,
				description: dialog.description,
			});
			const created = nextProject.lanes.find((lane) => lane.kind === dialog.lane)?.workItems[0];
			setProject(nextProject);
			setDialog(null);
			if (created) {
				setExpanded((current) => new Set([...current, `lane:${dialog.lane}`, `work-item:${created.id}`]));
				setSelection({ type: "work-item", lane: dialog.lane, workItemId: created.id });
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "创建工作项失败");
		} finally {
			setBusy(false);
		}
	}

	async function approveSelectedRequirement(): Promise<void> {
		if (!project || !selectedWorkItem || selectedWorkItem.lane !== "requirements") return;
		setBusy(true);
		setError(null);
		try {
			setProject(
				await window.codepiddy.approveRequirement({
					projectRoot: project.rootPath,
					workItemId: selectedWorkItem.id,
				}),
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "批准需求失败");
		} finally {
			setBusy(false);
		}
	}

	async function archiveWorkItem(lane: LaneKind, item: WorkItemSummary): Promise<void> {
		if (!project) return;
		setBusy(true);
		try {
			const nextProject = await window.codepiddy.archiveWorkItem({
				projectRoot: project.rootPath,
				lane,
				workItemId: item.id,
			});
			setProject(nextProject);
			setSelection({ type: "lane", lane });
			setArchiveToast({ lane, workItemId: item.id, title: item.title });
		} finally {
			setBusy(false);
		}
	}

	async function restoreWorkItem(lane: LaneKind, workItemId: string): Promise<void> {
		if (!project) return;
		setBusy(true);
		setError(null);
		try {
			const nextProject = await window.codepiddy.restoreWorkItem({
				projectRoot: project.rootPath,
				lane,
				workItemId,
			});
			setProject(nextProject);
			setExpanded((current) => new Set([...current, `lane:${lane}`, `work-item:${workItemId}`]));
			setSelection({ type: "work-item", lane, workItemId });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "恢复工作项失败");
		} finally {
			setBusy(false);
		}
	}

	async function restoreArchived(): Promise<void> {
		if (!archiveToast) return;
		const toast = archiveToast;
		setArchiveToast(null);
		await restoreWorkItem(toast.lane, toast.workItemId);
	}

	async function renameSelectedWorkItem(): Promise<void> {
		if (!project || !renameDialog || !renameDialog.title.trim()) return;
		setBusy(true);
		setError(null);
		try {
			setProject(
				await window.codepiddy.renameWorkItem({
					projectRoot: project.rootPath,
					lane: renameDialog.lane,
					workItemId: renameDialog.item.id,
					title: renameDialog.title,
				}),
			);
			setRenameDialog(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "重命名工作项失败");
		} finally {
			setBusy(false);
		}
	}

	async function permanentlyDeleteWorkItem(): Promise<void> {
		if (!project || !deleteDialog) return;
		setBusy(true);
		setError(null);
		try {
			setProject(
				await window.codepiddy.deleteWorkItem({
					projectRoot: project.rootPath,
					lane: deleteDialog.lane,
					workItemId: deleteDialog.item.id,
				}),
			);
			setDeleteDialog(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "永久删除工作项失败");
		} finally {
			setBusy(false);
		}
	}

	function renderWorkItem(lane: LaneKind, item: WorkItemSummary) {
		const key = `work-item:${item.id}`;
		const normalizedQuery = searchQuery.trim().toLowerCase();
		const itemMatches =
			item.id.toLowerCase().includes(normalizedQuery) || item.title.toLowerCase().includes(normalizedQuery);
		const agentMatches = item.agentSlots.some(
			(slot) => slot.displayName.toLowerCase().includes(normalizedQuery) || slot.role.includes(normalizedQuery),
		);
		const isExpanded = expanded.has(key) || Boolean(normalizedQuery && agentMatches && !itemMatches);
		const isSelected = selection.type === "work-item" && selection.workItemId === item.id;
		return (
			<div className="tree-group" key={item.id}>
				<div className={`tree-row work-item-row ${isSelected ? "selected" : ""}`}>
					<button className="chevron-button" type="button" onClick={() => toggle(key)} aria-label="展开工作项">
						<Chevron expanded={isExpanded} />
					</button>
					<button
						className="tree-label"
						type="button"
						onClick={() => setSelection({ type: "work-item", lane, workItemId: item.id })}
					>
						<AppIcon name="folder" className="folder-glyph" />
						<span className="truncate">
							{item.id}：{item.title}
						</span>
					</button>
					<IconButton label="重命名工作项" onClick={() => setRenameDialog({ lane, item, title: item.title })}>
						<AppIcon name="edit" />
					</IconButton>
					<IconButton label="归档工作项" onClick={() => void archiveWorkItem(lane, item)}>
						<AppIcon name="archive" />
					</IconButton>
				</div>
				{isExpanded ? (
					<div className="tree-children agent-children">
						{item.agentSlots.map((slot) => (
							<button
								className={`tree-row agent-row ${selection.type === "agent" && selection.workItemId === item.id && selection.role === slot.role ? "selected" : ""}`}
								type="button"
								key={slot.role}
								onClick={() => setSelection({ type: "agent", lane, workItemId: item.id, role: slot.role })}
							>
								<span className="agent-glyph">{roleGlyphs[slot.role]}</span>
								<span className="truncate" title={slot.blockedReason}>
									{slot.displayName}
								</span>
								<span className={`agent-create status-${slot.blockedReason ? "waiting" : slot.status}`}>
									{slot.blockedReason ? "等待" : statusLabels[slot.status]}
								</span>
								{slot.currentInstanceId && (unreadCounts[slot.currentInstanceId] ?? 0) > 0 ? (
									<span className="agent-unread">
										{Math.min(99, unreadCounts[slot.currentInstanceId] ?? 0)}
									</span>
								) : null}
							</button>
						))}
					</div>
				) : null}
			</div>
		);
	}

	function renderLane(lane: ProjectSummary["lanes"][number]) {
		const key = `lane:${lane.kind}`;
		const isExpanded = expanded.has(key);
		const normalizedQuery = searchQuery.trim().toLowerCase();
		const activeItems = lane.workItems
			.filter((item) => item.status === "active")
			.filter(
				(item) =>
					!normalizedQuery ||
					lane.displayName.toLowerCase().includes(normalizedQuery) ||
					item.id.toLowerCase().includes(normalizedQuery) ||
					item.title.toLowerCase().includes(normalizedQuery) ||
					item.agentSlots.some(
						(slot) =>
							slot.displayName.toLowerCase().includes(normalizedQuery) || slot.role.includes(normalizedQuery),
					),
			);
		const archivedItems = lane.workItems.filter(
			(item) =>
				item.status === "archived" &&
				(!normalizedQuery ||
					item.id.toLowerCase().includes(normalizedQuery) ||
					item.title.toLowerCase().includes(normalizedQuery)),
		);
		const archivedKey = `archived:${lane.kind}`;
		const archivedExpanded = expanded.has(archivedKey) || Boolean(normalizedQuery && archivedItems.length > 0);
		return (
			<div className="tree-group" key={lane.kind}>
				<div
					className={`tree-row lane-row ${selection.type === "lane" && selection.lane === lane.kind ? "selected" : ""}`}
				>
					<button className="chevron-button" type="button" onClick={() => toggle(key)} aria-label="展开工作类型">
						<Chevron expanded={isExpanded} />
					</button>
					<button
						className="tree-label"
						type="button"
						onClick={() => setSelection({ type: "lane", lane: lane.kind })}
					>
						<AppIcon name="folder" className="folder-glyph" />
						<span>{lane.displayName}</span>
					</button>
					<IconButton
						label={`创建${lane.displayName}`}
						onClick={() => setDialog({ lane: lane.kind, title: "", description: "" })}
					>
						<AppIcon name="plus" />
					</IconButton>
				</div>
				{isExpanded ? (
					<div className="tree-children">
						{activeItems.map((item) => renderWorkItem(lane.kind, item))}
						{activeItems.length === 0 ? <div className="tree-empty">暂无工作项</div> : null}
						{archivedItems.length > 0 ? (
							<div className="archived-section">
								<button className="archived-count" type="button" onClick={() => toggle(archivedKey)}>
									<Chevron expanded={archivedExpanded} />
									<span>已归档 {archivedItems.length}</span>
								</button>
								{archivedExpanded ? (
									<div className="archived-list">
										{archivedItems.map((item) => (
											<div className="archived-row" key={item.id}>
												<AppIcon name="folder" className="folder-glyph" />
												<span className="truncate">
													{item.id}：{item.title}
												</span>
												<IconButton
													label="恢复工作项"
													onClick={() => void restoreWorkItem(lane.kind, item.id)}
												>
													<AppIcon name="restore" />
												</IconButton>
												<IconButton
													label="永久删除工作项"
													onClick={() => setDeleteDialog({ lane: lane.kind, item })}
												>
													<AppIcon name="close" />
												</IconButton>
											</div>
										))}
									</div>
								) : null}
							</div>
						) : null}
					</div>
				) : null}
			</div>
		);
	}

	async function createAgent(slot: AgentSlotSummary): Promise<void> {
		if (!project || !selectedWorkItem || !("codepiddy" in window)) return;
		if (slot.blockedReason) {
			setError(slot.blockedReason);
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const nextProject = await window.codepiddy.createAgent({
				projectRoot: project.rootPath,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				workItemDirectory: selectedWorkItem.directoryPath,
				lane: selectedWorkItem.lane,
				role: slot.role,
			});
			setProject(nextProject);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "创建 Agent 失败");
		} finally {
			setBusy(false);
		}
	}

	async function sendPrompt(slot: AgentSlotSummary, explicitMessage?: string): Promise<void> {
		if (!project || !selectedWorkItem || !slot.currentInstanceId || (!demoMode && !("codepiddy" in window))) return;
		const agentId = slot.currentInstanceId;
		const message = explicitMessage?.trim() || drafts[agentId]?.trim();
		if (!message) return;
		const locator = {
			agentInstanceId: agentId,
			projectId: project.id,
			workItemId: selectedWorkItem.id,
			role: slot.role,
		};
		const invocation = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(message);
		if (invocation) {
			const name = invocation[1] ?? "";
			const args = invocation[2]?.trim() ?? "";
			let command = (agentCommands[agentId] ?? []).find((candidate) => candidate.name === name);
			if (!command && "codepiddy" in window) {
				try {
					const commands = await loadAgentCommands(locator);
					command = commands.find((candidate) => candidate.name === name);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : "读取 Pi 命令失败");
					return;
				}
			}
			if (!command) {
				setError(`Pi 当前没有 /${name} 命令。请重新打开命令菜单或执行 /reload。`);
				return;
			}
			if (command.source === "builtin") {
				if (name === "settings") {
					setDrafts((current) => ({ ...current, [agentId]: "" }));
					await openSettings();
					return;
				}
				if (name === "model") {
					if (!args) {
						setDrafts((current) => ({ ...current, [agentId]: "" }));
						await openModelPicker(slot);
						return;
					}
					const selection = modelSelections[agentId];
					const model = selection?.availableModels.find(
						(candidate) => `${candidate.provider}/${candidate.id}` === args,
					);
					if (!model) {
						setError(`Pi 当前不可用模型：${args}`);
						return;
					}
					if (await chooseModel(slot, model.provider, model.id)) {
						setDrafts((current) => ({ ...current, [agentId]: "" }));
					}
					return;
				}
				if (name === "thinking") {
					if (!args) {
						setDrafts((current) => ({ ...current, [agentId]: "" }));
						await openModelPicker(slot);
						return;
					}
					const selection = modelSelections[agentId];
					if (!selection?.availableThinkingLevels.includes(args)) {
						setError(`Pi 当前模型不支持 Thinking Level：${args}`);
						return;
					}
					if (await chooseThinking(slot, args)) {
						setDrafts((current) => ({ ...current, [agentId]: "" }));
					}
					return;
				}
				if (name === "fork" || name === "tree" || name === "session") {
					setDrafts((current) => ({ ...current, [agentId]: "" }));
					await openSessionPanel(slot);
					return;
				}
				setBusy(true);
				setError(null);
				try {
					const result = await window.codepiddy.invokeAgentBuiltinCommand({ ...locator, name, args });
					if (result.copiedText) await navigator.clipboard.writeText(result.copiedText);
					setDrafts((current) => ({ ...current, [agentId]: "" }));
					if (result.sessionReset) setTranscripts((current) => ({ ...current, [agentId]: [] }));
					if (result.message) {
						updateTranscript(agentId, (items) => [
							...items,
							{
								id: crypto.randomUUID(),
								type: "system",
								text: result.message!,
								createdAt: new Date().toISOString(),
							},
						]);
					}
					if (result.commandsChanged || result.sessionReset) {
						const [modelSelection, commands] = await Promise.all([
							window.codepiddy.getAgentModelSelection(locator),
							window.codepiddy.getAgentCommands(locator),
						]);
						setModelSelections((current) => ({ ...current, [agentId]: modelSelection }));
						setAgentCommands((current) => ({ ...current, [agentId]: commands }));
					}
					void refreshAgentSessionSnapshot(locator);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : `执行 /${name} 失败`);
				} finally {
					setBusy(false);
				}
				return;
			}
		}
		try {
			await window.codepiddy.sendAgentPrompt({
				...locator,
				message,
				streamingBehavior: "steer",
			});
			setDrafts((current) => ({ ...current, [agentId]: "" }));
			pendingToolFailures.current.delete(agentId);
			setToolRecoveryOffers((current) => {
				if (!(agentId in current)) return current;
				const next = { ...current };
				delete next[agentId];
				return next;
			});
			const delivery = slot.status === "running" ? "steer" : undefined;
			updateTranscript(agentId, (items) => [
				...items,
				{
					id: crypto.randomUUID(),
					type: "user",
					text: message,
					...(delivery ? { delivery } : {}),
					createdAt: new Date().toISOString(),
				},
			]);
			if (delivery) updateAgentActivity(agentId, { label: "消息已追加到当前运行", kind: "working", queued: 1 });
		} catch (caught) {
			try {
				const leaseStatus = await window.codepiddy.getProjectWriteLeaseStatus(project.id);
				if (leaseStatus.lease && leaseStatus.stale) {
					setWriteLeaseDialog(leaseStatus);
					return;
				}
			} catch {}
			setError(clientErrorMessage(caught, "发送消息失败"));
		}
	}

	async function continueAfterToolFailure(slot: AgentSlotSummary): Promise<void> {
		if (!slot.currentInstanceId) return;
		const offer = toolRecoveryOffers[slot.currentInstanceId];
		if (!offer) return;
		await sendPrompt(
			slot,
			`上一个 ${offer.toolName} 工具调用失败了。请阅读失败原因，不要原样重复相同调用；优先使用允许的路径、替代工具或无工具方案继续处理。如果无法恢复，请明确说明阻塞原因。`,
		);
	}

	async function clearStaleWriteLease(): Promise<void> {
		if (!project) return;
		setBusy(true);
		setError(null);
		try {
			await window.codepiddy.clearStaleProjectWriteLease(project.id);
			setWriteLeaseDialog(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "清理写锁失败");
		} finally {
			setBusy(false);
		}
	}

	const abortAgent = useCallback(
		async (slot: AgentSlotSummary): Promise<void> => {
			if (!project || !selectedWorkItem || !slot.currentInstanceId || !("codepiddy" in window)) return;
			const agentId = slot.currentInstanceId;
			if (abortingAgents[agentId]) return;
			const locator: AgentInstanceLocator = {
				agentInstanceId: agentId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
			};
			setAbortingAgents((current) => ({ ...current, [agentId]: true }));
			setError(null);
			updateAgentActivity(agentId, null);
			const assistantId = activeAssistantIds.current.get(agentId);
			if (assistantId) {
				updateTranscript(agentId, (items) => finalizeAssistantTranscript(items, assistantId, undefined, "aborted"));
				activeAssistantIds.current.delete(agentId);
			}
			try {
				if (extensionDialog?.agentInstanceId === agentId) {
					const requestId = extensionDialog.requestId;
					setExtensionDialog(null);
					await window.codepiddy.respondToExtensionUi({ ...locator, requestId, cancelled: true });
				}
				await window.codepiddy.abortAgent(locator);
				setPendingPermissionRequests((current) => {
					const next = { ...current };
					delete next[agentId];
					return next;
				});
				pendingToolFailures.current.delete(agentId);
				setToolRecoveryOffers((current) => {
					const next = { ...current };
					delete next[agentId];
					return next;
				});
				updateAgentStatus({ ...locator, event: {} }, "idle");
				void refreshAgentSessionSnapshot(locator);
			} catch (caught) {
				setError(clientErrorMessage(caught, "中断当前回复失败"));
			} finally {
				setAbortingAgents((current) => ({ ...current, [agentId]: false }));
			}
		},
		[
			abortingAgents,
			extensionDialog,
			project,
			refreshAgentSessionSnapshot,
			selectedWorkItem,
			updateAgentActivity,
			updateAgentStatus,
			updateTranscript,
		],
	);

	async function openSessionPanel(slot: AgentSlotSummary): Promise<void> {
		if (!project || !selectedWorkItem || !slot.currentInstanceId) return;
		setAgentActionsOpen(null);
		if (demoMode) {
			setSessionPanel({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
				displayName: slot.displayName,
				snapshot: demoSessionSnapshot,
			});
			return;
		}
		setSessionPanelLoading(true);
		setError(null);
		try {
			const snapshot = await window.codepiddy.getAgentSessionSnapshot({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
			});
			setSessionPanel({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
				displayName: slot.displayName,
				snapshot,
			});
			setAgentSessionSnapshots((current) => ({ ...current, [slot.currentInstanceId!]: snapshot }));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "读取会话树失败");
		} finally {
			setSessionPanelLoading(false);
		}
	}

	async function forkAgentSession(entryId: string): Promise<void> {
		if (!sessionPanel) return;
		setSessionPanelLoading(true);
		setError(null);
		try {
			const result = await window.codepiddy.forkAgentSession({
				agentInstanceId: sessionPanel.agentInstanceId,
				projectId: sessionPanel.projectId,
				workItemId: sessionPanel.workItemId,
				role: sessionPanel.role,
				entryId,
			});
			if (result.cancelled) return;
			setSessionPanel((current) => (current ? { ...current, snapshot: result.snapshot } : current));
			setAgentSessionSnapshots((current) => ({ ...current, [sessionPanel.agentInstanceId]: result.snapshot }));
			setDrafts((current) => ({ ...current, [sessionPanel.agentInstanceId]: result.selectedText }));
			const modelSelection = await window.codepiddy.getAgentModelSelection({
				agentInstanceId: sessionPanel.agentInstanceId,
				projectId: sessionPanel.projectId,
				workItemId: sessionPanel.workItemId,
				role: sessionPanel.role,
			});
			setModelSelections((current) => ({ ...current, [sessionPanel.agentInstanceId]: modelSelection }));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Fork 会话失败");
		} finally {
			setSessionPanelLoading(false);
		}
	}

	async function cloneAgentSession(slot: AgentSlotSummary): Promise<void> {
		if (!project || !selectedWorkItem || !slot.currentInstanceId) return;
		setBusy(true);
		setError(null);
		setAgentActionsOpen(null);
		try {
			await window.codepiddy.cloneAgentSession({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "克隆会话失败");
		} finally {
			setBusy(false);
		}
	}

	async function reconnectAgent(slot: AgentSlotSummary): Promise<void> {
		if (!project || !selectedWorkItem || !slot.currentInstanceId) return;
		setBusy(true);
		setError(null);
		setAgentActionsOpen(null);
		try {
			await window.codepiddy.reconnectAgent({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
			});
		} catch (caught) {
			setError(clientErrorMessage(caught, "重新连接 Pi 失败"));
		} finally {
			setBusy(false);
		}
	}

	async function resetSelectedAgent(): Promise<void> {
		if (!project || !resetAgentDialog) return;
		const { workItem, slot } = resetAgentDialog;
		const oldAgentId = slot.currentInstanceId;
		if (!oldAgentId) return;
		setBusy(true);
		setError(null);
		try {
			const nextProject = await window.codepiddy.resetAgent({
				agentInstanceId: oldAgentId,
				projectRoot: project.rootPath,
				projectId: project.id,
				workItemId: workItem.id,
				workItemDirectory: workItem.directoryPath,
				lane: workItem.lane,
				role: slot.role,
			});
			setProject(nextProject);
			setTranscripts((current) => {
				const next = { ...current };
				delete next[oldAgentId];
				return next;
			});
			setDrafts((current) => {
				const next = { ...current };
				delete next[oldAgentId];
				return next;
			});
			setModelSelections((current) => {
				const next = { ...current };
				delete next[oldAgentId];
				return next;
			});
			setAgentSessionSnapshots((current) => {
				const next = { ...current };
				delete next[oldAgentId];
				return next;
			});
			setResetAgentDialog(null);
			setAgentActionsOpen(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "重置 Agent 失败");
		} finally {
			setBusy(false);
		}
	}

	async function respondToExtensionDialog(response: {
		value?: string;
		confirmed?: boolean;
		cancelled?: true;
	}): Promise<void> {
		if (!extensionDialog || !("codepiddy" in window)) return;
		const current = extensionDialog;
		setExtensionDialog(null);
		try {
			await window.codepiddy.respondToExtensionUi({
				agentInstanceId: current.agentInstanceId,
				projectId: current.projectId,
				workItemId: current.workItemId,
				role: current.role,
				requestId: current.requestId,
				...response,
			});
			setPendingPermissionRequests((permissions) => {
				const next = { ...permissions };
				delete next[current.agentInstanceId];
				return next;
			});
			setDeferredPermissionAgentId((agentId) => (agentId === current.agentInstanceId ? null : agentId));
			updateAgentStatus(
				{
					agentInstanceId: current.agentInstanceId,
					projectId: current.projectId,
					workItemId: current.workItemId,
					role: current.role,
					event: {},
				},
				"running",
			);
		} catch (caught) {
			setExtensionDialog(current);
			setError(clientErrorMessage(caught, "提交权限响应失败"));
		}
	}

	useLayoutEffect(() => {
		if (!modelPickerAgentId) return;
		const currentSelection = modelSelections[modelPickerAgentId];
		const currentIndex = currentSelection
			? modelPickerOptions.findIndex(
					(model) => model.provider === currentSelection.model.provider && model.id === currentSelection.model.id,
				)
			: -1;
		const nextIndex = currentIndex >= 0 && !modelSearch ? currentIndex : 0;
		modelPickerSelectedIndexRef.current = nextIndex;
		setModelPickerSelectedIndex(nextIndex);
		modelSearchInputRef.current?.focus();
	}, [modelPickerAgentId, modelPickerOptions, modelSearch, modelSelections]);

	useEffect(() => {
		if (!modelPickerAgentId) return;
		const selected = document.querySelector<HTMLElement>(`[data-model-index="${modelPickerSelectedIndex}"]`);
		selected?.scrollIntoView({ block: "nearest" });
	}, [modelPickerAgentId, modelPickerSelectedIndex]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			if (extensionDialog) return;
			if (modelPickerAgentId) {
				setModelPickerAgentId(null);
				setModelSearch("");
			} else if (sessionPanel) setSessionPanel(null);
			else if (deleteDialog) setDeleteDialog(null);
			else if (resetAgentDialog) setResetAgentDialog(null);
			else if (renameDialog) setRenameDialog(null);
			else if (writeLeaseDialog) setWriteLeaseDialog(null);
			else if (dialog) setDialog(null);
			else if (selection.type === "agent" && selectedWorkItem) {
				const slot = selectedWorkItem.agentSlots.find((candidate) => candidate.role === selection.role);
				const agentId = slot?.currentInstanceId;
				if (
					slot &&
					agentId &&
					(slot.status === "running" || slot.status === "waiting" || agentActivities[agentId])
				) {
					event.preventDefault();
					void abortAgent(slot);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		agentActivities,
		deleteDialog,
		dialog,
		extensionDialog,
		modelPickerAgentId,
		renameDialog,
		resetAgentDialog,
		selectedWorkItem,
		selection,
		sessionPanel,
		writeLeaseDialog,
		abortAgent,
	]);

	async function openSettings(): Promise<void> {
		setSelection({ type: "settings" });
		if (!("codepiddy" in window)) return;
		const [status, skills, assignments, defaults] = await Promise.all([
			window.codepiddy.getSettingsStatus(),
			window.codepiddy.listAgentSkills(project?.rootPath),
			window.codepiddy.getRoleSkillAssignments(),
			window.codepiddy.getRoleModelDefaults(),
		]);
		setSettingsStatus(status);
		setAvailableSkills(skills);
		setRoleSkillAssignments(assignments);
		setRoleModelDefaults(defaults);
	}

	async function saveTavilyKey(): Promise<void> {
		if (!("codepiddy" in window)) return;
		try {
			setSettingsStatus(await window.codepiddy.saveTavilyApiKey(tavilyApiKey));
			setTavilyApiKey("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "保存 Tavily API Key 失败");
		}
	}

	async function clearTavilyKey(): Promise<void> {
		if (!("codepiddy" in window)) return;
		setSettingsStatus(await window.codepiddy.clearTavilyApiKey());
	}

	async function toggleRoleSkill(role: AgentRole, skillId: string, enabled: boolean): Promise<void> {
		if (!("codepiddy" in window) || roleSkillSaving) return;
		const current = roleSkillAssignments[role];
		const skillIds = enabled
			? [...new Set([...current, skillId])]
			: current.filter((candidate) => candidate !== skillId);
		setRoleSkillSaving(role);
		setError(null);
		try {
			setRoleSkillAssignments(
				await window.codepiddy.setRoleSkillAssignments({
					role,
					skillIds,
					...(project ? { projectRoot: project.rootPath } : {}),
				}),
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "保存 Agent Skill 配置失败");
		} finally {
			setRoleSkillSaving(null);
		}
	}

	async function openPiConfigFolder(): Promise<void> {
		try {
			await window.codepiddy.openPiConfigFolder();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "打开 Pi 配置目录失败");
		}
	}

	async function saveRoleModelDefault(slot: AgentSlotSummary): Promise<void> {
		if (!slot.currentInstanceId) return;
		const selection = modelSelections[slot.currentInstanceId];
		if (!selection) return;
		try {
			setRoleModelDefaults(
				await window.codepiddy.setRoleModelDefault({
					role: slot.role,
					provider: selection.model.provider,
					modelId: selection.model.id,
					modelName: selection.model.name,
					thinkingLevel: selection.thinkingLevel,
				}),
			);
			setModelPickerAgentId(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "保存角色默认模型失败");
		}
	}

	async function clearRoleModelDefault(role: AgentRole): Promise<void> {
		try {
			setRoleModelDefaults(await window.codepiddy.clearRoleModelDefault(role));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "清除角色默认模型失败");
		}
	}

	async function openModelPicker(slot: AgentSlotSummary): Promise<void> {
		if (!project || !selectedWorkItem || !slot.currentInstanceId) return;
		setModelPickerAgentId(slot.currentInstanceId);
		setModelSearch("");
		if (demoMode || !("codepiddy" in window)) return;
		setModelPickerBusy(true);
		setError(null);
		try {
			const selection = await window.codepiddy.getAgentModelSelection({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
			});
			setModelSelections((current) => ({ ...current, [slot.currentInstanceId!]: selection }));
		} catch (caught) {
			setError(clientErrorMessage(caught, "读取 Pi 模型失败"));
		} finally {
			setModelPickerBusy(false);
		}
	}

	async function chooseModel(slot: AgentSlotSummary, provider: string, modelId: string): Promise<boolean> {
		if (!project || !selectedWorkItem || !slot.currentInstanceId) return false;
		if (demoMode) {
			const current = modelSelections[slot.currentInstanceId];
			const model = current?.availableModels.find(
				(candidate) => candidate.provider === provider && candidate.id === modelId,
			);
			if (!current || !model) return false;
			setModelSelections((selections) => ({ ...selections, [slot.currentInstanceId!]: { ...current, model } }));
			setModelPickerAgentId(null);
			setModelSearch("");
			return true;
		}
		if (!("codepiddy" in window)) return false;
		setModelPickerBusy(true);
		setError(null);
		try {
			const nextSelection = await window.codepiddy.setAgentModel({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
				provider,
				modelId,
			});
			setModelSelections((current) => ({ ...current, [slot.currentInstanceId!]: nextSelection }));
			void refreshAgentSessionSnapshot({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
			});
			setModelPickerAgentId(null);
			setModelSearch("");
			return true;
		} catch (caught) {
			setError(clientErrorMessage(caught, "切换模型失败"));
			return false;
		} finally {
			setModelPickerBusy(false);
		}
	}

	async function chooseThinking(slot: AgentSlotSummary, level: string): Promise<boolean> {
		if (!project || !selectedWorkItem || !slot.currentInstanceId) return false;
		if (demoMode) {
			const current = modelSelections[slot.currentInstanceId];
			if (!current?.availableThinkingLevels.includes(level)) return false;
			setModelSelections((selections) => ({
				...selections,
				[slot.currentInstanceId!]: { ...current, thinkingLevel: level },
			}));
			return true;
		}
		if (!("codepiddy" in window)) return false;
		setModelPickerBusy(true);
		setError(null);
		try {
			const nextSelection = await window.codepiddy.setAgentThinking({
				agentInstanceId: slot.currentInstanceId,
				projectId: project.id,
				workItemId: selectedWorkItem.id,
				role: slot.role,
				level,
			});
			setModelSelections((current) => ({ ...current, [slot.currentInstanceId!]: nextSelection }));
			return true;
		} catch (caught) {
			setError(clientErrorMessage(caught, "切换 Thinking Level 失败"));
			return false;
		} finally {
			setModelPickerBusy(false);
		}
	}

	function renderMainContent() {
		if (selection.type === "settings") {
			return (
				<div className="settings-page">
					<h1>设置</h1>
					<section className="settings-card">
						<div>
							<h2>Tavily Search</h2>
							<p>API Key 使用 Electron safeStorage 加密保存在本机，不会写入项目或日志。</p>
						</div>
						<div className="settings-status">{settingsStatus?.tavilyApiKeyConfigured ? "已配置" : "未配置"}</div>
						<input
							type="password"
							value={tavilyApiKey}
							onChange={(event) => setTavilyApiKey(event.target.value)}
							placeholder="tvly-…"
						/>
						<div className="settings-actions">
							<button
								className="primary-button"
								type="button"
								onClick={() => void saveTavilyKey()}
								disabled={!tavilyApiKey.trim()}
							>
								保存
							</button>
							<button
								className="secondary-button"
								type="button"
								onClick={() => void clearTavilyKey()}
								disabled={!settingsStatus?.tavilyApiKeyConfigured}
							>
								清除
							</button>
						</div>
						<small>修改后，新启动或重新启动的 Agent 才会使用新 Key。</small>
					</section>

					<section className="settings-card skill-settings-card">
						<div className="settings-card-heading">
							<div>
								<h2>Agent Skills</h2>
								<p>每种 Agent 独立选择 Skill。修改会应用到新启动或重置后的 Agent。</p>
							</div>
							<div className="settings-status">{availableSkills.length} 个可用</div>
						</div>
						<div className="role-skill-grid">
							{(["requirement-analysis", "coding", "bug-fix", "review"] as const).map((role) => (
								<section className="role-skill-card" key={role}>
									<div className="role-skill-heading">
										<h3>{roleLabels[role]}</h3>
										<span>{roleSkillAssignments[role].length} 个</span>
									</div>
									<div className="role-skill-list">
										{availableSkills.map((skill) => {
											const checked = roleSkillAssignments[role].includes(skill.id);
											return (
												<label className={`role-skill-option ${checked ? "selected" : ""}`} key={skill.id}>
													<input
														type="checkbox"
														checked={checked}
														disabled={roleSkillSaving !== null}
														onChange={(event) =>
															void toggleRoleSkill(role, skill.id, event.target.checked)
														}
													/>
													<span>
														<strong>{skill.name}</strong>
														<small>{skill.description || skill.filePath}</small>
													</span>
													<em>{skill.source}</em>
												</label>
											);
										})}
										{availableSkills.length === 0 ? (
											<div className="provider-empty">未发现可用 Skill</div>
										) : null}
									</div>
								</section>
							))}
						</div>
					</section>

					<section className="settings-card pi-config-card">
						<div className="settings-card-heading">
							<div>
								<h2>Pi Provider 与模型</h2>
								<p>CodePIddy 不再维护自定义 Provider 表单，直接使用 Pi 原生配置，避免两套配置漂移。</p>
							</div>
							<button className="secondary-button" type="button" onClick={() => void openPiConfigFolder()}>
								打开配置目录
							</button>
						</div>
						<div className="pi-config-paths">
							<code>~/.pi/agent/models.json</code>
							<span>自定义 Provider 与模型</span>
							<code>~/.pi/agent/settings.json</code>
							<span>Pi 全局设置</span>
						</div>
						<div className="role-defaults">
							<div>
								<h3>角色默认模型</h3>
								<p>从 Agent 模型选择器保存；这里只显示和清除角色覆盖。</p>
							</div>
							<div className="role-default-list">
								{(["requirement-analysis", "coding", "bug-fix", "review"] as const).map((role) => {
									const configured = roleModelDefaults[role];
									return (
										<div className="role-default-row" key={role}>
											<span>{roleLabels[role]}</span>
											<strong>
												{configured
													? `${configured.modelName} · ${configured.thinkingLevel}`
													: "跟随 Pi 当前配置"}
											</strong>
											{configured ? (
												<button type="button" onClick={() => void clearRoleModelDefault(role)}>
													清除
												</button>
											) : null}
										</div>
									);
								})}
							</div>
						</div>
					</section>
				</div>
			);
		}

		if (!project) {
			return (
				<div className="empty-state">
					<div className="empty-mark app-icon-mark">
						<img src="./codepiddy-icon.png" alt="CodePIddy" />
					</div>
					<h1>打开一个项目开始工作</h1>
					<p>一个便于管理、适合程序员的 Coding Agent。</p>
					<button className="primary-button" type="button" onClick={() => void openProject()} disabled={busy}>
						选择项目
					</button>
				</div>
			);
		}
		if (selection.type === "agent" && selectedWorkItem) {
			const slot = selectedWorkItem.agentSlots.find((candidate) => candidate.role === selection.role);
			if (!slot) return null;
			const agentId = slot.currentInstanceId;
			const items = agentId ? (transcripts[agentId] ?? []) : [];
			const draft = agentId ? (drafts[agentId] ?? "") : "";
			const activity = agentId ? agentActivities[agentId] : undefined;
			const toolRecoveryOffer = agentId ? toolRecoveryOffers[agentId] : undefined;
			const sessionSnapshot = agentId ? agentSessionSnapshots[agentId] : undefined;
			const canAbort = Boolean(agentId && (activity || slot.status === "running" || slot.status === "waiting"));
			return (
				<div className="agent-pane">
					<header className="content-header">
						<div>
							<strong>{slot.displayName}</strong>
							<span>
								{selectedWorkItem.id} · {selectedWorkItem.title} ·{" "}
								{slot.blockedReason ?? statusLabels[slot.status]}
							</span>
						</div>
						{agentId ? (
							<div className="agent-header-actions">
								<ContextMeter snapshot={sessionSnapshot} onClick={() => void openSessionPanel(slot)} />
								{canAbort ? (
									<button
										className="secondary-button stop-button"
										type="button"
										onClick={() => void abortAgent(slot)}
										disabled={abortingAgents[agentId] === true}
										title="中断当前回复（Esc）"
									>
										{abortingAgents[agentId] ? "中断中" : "中断"}
									</button>
								) : null}
								<div className="agent-actions-menu-wrap">
									<IconButton
										label="Agent 操作"
										onClick={() => setAgentActionsOpen((current) => (current === agentId ? null : agentId))}
									>
										<AppIcon name="more" />
									</IconButton>
									{agentActionsOpen === agentId ? (
										<div className="agent-actions-menu">
											<button
												type="button"
												onClick={() => void openSessionPanel(slot)}
												disabled={sessionPanelLoading}
											>
												会话树与 Fork
											</button>
											<button type="button" onClick={() => void cloneAgentSession(slot)} disabled={busy}>
												克隆当前会话
											</button>
											<button type="button" onClick={() => void reconnectAgent(slot)} disabled={busy}>
												重新连接 Pi
											</button>
											<button
												type="button"
												className="danger-menu-item"
												onClick={() => setResetAgentDialog({ workItem: selectedWorkItem, slot })}
											>
												重置 Agent
											</button>
										</div>
									) : null}
								</div>
							</div>
						) : (
							<button
								className="secondary-button"
								type="button"
								onClick={() => void createAgent(slot)}
								disabled={busy || !("codepiddy" in window) || Boolean(slot.blockedReason)}
								title={slot.blockedReason}
							>
								{slot.blockedReason ? "等待交接" : "创建 Agent"}
							</button>
						)}
					</header>
					{agentId ? (
						<>
							<div className="transcript" ref={transcriptRef} onScroll={handleTranscriptScroll}>
								{items.length === 0 ? (
									<div className="transcript-placeholder compact">
										<div className="empty-mark small">{roleGlyphs[selection.role]}</div>
										<h2>{slot.displayName}</h2>
										<p>发送一条消息开始工作。Agent 会读取当前 Work Item 的交接文档。</p>
										{slot.kickoffPrompt ? (
											<button
												className="quick-start-button"
												type="button"
												onClick={() =>
													setDrafts((current) => ({ ...current, [agentId]: slot.kickoffPrompt! }))
												}
											>
												使用默认交接提示
											</button>
										) : null}
									</div>
								) : (
									items.map((item, index) => (
										<Fragment key={item.id}>
											{item.type === "user" && index > 0 ? (
												<div className="turn-divider" aria-hidden="true">
													<span>下一轮</span>
												</div>
											) : null}
											{item.type === "tool" ? (
												<ToolCallCard item={item} />
											) : (
												<TranscriptMessage
													item={item}
													assistantModel={modelSelections[agentId]?.model.name}
												/>
											)}
										</Fragment>
									))
								)}
							</div>
							{showJumpToLatest ? (
								<button className="jump-to-latest" type="button" onClick={jumpToLatest}>
									{activeAgentId && (unreadCounts[activeAgentId] ?? 0) > 0
										? `${unreadCounts[activeAgentId]} 条新消息`
										: "跳到最新消息"}
									<AppIcon name="arrow-up" size={14} className="jump-arrow" />
								</button>
							) : null}
							<form
								className="composer composer-stacked"
								onSubmit={(event) => {
									event.preventDefault();
									void sendPrompt(slot);
								}}
							>
								<SlashCommandMenu
									query={draft}
									commands={agentCommands[agentId] ?? []}
									loading={agentCommandsLoading[agentId] === true}
									modelSelection={modelSelections[agentId]}
									onSelect={(command) => setDrafts((current) => ({ ...current, [agentId]: command }))}
									onExecute={(command) => {
										setDrafts((current) => ({ ...current, [agentId]: "" }));
										void sendPrompt(slot, command);
									}}
								/>
								<FileMentionMenu
									query={draft}
									files={fileMatches}
									onSelect={(file) =>
										setDrafts((current) => ({
											...current,
											[agentId]: (current[agentId] ?? "").replace(/@[^\s]*$/, `@${file} `),
										}))
									}
								/>
								{toolRecoveryOffer ? (
									<div className="tool-recovery-offer">
										<div>
											<strong>工具失败后本轮已结束</strong>
											<span title={toolRecoveryOffer.reason}>
												{toolRecoveryOffer.toolName}：{toolRecoveryOffer.reason}
											</span>
										</div>
										<button type="button" onClick={() => void continueAfterToolFailure(slot)}>
											让 Pi 继续处理
										</button>
									</div>
								) : null}
								{activity ? (
									<div className={`agent-activity activity-${activity.kind}`}>
										<span className="activity-spinner" aria-hidden="true" />
										<span>{activity.label}</span>
										{activity.queued > 0 ? <small>{activity.queued} queued</small> : null}
									</div>
								) : null}
								<textarea
									value={draft}
									onChange={(event) => setDrafts((current) => ({ ...current, [agentId]: event.target.value }))}
									onKeyDown={(event) => {
										if (event.defaultPrevented || event.nativeEvent.isComposing) return;
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											void sendPrompt(slot);
										}
									}}
									placeholder="输入消息或 / 命令；Shift+Enter 换行"
									rows={1}
								/>
								<div className="composer-toolbar">
									<button className="model-seat" type="button" onClick={() => void openModelPicker(slot)}>
										{modelSelections[agentId]?.model.name ?? "选择模型"} ·{" "}
										{modelSelections[agentId]?.thinkingLevel ?? "—"} ▾
									</button>
									<button className="send-button" type="submit" disabled={!draft.trim()}>
										<AppIcon name="arrow-up" />
									</button>
								</div>
							</form>
						</>
					) : (
						<>
							<div className="transcript-placeholder">
								<div className="empty-mark small">{roleGlyphs[selection.role]}</div>
								<h2>{slot.displayName}</h2>
								<p>{slot.blockedReason || "这个 Slot 尚未创建 Agent Instance。"}</p>
							</div>
							<div className="composer disabled-composer">
								<span>{slot.blockedReason || "创建 Agent 后即可开始对话"}</span>
								<button type="button" disabled>
									<AppIcon name="arrow-up" />
								</button>
							</div>
						</>
					)}
				</div>
			);
		}
		if (selectedWorkItem) {
			return (
				<div className="work-item-empty">
					<div className="work-item-heading">
						<div>
							<span>{selectedWorkItem.id}</span>
							<h1>{selectedWorkItem.title}</h1>
							<p>{selectedWorkItem.description || "暂无描述"}</p>
						</div>
						<div className="work-item-actions">
							{selectedWorkItem.lane === "requirements" ? (
								selectedWorkItem.requirementApprovedAt ? (
									<span className="approval-badge">需求已批准</span>
								) : (
									<button
										className="primary-button"
										type="button"
										disabled={busy}
										onClick={() => void approveSelectedRequirement()}
									>
										批准需求
									</button>
								)
							) : null}
							<button
								className="secondary-button"
								type="button"
								onClick={() =>
									void window.codepiddy.openWorkItemFolder({
										projectRoot: project.rootPath,
										lane: selectedWorkItem.lane,
										workItemId: selectedWorkItem.id,
									})
								}
							>
								打开文件夹
							</button>
						</div>
					</div>
					<div className="agent-choice-list">
						{selectedWorkItem.agentSlots.map((slot) => (
							<button
								type="button"
								key={slot.role}
								onClick={() =>
									setSelection({
										type: "agent",
										lane: selectedWorkItem.lane,
										workItemId: selectedWorkItem.id,
										role: slot.role,
									})
								}
							>
								<span className="agent-glyph large">{roleGlyphs[slot.role]}</span>
								<span>
									<strong>{slot.displayName}</strong>
									<small>{slot.blockedReason || statusLabels[slot.status]}</small>
								</span>
								<span className={`agent-create status-${slot.blockedReason ? "waiting" : slot.status}`}>
									{slot.blockedReason ? "等待" : statusLabels[slot.status]}
								</span>
							</button>
						))}
					</div>
				</div>
			);
		}
		return (
			<div className="empty-state">
				<div className="empty-mark app-icon-mark">
					<img src="./codepiddy-icon.png" alt="CodePIddy" />
				</div>
				<h1>{project.name}</h1>
				<p>从左侧的新需求或修漏洞目录创建工作项。</p>
			</div>
		);
	}

	return (
		<div className="app-shell">
			<aside className="sidebar">
				<div className="brand-row">
					<div className="brand-title">CodePIddy</div>
					<IconButton
						label={searchOpen ? "关闭搜索" : "搜索"}
						onClick={() => {
							setSearchOpen((current) => !current);
							if (searchOpen) setSearchQuery("");
						}}
					>
						<AppIcon name="search" />
					</IconButton>
				</div>
				{searchOpen ? (
					<div className="sidebar-search">
						<AppIcon name="search" size={14} />
						<input
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="搜索项目、工作项或 Agent"
							aria-label="搜索项目、工作项或 Agent"
						/>
						{searchQuery ? (
							<button type="button" onClick={() => setSearchQuery("")} aria-label="清除搜索">
								<AppIcon name="close" />
							</button>
						) : null}
					</div>
				) : null}
				<button className="new-action" type="button" onClick={() => void openProject()} disabled={busy}>
					<AppIcon name="plus" />
					{project ? "打开其他项目" : "打开项目"}
				</button>
				<div className="sidebar-section-label">项目</div>
				<div className="recent-project-list">
					{project ? (
						<div className="project-tree">
							<div className={`tree-row project-row ${selection.type === "project" ? "selected" : ""}`}>
								<button
									className="chevron-button"
									type="button"
									onClick={() => toggle(`project:${project.id}`)}
									aria-label="展开项目"
								>
									<Chevron expanded={expanded.has(`project:${project.id}`)} />
								</button>
								<button className="tree-label" type="button" onClick={() => setSelection({ type: "project" })}>
									<AppIcon name="folder" className="folder-glyph" />
									<span className="truncate">{project.name}</span>
								</button>
								<IconButton label="关闭项目" onClick={() => void closeCurrentProject()}>
									<AppIcon name="close" />
								</IconButton>
							</div>
						</div>
					) : null}
					{recentProjects
						.filter((recent) => recent.rootPath.toLowerCase() !== project?.rootPath.toLowerCase())
						.filter((recent) => {
							const query = searchQuery.trim().toLowerCase();
							return (
								!query ||
								recent.name.toLowerCase().includes(query) ||
								recent.rootPath.toLowerCase().includes(query)
							);
						})
						.map((recent) => (
							<div
								className={`recent-project-row ${recent.available ? "" : "unavailable"}`}
								key={recent.rootPath}
							>
								<button
									className="recent-project-open"
									type="button"
									disabled={!recent.available || busy}
									onClick={() => void switchProject(recent)}
									title={recent.available ? recent.rootPath : `路径不可用：${recent.rootPath}`}
								>
									{recent.available ? (
										<AppIcon name="folder" className="folder-glyph" />
									) : (
										<AppIcon name="warning" className="folder-glyph" />
									)}
									<span className="recent-project-copy">
										<span className="truncate">{recent.name}</span>
										<small>{recent.available ? recent.rootPath : "项目路径不可用"}</small>
									</span>
								</button>
								<IconButton label="从最近项目移除" onClick={() => void forgetRecentProject(recent)}>
									<AppIcon name="close" />
								</IconButton>
							</div>
						))}
					{project && expanded.has(`project:${project.id}`) ? (
						<div className="active-project-contents">
							<div className="active-project-label">当前项目工作流</div>
							<div className="tree-children project-children">{project.lanes.map(renderLane)}</div>
						</div>
					) : null}
					{!project && recentProjects.length === 0 ? <div className="sidebar-hint">尚未打开项目</div> : null}
				</div>
				<div className="sidebar-footer">
					<button type="button" onClick={() => void openSettings()}>
						<AppIcon name="settings" /> <span>设置</span>
					</button>
				</div>
			</aside>
			<main className="main-pane">
				{error ? (
					<div className="error-banner">
						{error}
						<button type="button" onClick={() => setError(null)}>
							<AppIcon name="close" />
						</button>
					</div>
				) : null}
				{renderMainContent()}
			</main>
			{sessionPanel ? (
				<div className="modal-backdrop" role="presentation">
					<button
						className="modal-backdrop-dismiss"
						type="button"
						aria-label="关闭会话树"
						onClick={() => setSessionPanel(null)}
					/>
					<div className="modal session-tree-modal" role="dialog" aria-modal="true" aria-label="Agent 会话树">
						<div className="session-tree-heading">
							<div>
								<h2>{sessionPanel.displayName} 会话树</h2>
								<p>从任意用户消息创建分支。原会话不会被修改。</p>
							</div>
							<IconButton label="关闭会话树" onClick={() => setSessionPanel(null)}>
								<AppIcon name="close" />
							</IconButton>
						</div>
						<div className="session-summary">
							<span>{sessionPanel.snapshot.messageCount} 条消息</span>
							<span>{sessionPanel.snapshot.nodes.length} 个节点</span>
							{sessionPanel.snapshot.contextUsage ? (
								<span>
									上下文{" "}
									{sessionPanel.snapshot.contextUsage.tokens === null
										? "—"
										: formatTokenCount(sessionPanel.snapshot.contextUsage.tokens)}{" "}
									/ {formatTokenCount(sessionPanel.snapshot.contextUsage.contextWindow)}
									{sessionPanel.snapshot.contextUsage.percent === null
										? ""
										: ` · ${Math.round(sessionPanel.snapshot.contextUsage.percent)}%`}
								</span>
							) : null}
							{sessionPanel.snapshot.isCompacting ? <strong>正在压缩上下文</strong> : null}
							{sessionPanel.snapshot.isStreaming ? <strong>Agent 正在运行</strong> : null}
						</div>
						<div className="session-tree-list">
							{sessionPanel.snapshot.nodes.length === 0 ? (
								<div className="session-tree-empty">当前会话还没有可展示的节点。</div>
							) : (
								sessionPanel.snapshot.nodes.map((node) => (
									<div
										className={`session-node ${node.isLeaf ? "current" : ""}`}
										key={node.entryId}
										style={{ marginLeft: Math.min(node.depth, 8) * 16 }}
									>
										<div className="session-node-rail">
											<AppIcon name="branch" size={14} />
										</div>
										<div className="session-node-copy">
											<div className="session-node-meta">
												<span>{node.label || node.role || node.type}</span>
												{node.isLeaf ? <strong>当前节点</strong> : null}
												{node.timestamp ? <time>{new Date(node.timestamp).toLocaleString()}</time> : null}
											</div>
											<p>{node.text || node.type}</p>
										</div>
										{node.forkable ? (
											<button
												className="session-fork-button"
												type="button"
												disabled={sessionPanelLoading}
												onClick={() => void forkAgentSession(node.entryId)}
											>
												Fork
											</button>
										) : null}
									</div>
								))
							)}
						</div>
						<div className="session-tree-footer">
							<code>{sessionPanel.snapshot.sessionName || sessionPanel.snapshot.sessionId}</code>
							<button className="secondary-button" type="button" onClick={() => setSessionPanel(null)}>
								关闭
							</button>
						</div>
					</div>
				</div>
			) : null}
			{writeLeaseDialog?.lease ? (
				<div className="modal-backdrop" role="presentation">
					<button
						className="modal-backdrop-dismiss"
						type="button"
						aria-label="取消清理写锁"
						onClick={() => setWriteLeaseDialog(null)}
					/>
					<div className="modal danger-modal" role="dialog" aria-modal="true" aria-label="清理失效写锁">
						<h2>发现失效的项目写锁</h2>
						<p>
							{writeLeaseDialog.lease.workItemId} / {writeLeaseDialog.lease.role} Agent
							持有的写锁对应进程已经不存在。 清理后可以重新发送当前消息。
						</p>
						<div className="lease-details">
							<span>Agent：{writeLeaseDialog.lease.holderAgentInstanceId}</span>
							<span>最后心跳：{new Date(writeLeaseDialog.lease.heartbeatAt).toLocaleString()}</span>
						</div>
						<div className="modal-actions">
							<button type="button" onClick={() => setWriteLeaseDialog(null)}>
								取消
							</button>
							<button
								className="danger-button"
								type="button"
								disabled={busy}
								onClick={() => void clearStaleWriteLease()}
							>
								清理写锁
							</button>
						</div>
					</div>
				</div>
			) : null}
			{resetAgentDialog ? (
				<div className="modal-backdrop" role="presentation">
					<button
						className="modal-backdrop-dismiss"
						type="button"
						aria-label="取消重置 Agent"
						onClick={() => setResetAgentDialog(null)}
					/>
					<div className="modal danger-modal" role="dialog" aria-modal="true" aria-label="重置 Agent">
						<h2>重置 {resetAgentDialog.slot.displayName}？</h2>
						<p>
							当前会话会归档到本地运行目录，然后为这个 Slot 创建一个全新的 Agent Instance。项目文件不会被删除。
						</p>
						<div className="modal-actions">
							<button type="button" onClick={() => setResetAgentDialog(null)}>
								取消
							</button>
							<button
								className="danger-button"
								type="button"
								disabled={busy}
								onClick={() => void resetSelectedAgent()}
							>
								重置 Agent
							</button>
						</div>
					</div>
				</div>
			) : null}
			{renameDialog ? (
				<div className="modal-backdrop" role="presentation">
					<button
						className="modal-backdrop-dismiss"
						type="button"
						aria-label="取消重命名"
						onClick={() => setRenameDialog(null)}
					/>
					<form
						className="modal"
						onSubmit={(event) => {
							event.preventDefault();
							void renameSelectedWorkItem();
						}}
					>
						<h2>重命名工作项</h2>
						<label>
							标题
							<input
								value={renameDialog.title}
								onChange={(event) => setRenameDialog({ ...renameDialog, title: event.target.value })}
							/>
						</label>
						<div className="modal-actions">
							<button type="button" onClick={() => setRenameDialog(null)}>
								取消
							</button>
							<button className="primary-button" type="submit" disabled={!renameDialog.title.trim() || busy}>
								保存
							</button>
						</div>
					</form>
				</div>
			) : null}
			{deleteDialog ? (
				<div className="modal-backdrop" role="presentation">
					<button
						className="modal-backdrop-dismiss"
						type="button"
						aria-label="取消永久删除"
						onClick={() => setDeleteDialog(null)}
					/>
					<div className="modal danger-modal" role="dialog" aria-modal="true" aria-label="永久删除工作项">
						<h2>永久删除工作项？</h2>
						<p>
							将删除“{deleteDialog.item.id}：{deleteDialog.item.title}”的项目文件、Agent 会话和本地运行记录。
							此操作无法撤销。
						</p>
						<div className="modal-actions">
							<button type="button" onClick={() => setDeleteDialog(null)}>
								取消
							</button>
							<button
								className="danger-button"
								type="button"
								disabled={busy}
								onClick={() => void permanentlyDeleteWorkItem()}
							>
								永久删除
							</button>
						</div>
					</div>
				</div>
			) : null}
			{dialog ? (
				<div className="modal-backdrop" role="presentation">
					<button
						className="modal-backdrop-dismiss"
						type="button"
						aria-label="取消创建工作项"
						onClick={() => setDialog(null)}
					/>
					<form
						className="modal"
						onSubmit={(event) => {
							event.preventDefault();
							void createWorkItem();
						}}
					>
						<h2>{dialog.lane === "requirements" ? "新建需求" : "新建修漏洞"}</h2>
						<label>
							标题
							<input
								value={dialog.title}
								onChange={(event) => setDialog({ ...dialog, title: event.target.value })}
							/>
						</label>
						<label>
							初始描述
							<textarea
								rows={5}
								value={dialog.description}
								onChange={(event) => setDialog({ ...dialog, description: event.target.value })}
							/>
						</label>
						<div className="modal-actions">
							<button type="button" onClick={() => setDialog(null)}>
								取消
							</button>
							<button className="primary-button" type="submit" disabled={!dialog.title.trim() || busy}>
								创建
							</button>
						</div>
					</form>
				</div>
			) : null}
			{extensionDialog ? (
				<div className="modal-backdrop" role="presentation">
					<div className="modal permission-modal" role="dialog" aria-modal="true" aria-label="权限请求">
						<h2>权限请求</h2>
						<pre className="permission-message">
							{extensionDialog.title}
							{extensionDialog.message ? `\n\n${extensionDialog.message}` : ""}
						</pre>
						<button
							className="permission-defer"
							type="button"
							onClick={() => {
								setDeferredPermissionAgentId(extensionDialog.agentInstanceId);
								setExtensionDialog(null);
							}}
						>
							稍后处理
						</button>
						{extensionDialog.method === "select" ? (
							<div className="permission-options">
								{extensionDialog.options.map((option) => (
									<button
										className={option.startsWith("Allow") ? "primary-button" : "secondary-button"}
										type="button"
										key={option}
										onClick={() => void respondToExtensionDialog({ value: option })}
									>
										{option}
									</button>
								))}
							</div>
						) : extensionDialog.method === "confirm" ? (
							<div className="modal-actions">
								<button type="button" onClick={() => void respondToExtensionDialog({ confirmed: false })}>
									拒绝
								</button>
								<button
									className="primary-button"
									type="button"
									onClick={() => void respondToExtensionDialog({ confirmed: true })}
								>
									允许
								</button>
							</div>
						) : (
							<form
								onSubmit={(event) => {
									event.preventDefault();
									void respondToExtensionDialog({ value: extensionDialog.value });
								}}
							>
								<textarea
									rows={extensionDialog.method === "editor" ? 8 : 3}
									placeholder={extensionDialog.placeholder}
									value={extensionDialog.value}
									onChange={(event) => setExtensionDialog({ ...extensionDialog, value: event.target.value })}
								/>
								<div className="modal-actions">
									<button type="button" onClick={() => void respondToExtensionDialog({ cancelled: true })}>
										取消
									</button>
									<button className="primary-button" type="submit">
										提交
									</button>
								</div>
							</form>
						)}
						{extensionDialog.method === "select" ? (
							<button
								className="permission-cancel"
								type="button"
								onClick={() => void respondToExtensionDialog({ cancelled: true })}
							>
								取消
							</button>
						) : null}
					</div>
				</div>
			) : null}
			{modelPickerAgentId && selectedWorkItem && selection.type === "agent"
				? (() => {
						const slot = selectedWorkItem.agentSlots.find((candidate) => candidate.role === selection.role);
						const modelSelection = modelSelections[modelPickerAgentId];
						if (!slot || !modelSelection) return null;
						const filtered = modelPickerOptions;
						const providers = [...new Set(filtered.map((model) => model.provider))];
						return (
							<div className="modal-backdrop" role="presentation">
								<button
									className="modal-backdrop-dismiss"
									type="button"
									aria-label="关闭模型选择器"
									onClick={() => {
										setModelPickerAgentId(null);
										setModelSearch("");
									}}
								/>
								<div
									className="modal model-picker"
									role="dialog"
									aria-modal="true"
									aria-label="选择模型"
									onKeyDown={(event) => {
										if (event.key === "ArrowDown" && filtered.length > 0) {
											event.preventDefault();
											setModelPickerSelectedIndex((current) => {
												const next = (current + 1) % filtered.length;
												modelPickerSelectedIndexRef.current = next;
												return next;
											});
										} else if (event.key === "ArrowUp" && filtered.length > 0) {
											event.preventDefault();
											setModelPickerSelectedIndex((current) => {
												const next = (current - 1 + filtered.length) % filtered.length;
												modelPickerSelectedIndexRef.current = next;
												return next;
											});
										} else if (
											event.key === "Enter" &&
											event.target === modelSearchInputRef.current &&
											!modelPickerBusy
										) {
											const model = filtered[modelPickerSelectedIndexRef.current];
											if (!model) return;
											event.preventDefault();
											void chooseModel(slot, model.provider, model.id);
										}
									}}
								>
									<h2>选择模型</h2>
									<input
										ref={modelSearchInputRef}
										value={modelSearch}
										onChange={(event) => setModelSearch(event.target.value)}
										placeholder="搜索模型"
									/>
									<div className="thinking-row">
										{modelSelection.availableThinkingLevels.map((level) => (
											<button
												type="button"
												className={level === modelSelection.thinkingLevel ? "selected" : ""}
												key={level}
												disabled={modelPickerBusy}
												onClick={() => void chooseThinking(slot, level)}
											>
												{level}
											</button>
										))}
									</div>
									<div className="model-list">
										{providers.map((provider) => (
											<section key={provider}>
												<h3>{provider}</h3>
												{filtered
													.map((model, index) => ({ model, index }))
													.filter((entry) => entry.model.provider === provider)
													.map(({ model, index }) => (
														<button
															type="button"
															className={[
																model.id === modelSelection.model.id &&
																model.provider === modelSelection.model.provider
																	? "selected"
																	: "",
																index === modelPickerSelectedIndex ? "keyboard-selected" : "",
															]
																.filter(Boolean)
																.join(" ")}
															data-model-index={index}
															onMouseEnter={() => {
																modelPickerSelectedIndexRef.current = index;
																setModelPickerSelectedIndex(index);
															}}
															key={provider + model.id}
															disabled={modelPickerBusy}
															onClick={() => void chooseModel(slot, model.provider, model.id)}
														>
															<span>{model.name}</span>
															<small>{model.id}</small>
														</button>
													))}
											</section>
										))}
									</div>
									<div className="model-picker-footer">
										{modelPickerBusy ? (
											<span className="model-picker-status">正在应用 Pi 模型设置…</span>
										) : null}
										<button
											className="secondary-button"
											disabled={modelPickerBusy}
											type="button"
											onClick={() => void saveRoleModelDefault(slot)}
										>
											设为 {slot.displayName} 默认
										</button>
										<button
											className="permission-cancel"
											type="button"
											onClick={() => setModelPickerAgentId(null)}
										>
											关闭
										</button>
									</div>
								</div>
							</div>
						);
					})()
				: null}
			{archiveToast ? (
				<output className="toast" aria-live="polite">
					“{archiveToast.title}”已归档
					<button type="button" onClick={() => void restoreArchived()}>
						撤销
					</button>
				</output>
			) : null}
		</div>
	);
}
