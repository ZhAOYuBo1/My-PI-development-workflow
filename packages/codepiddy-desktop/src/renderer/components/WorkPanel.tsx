import type { WorkspaceDirEntry, WorkspaceFileContent } from "@codepiddy/shared";
import { ChevronRight, CircleAlert, FileQuestion, FileText, Folder } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageContent } from "./message-content.tsx";
import { extractPanelPath, formatPanelSize, type ProjectableToolItem } from "./work-panel.ts";

const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 720;
const PANEL_DEFAULT_WIDTH = 480;

function clampWidth(value: number): number {
	return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(value)));
}

function loadPanelWidth(): number {
	try {
		const stored = Number(window.localStorage.getItem("codepiddy.work-panel.width"));
		if (Number.isFinite(stored) && stored > 0) return clampWidth(stored);
	} catch {}
	return PANEL_DEFAULT_WIDTH;
}

function isMarkdownPath(path: string): boolean {
	return /\.(?:md|markdown)$/i.test(path);
}

function PanelGlyph({ kind }: { kind: "dir" | "file" }) {
	const Icon = kind === "dir" ? Folder : FileText;
	return <Icon className="file-tree-icon" size={14} strokeWidth={2} aria-hidden="true" />;
}

interface DirState {
	entries: WorkspaceDirEntry[];
	error?: boolean;
}

type FileState = { status: "loading" } | { status: "ready"; content: WorkspaceFileContent } | { status: "error" };

export const WorkPanel = memo(function WorkPanel({
	projectRoot,
	toolItems,
}: {
	projectRoot: string;
	toolItems: ProjectableToolItem[];
}) {
	const [width, setWidth] = useState(loadPanelWidth);
	const [dirs, setDirs] = useState<Record<string, DirState>>({});
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [query, setQuery] = useState("");
	const [searchResults, setSearchResults] = useState<string[] | null>(null);
	const [fileState, setFileState] = useState<FileState | null>(null);
	const [reloadSeq, setReloadSeq] = useState(0);
	// null = 跟随最新工具产物；"" = 显式回到文件树。
	const [manualPath, setManualPath] = useState<string | null>(null);
	const loadedRef = useRef<Set<string>>(new Set());

	// 跟随：最近一条成功的文件工具决定自动打开的路径。
	const followPath = useMemo(() => {
		for (let index = toolItems.length - 1; index >= 0; index -= 1) {
			const item = toolItems[index]!;
			if (item.status !== "completed" || item.isError) continue;
			const path = extractPanelPath(item.name, item.args);
			if (path) return path;
		}
		return null;
	}, [toolItems]);
	const activePath = manualPath === "" ? null : (manualPath ?? followPath);

	const loadDir = useCallback(
		async (relative: string) => {
			if (loadedRef.current.has(relative)) return;
			loadedRef.current.add(relative);
			try {
				const entries = await window.codepiddy.listWorkspaceDir(projectRoot, relative);
				setDirs((current) => ({ ...current, [relative]: { entries } }));
			} catch {
				loadedRef.current.delete(relative);
				setDirs((current) => ({ ...current, [relative]: { entries: [], error: true } }));
			}
		},
		[projectRoot],
	);

	// 工作区切换：重置全部浏览状态。
	useEffect(() => {
		loadedRef.current = new Set();
		setDirs({});
		setExpanded(new Set());
		setManualPath(null);
		setFileState(null);
		setQuery("");
		setSearchResults(null);
		void loadDir("");
		// loadDir 自身的依赖里有 projectRoot，工作区切换时 loadDir 会换新引用，这里跟着重跑。
	}, [loadDir]);

	// 选中文件（含跟随打开）时展开祖先目录并读文件。
	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadSeq 不参与读取，只作为「刷新」按钮的重跑信号（见 setReloadSeq）
	useEffect(() => {
		if (!activePath) {
			setFileState(null);
			return;
		}
		const ancestors: string[] = [];
		const parts = activePath.split("/").slice(0, -1);
		let acc = "";
		for (const part of parts) {
			acc = acc ? `${acc}/${part}` : part;
			ancestors.push(acc);
		}
		setExpanded((current) => new Set([...current, ...ancestors]));
		for (const dir of ancestors) void loadDir(dir);
		let cancelled = false;
		setFileState({ status: "loading" });
		window.codepiddy
			.readWorkspaceFile(projectRoot, activePath)
			.then((content) => {
				if (!cancelled) setFileState({ status: "ready", content });
			})
			.catch(() => {
				if (!cancelled) setFileState({ status: "error" });
			});
		return () => {
			cancelled = true;
		};
	}, [activePath, projectRoot, loadDir, reloadSeq]);

	// 文件名搜索（复用既有 searchProjectFiles）。
	useEffect(() => {
		const keyword = query.trim();
		if (!keyword) {
			setSearchResults(null);
			return;
		}
		const timer = window.setTimeout(() => {
			window.codepiddy
				.searchProjectFiles(projectRoot, keyword)
				.then(setSearchResults)
				.catch(() => setSearchResults([]));
		}, 200);
		return () => window.clearTimeout(timer);
	}, [query, projectRoot]);

	const toggleDir = useCallback(
		(relative: string) => {
			setExpanded((current) => {
				const next = new Set(current);
				if (next.has(relative)) next.delete(relative);
				else next.add(relative);
				return next;
			});
			void loadDir(relative);
		},
		[loadDir],
	);

	const startResize = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			const startX = event.clientX;
			const startWidth = width;
			let latest = startWidth;
			const onMove = (move: MouseEvent): void => {
				latest = clampWidth(startWidth + startX - move.clientX);
				setWidth(latest);
			};
			const onUp = (): void => {
				window.removeEventListener("mousemove", onMove);
				window.removeEventListener("mouseup", onUp);
				try {
					window.localStorage.setItem("codepiddy.work-panel.width", String(latest));
				} catch {}
			};
			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);
		},
		[width],
	);

	const renderDir = (relative: string, depth: number): React.ReactNode => {
		const state = dirs[relative];
		if (!state) {
			return (
				<output
					className="file-tree-note is-loading"
					style={{ paddingLeft: 12 + depth * 14 }}
					key={`${relative}:loading`}
				>
					加载中…
				</output>
			);
		}
		if (state.entries.length === 0) {
			return (
				<div
					className={`file-tree-note ${state.error ? "is-error" : "is-empty"}`}
					style={{ paddingLeft: 12 + depth * 14 }}
					key={`${relative}:empty`}
					role={state.error ? "alert" : undefined}
				>
					{state.error ? "目录读取失败" : "空目录"}
				</div>
			);
		}
		return state.entries.map((entry) => {
			const child = relative ? `${relative}/${entry.name}` : entry.name;
			if (entry.kind === "dir") {
				const open = expanded.has(child);
				return (
					<div key={child}>
						<button
							type="button"
							className="file-tree-row"
							style={{ paddingLeft: 12 + depth * 14 }}
							onClick={() => toggleDir(child)}
						>
							<span className={`file-tree-caret${open ? " open" : ""}`} aria-hidden="true">
								<ChevronRight size={12} strokeWidth={2} />
							</span>
							<PanelGlyph kind="dir" />
							<span className="file-tree-name">{entry.name}</span>
						</button>
						{open ? renderDir(child, depth + 1) : null}
					</div>
				);
			}
			return (
				<button
					key={child}
					type="button"
					className={`file-tree-row${activePath === child ? " active" : ""}`}
					style={{ paddingLeft: 12 + depth * 14 + 16 }}
					onClick={() => setManualPath(child)}
					title={child}
				>
					<PanelGlyph kind="file" />
					<span className="file-tree-name">{entry.name}</span>
					<span className="file-tree-size">{formatPanelSize(entry.size)}</span>
				</button>
			);
		});
	};

	const renderPreview = (): React.ReactNode => {
		if (!fileState || fileState.status === "loading") {
			return (
				<output className="file-viewer-state is-loading" aria-live="polite">
					<span className="sr-only">正在读取文件</span>
					<span className="file-viewer-skeleton" aria-hidden="true">
						<span />
						<span />
						<span />
						<span />
					</span>
				</output>
			);
		}
		if (fileState.status === "error")
			return (
				<div className="work-panel-empty is-error" role="alert">
					<div className="state-mark state-mark-error">
						<CircleAlert size={18} strokeWidth={2} aria-hidden="true" />
					</div>
					<strong>文件读取失败</strong>
					<p>文件可能已被移动或删除，刷新目录树后重试。</p>
				</div>
			);
		const { content } = fileState;
		if (content.kind === "image" && content.dataUrl)
			return (
				<div className="file-viewer-image">
					<img src={content.dataUrl} alt={activePath ?? ""} />
				</div>
			);
		if (content.kind === "text" && content.content !== undefined) {
			if (activePath && isMarkdownPath(activePath))
				return (
					<div className="file-viewer-markdown">
						<MessageContent text={content.content} />
					</div>
				);
			return (
				<div className="file-lines">
					{content.content.split("\n").map((line, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: 文件视图的行身份就是行号，内容不会重排；按内容做 key 反而会因重复行/空行撞 key
						<div className="file-line" key={`line-${index}`}>
							<span className="file-line-no">{index + 1}</span>
							<span className="file-line-text">{line || " "}</span>
						</div>
					))}
				</div>
			);
		}
		return (
			<div className={`work-panel-empty ${content.kind === "tooLarge" ? "is-warning" : "is-muted"}`}>
				<div className="state-mark">
					<FileQuestion size={18} strokeWidth={2} aria-hidden="true" />
				</div>
				<strong>{content.kind === "tooLarge" ? "文件过大无法预览" : "二进制文件无法预览"}</strong>
				<p>
					{formatPanelSize(content.size)}
					{content.kind === "binary" ? " · docx/xlsx/pdf 等格式暂不支持打开" : ""}
				</p>
			</div>
		);
	};

	return (
		<aside className="work-panel" aria-label="文件管理器" style={{ width }}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: 纯鼠标拖拽手柄，补键盘调整宽度属于新功能，不在本次改动范围 */}
			<div className="work-panel-resize" onMouseDown={startResize} title="拖拽调整宽度" />
			<div className="work-panel-headbar">
				<strong>文件管理器</strong>
				{manualPath !== null ? (
					<button type="button" className="work-panel-follow" onClick={() => setManualPath(null)}>
						跟随最新
					</button>
				) : null}
				<button
					type="button"
					className="work-panel-follow"
					onClick={() => {
						const reopen = [...expanded, ""];
						loadedRef.current = new Set();
						setDirs({});
						setReloadSeq((seq) => seq + 1);
						for (const dir of reopen) void loadDir(dir);
					}}
				>
					刷新
				</button>
			</div>
			<div className="work-panel-search">
				<input
					type="search"
					value={query}
					placeholder="按文件名搜索…"
					aria-label="按文件名搜索"
					onChange={(event) => setQuery(event.target.value)}
				/>
			</div>
			<div className={`file-columns${activePath ? " split" : ""}`}>
				<div className="file-tree">
					{query.trim() && searchResults !== null ? (
						searchResults.length === 0 ? (
							<div className="file-tree-note">无匹配文件</div>
						) : (
							searchResults.map((rel) => (
								<button
									key={rel}
									type="button"
									className={`file-tree-row${activePath === rel ? " active" : ""}`}
									onClick={() => setManualPath(rel)}
									title={rel}
								>
									<PanelGlyph kind="file" />
									<span className="file-tree-name">{rel}</span>
								</button>
							))
						)
					) : (
						renderDir("", 0)
					)}
				</div>
				{activePath ? (
					<div className="file-viewer">
						<div className="file-viewer-header">
							<button
								type="button"
								className="file-viewer-back"
								aria-label="关闭预览"
								title="关闭预览"
								onClick={() => setManualPath("")}
							>
								×
							</button>
							<span className="file-viewer-path" title={activePath}>
								{activePath}
							</span>
							{fileState?.status === "ready" ? (
								<span className="file-viewer-size">{formatPanelSize(fileState.content.size)}</span>
							) : null}
						</div>
						<div className="file-viewer-body">{renderPreview()}</div>
					</div>
				) : null}
			</div>
		</aside>
	);
});
