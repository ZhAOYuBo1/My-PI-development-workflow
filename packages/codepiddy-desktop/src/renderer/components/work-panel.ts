// 右侧工作看板：tool 事件投影（desktop-work-panel），纯函数，供 WorkPanel 与单测共用。
export type WorkPanelView = "file" | "terminal" | "review";

export interface WorkPanelEntry {
	id: string;
	toolName: string;
	title: string;
	view: WorkPanelView;
	/** 传给 ToolCallOutput 的渲染名：write/edit 走 diff 样式，bash 走终端样式。 */
	renderName: string;
	body: string;
	isError: boolean;
	running: boolean;
}

export interface ProjectableToolItem {
	id: string;
	name: string;
	args: string;
	text: string;
	status: "running" | "completed";
	isError: boolean;
}

const PATH_KEYS = ["filePath", "path", "file", "absPath", "filename"];
const CONTENT_KEYS = ["content", "text", "newText", "newString"];

/** args 恒为 JSON 字符串，解析失败返回空对象。 */
export function parseToolArgs(args: string): Record<string, unknown> {
	if (!args) return {};
	try {
		const value: unknown = JSON.parse(args);
		if (typeof value === "object" && value !== null && !Array.isArray(value))
			return value as Record<string, unknown>;
	} catch {}
	return {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value) return value;
	}
	return null;
}

function basename(path: string): string {
	const parts = path.split(/[/\\]/).filter(Boolean);
	return parts.length > 0 ? parts[parts.length - 1]! : path;
}

/** B / KB / MB 紧凑格式，与 PI-Desktop 文件树一致。 */
export function formatPanelSize(size: number): string {
	if (!Number.isFinite(size) || size < 0) return "—";
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** 斜杠归一化（Windows 反斜杠 → /），与 IPC 返回的相对路径口径一致。 */
export function normalizePanelPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/** write/edit/read 参数里的文件路径（归一化后），无路径返回 null。 */
export function extractPanelPath(toolName: string, args: string): string | null {
	const name = toolName.toLowerCase();
	if (name !== "write" && name !== "edit" && name !== "read") return null;
	const path = firstString(parseToolArgs(args), PATH_KEYS);
	return path ? normalizePanelPath(path) : null;
}

/** 文件类工具取路径尾名，命令类工具取首行命令，无路径回退工具名。 */
export function extractPanelTitle(toolName: string, args: string): string {
	const record = parseToolArgs(args);
	const path = firstString(record, PATH_KEYS);
	if (path) return basename(path);
	const command = firstString(record, ["command", "cmd", "script"]);
	if (command) {
		const firstLine = command.split("\n")[0]!.trim();
		return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
	}
	return toolName;
}

/**
 * 看板数据源 = tool 事件投影（与时间线所见即所得，不二次读磁盘）。
 * write/edit → 文件/审阅，read → 文件，bash/powershell → 终端，其余工具返回 null。
 */
export function projectToolToPanel(item: ProjectableToolItem): WorkPanelEntry | null {
	const name = item.name.toLowerCase();
	const record = parseToolArgs(item.args);
	if (name === "write") {
		const body = firstString(record, CONTENT_KEYS) ?? item.text;
		if (!body && item.status !== "running") return null;
		return {
			id: item.id,
			toolName: item.name,
			title: extractPanelTitle(item.name, item.args),
			view: "file",
			renderName: "write",
			body,
			isError: item.isError,
			running: item.status === "running",
		};
	}
	if (name === "edit") {
		const body = item.text || firstString(record, ["newText", "newString", "diff"]) || "";
		if (!body && item.status !== "running") return null;
		return {
			id: item.id,
			toolName: item.name,
			title: extractPanelTitle(item.name, item.args),
			view: "review",
			renderName: "edit",
			body,
			isError: item.isError,
			running: item.status === "running",
		};
	}
	if (name === "read") {
		if (!item.text && item.status !== "running") return null;
		return {
			id: item.id,
			toolName: item.name,
			title: extractPanelTitle(item.name, item.args),
			view: "file",
			renderName: "read",
			body: item.text,
			isError: item.isError,
			running: item.status === "running",
		};
	}
	if (name === "bash" || name === "powershell") {
		if (!item.text && item.status !== "running") return null;
		return {
			id: item.id,
			toolName: item.name,
			title: extractPanelTitle("终端输出", item.args),
			view: "terminal",
			renderName: "bash",
			body: item.text,
			isError: item.isError,
			running: item.status === "running",
		};
	}
	return null;
}
