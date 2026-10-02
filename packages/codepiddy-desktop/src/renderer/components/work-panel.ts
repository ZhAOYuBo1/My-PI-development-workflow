// 右侧工作看板：tool 事件投影（desktop-work-panel），纯函数，供 WorkPanel 与单测共用。
export type WorkPanelView = "file" | "terminal" | "review";

export interface WorkPanelEntry {
	id: string;
	toolName: string;
	title: string;
	path: string | null;
	timestamp: number;
	view: WorkPanelView;
	/** 传给 ToolCallOutput 的渲染名：write/edit 走 diff 样式，bash 走终端样式。 */
	renderName: string;
	body: string;
	isError: boolean;
	running: boolean;
}

export type PanelDiffLineType = "add" | "remove" | "context" | "hunk";

export interface PanelDiffLine {
	type: PanelDiffLineType;
	text: string;
}

export interface PanelDiffSummary {
	additions: number;
	deletions: number;
}

export interface ProjectableToolItem {
	id: string;
	name: string;
	args: string;
	text: string;
	status: "running" | "completed";
	isError: boolean;
	startedAt?: number;
	completedAt?: number;
}

const PATH_KEYS = ["file_path", "filePath", "path", "file", "absPath", "filename"];
const CONTENT_KEYS = ["content", "text", "newText", "newString"];
const OLD_CONTENT_KEYS = ["oldText", "oldString", "old_string"];
const NEW_CONTENT_KEYS = ["newText", "newString", "new_string"];

/** args 恒为 JSON 字符串，解析失败返回空对象。 */
export function parseToolArgs(args: string): Record<string, unknown> {
	if (!args) return {};
	try {
		const value: unknown = JSON.parse(args);
		if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
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

export function stripAnsi(value: string): string {
	return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

export function inferPanelPathFromText(value: string): string | null {
	const diffHeader = /^(?:\+\+\+|---)\s+(?:[ab]\/)?(.+?)\s*$/m.exec(value);
	if (diffHeader?.[1] && diffHeader[1] !== "/dev/null") return normalizePanelPath(diffHeader[1]);
	const quoted = /(?:filePath|path)["']?\s*[:=]\s*["']([^"']+)["']/i.exec(value);
	if (quoted?.[1]) return normalizePanelPath(quoted[1]);
	const replaced = /\bin\s+((?:[A-Za-z]:[\\/]|\/)[^\r\n]+?)(?:[.!]?\s*)$/i.exec(value);
	if (replaced?.[1]) return normalizePanelPath(replaced[1].trim());
	const written = /(?:created|wrote|updated|modified)\s+(?:file\s+)?([^\n]+?\.(?:[a-z0-9]+))/i.exec(value);
	return written?.[1]
		? normalizePanelPath(
				written[1]
					.trim()
					.replace(/^to\s+/i, "")
					.replace(/^["']|["']$/g, ""),
			)
		: null;
}

function buildTextDiff(oldText: string, newText: string): string {
	const oldLines = oldText.replace(/\r\n?/g, "\n").split("\n");
	const newLines = newText.replace(/\r\n?/g, "\n").split("\n");
	let prefix = 0;
	while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
		prefix += 1;
	}
	let suffix = 0;
	while (
		suffix < oldLines.length - prefix &&
		suffix < newLines.length - prefix &&
		oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
	) {
		suffix += 1;
	}
	const contextBefore = oldLines.slice(Math.max(0, prefix - 3), prefix);
	const contextAfter = oldLines.slice(oldLines.length - suffix, oldLines.length - suffix + 3);
	const removed = oldLines.slice(prefix, oldLines.length - suffix).map((line) => `-${line}`);
	const added = newLines.slice(prefix, newLines.length - suffix).map((line) => `+${line}`);
	const oldStart = Math.max(1, prefix - contextBefore.length + 1);
	const newStart = Math.max(1, prefix - contextBefore.length + 1);
	const oldCount = contextBefore.length + removed.length + contextAfter.length;
	const newCount = contextBefore.length + added.length + contextAfter.length;
	return [
		`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
		...contextBefore,
		...removed,
		...added,
		...contextAfter,
	].join("\n");
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
			path: extractPanelPath(item.name, item.args) ?? inferPanelPathFromText(body),
			timestamp: item.completedAt ?? item.startedAt ?? Date.now(),
			view: "file",
			renderName: "write",
			body,
			isError: item.isError,
			running: item.status === "running",
		};
	}
	if (name === "edit") {
		const oldText = firstString(record, OLD_CONTENT_KEYS);
		const newText = firstString(record, NEW_CONTENT_KEYS);
		const edits = Array.isArray(record.edits)
			? record.edits.filter(
					(edit): edit is { oldText: string; newText: string } =>
						typeof edit === "object" &&
						edit !== null &&
						!Array.isArray(edit) &&
						typeof (edit as Record<string, unknown>).oldText === "string" &&
						typeof (edit as Record<string, unknown>).newText === "string",
				)
			: [];
		const generatedDiff =
			edits.length > 0
				? edits.map((edit) => buildTextDiff(edit.oldText, edit.newText)).join("\n")
				: oldText !== null && newText !== null
					? buildTextDiff(oldText, newText)
					: null;
		const body = generatedDiff || firstString(record, ["diff"]) || newText || item.text || "";
		if (!body && item.status !== "running") return null;
		return {
			id: item.id,
			toolName: item.name,
			title: extractPanelTitle(item.name, item.args),
			path: extractPanelPath(item.name, item.args) ?? inferPanelPathFromText(body),
			timestamp: item.completedAt ?? item.startedAt ?? Date.now(),
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
			path: extractPanelPath(item.name, item.args),
			timestamp: item.completedAt ?? item.startedAt ?? Date.now(),
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
			path: null,
			timestamp: item.completedAt ?? item.startedAt ?? Date.now(),
			view: "terminal",
			renderName: "bash",
			body: item.text,
			isError: item.isError,
			running: item.status === "running",
		};
	}
	return null;
}

/** 工具输出里已有 +/-/@@ 标记时直接采用；write 的原始内容按整文件新增展示。 */
export function panelDiffLines(entry: WorkPanelEntry): PanelDiffLine[] {
	const lines = stripAnsi(entry.body).replace(/\r\n?/g, "\n").split("\n");
	while (lines.length > 0 && /^(?:---|\+\+\+)\s/.test(lines[0]!)) lines.shift();
	if (lines.at(-1) === "") lines.pop();
	const marked = lines.some((line) => line.startsWith("@@") || /^[+-](?![+-])/.test(line));
	const statusOnly =
		!marked &&
		/^(?:successfully|file\s+(?:created|written)|created\s+file|wrote\s+file|updated\s+file|modified\s+file)/i.test(
			lines.join("\n").trimStart(),
		);
	if (statusOnly) return [];
	if (!marked && entry.toolName.toLowerCase() === "write") {
		return lines.map((text) => ({ type: "add", text }));
	}
	return lines.map((line) => {
		if (line.startsWith("@@")) return { type: "hunk", text: line };
		if (line.startsWith("+")) return { type: "add", text: line.slice(1) };
		if (line.startsWith("-")) return { type: "remove", text: line.slice(1) };
		return { type: "context", text: line.startsWith(" ") ? line.slice(1) : line };
	});
}

export function summarizePanelDiff(lines: PanelDiffLine[]): PanelDiffSummary {
	let additions = 0;
	let deletions = 0;
	for (const line of lines) {
		if (line.type === "add") additions += 1;
		else if (line.type === "remove") deletions += 1;
	}
	return { additions, deletions };
}
