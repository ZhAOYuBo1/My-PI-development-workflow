import { memo } from "react";

// 与 App.tsx AppIcon 同源：24 grid、2px 粗线、圆角、每图标一个实心点缀、currentColor。
// 几何数据来自外部图标包 codepiddy-icons/（32 个，命名一一对应），
// 设计源见 src/renderer/assets/icons/*.svg，此处仅保留几何以继承主题色。
export type ToolIconName =
	| "eye"
	| "terminal"
	| "edit"
	| "file-plus"
	| "text-search"
	| "file-search"
	| "list"
	| "sparkles"
	| "plug"
	| "checklist"
	| "message-question"
	| "globe"
	| "clock"
	| "check-circle"
	| "x-circle"
	| "caret"
	| "shield";

export function toolIconForTool(toolName: string): ToolIconName {
	const name = toolName.toLowerCase();
	if (name === "read") return "eye";
	if (name === "bash" || name === "powershell") return "terminal";
	if (name === "edit") return "edit";
	if (name === "write") return "file-plus";
	if (name === "grep") return "text-search";
	if (name === "find") return "file-search";
	if (name === "ls") return "list";
	if (name === "skill") return "sparkles";
	if (name === "mcp") return "plug";
	if (name === "todo") return "checklist";
	if (name === "question") return "message-question";
	if (name === "web_search" || name === "tavily" || name === "tavily-search") return "globe";
	return "sparkles";
}

export const ToolIcon = memo(function ToolIcon({
	name,
	size = 14,
	className = "",
}: {
	name: ToolIconName;
	size?: number;
	className?: string;
}) {
	return (
		<svg
			className={`app-svg-icon tool-glyph ${className}`}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{name === "eye" ? (
				<>
					<path d="M4.2 12c2-3.2 4.6-4.8 7.8-4.8s5.8 1.6 7.8 4.8c-2 3.2-4.6 4.8-7.8 4.8S6.2 15.2 4.2 12z" />
					<path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
					<circle cx="11.2" cy="11.8" r="1.15" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "terminal" ? (
				<>
					<rect x="4.5" y="5.5" width="15" height="13" rx="2.5" />
					<path d="m7.5 9.5 2.5 2.5-2.5 2.5" />
					<path d="M12.5 14.5h3.5" />
					<rect x="14.5" y="14" width="3.5" height="1.5" rx="0.75" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "edit" ? (
				<>
					<path d="m13.5 6 4.5 4.5M5 19l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L6.2 15.1 5 19z" />
					<path d="M5 19l3.2-3.2" />
					<path d="M15 5.3 18.7 9l-1.4 1.4-3.7-3.7z" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "file-plus" ? (
				<>
					<path d="M6 4.5h7l5 5V13M13 4.5v5h5M6 4.5v15h6" />
					<path d="M15 14h2v2h2v2h-2v2h-2v-2h-2v-2h2z" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "text-search" ? (
				<>
					<path d="M4.5 6.5h10M4.5 10h8M4.5 13.5h6" />
					<circle cx="15.2" cy="14.2" r="3.1" />
					<path d="m17.5 16.5 2.2 2.2" />
					<circle cx="15.2" cy="14.2" r="1" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "file-search" ? (
				<>
					<path d="M6 4.5h7l5 5v2M13 4.5v5h5M6 4.5v15h5" />
					<circle cx="14.5" cy="14.5" r="3" />
					<path d="m16.7 16.7 2.5 2.5" />
					<circle cx="14.5" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "list" ? (
				<>
					<circle cx="6" cy="6.5" r="1" />
					<circle cx="6" cy="12" r="1" />
					<circle cx="6" cy="17.5" r="1" />
					<path d="M10 6.5h9M10 12h9M10 17.5h9" />
					<circle cx="6" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "sparkles" ? (
				<>
					<path d="M11.5 4.5 13 9l4.5 1.5L13 12l-1.5 4.5L10 12l-4.5-1.5L10 9z" />
					<path d="m18 4 .5 1.3 1.3.5-1.3.5L18 7.6l-.5-1.3-1.3-.5 1.3-.5z" />
					<path d="M6 17.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "plug" ? (
				<>
					<path d="M9 4.5v4m6-4v4M7 8.5h10V12a5 5 0 0 1-5 5 5 5 0 0 1-5-5zM12 17v2.5" />
					<path d="M5 12h2" />
					<circle cx="12" cy="19" r="0.8" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "checklist" ? (
				<>
					<rect x="4.5" y="5" width="5" height="5" rx="1.5" />
					<path d="M12 7.5h7" />
					<rect x="4.5" y="14" width="5" height="5" rx="1.5" />
					<path d="M12 16.5h7" />
					<path d="M5.3 7.4 6.6 8.7l2.5-2.8 1.2 1.1-3.7 4z" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "message-question" ? (
				<>
					<path d="M6.5 5.5h11a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-6l-4.5 3v-3a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z" />
					<path d="M9.5 9.8a2.5 2.5 0 1 1 4.5 1.5c-.7.9-2 1.1-2 2.5" />
					<circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "globe" ? (
				<>
					<path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z" />
					<path d="M4.7 12h14.6M12 4.5c2 2 3 4.5 3 7.5s-1 5.5-3 7.5m0-15c-2 2-3 4.5-3 7.5s1 5.5 3 7.5" />
					<path
						d="M16 6.5a2.1 2.1 0 0 0-2.1 2.1c0 1.5 2.1 3.8 2.1 3.8s2.1-2.3 2.1-3.8A2.1 2.1 0 0 0 16 6.5z"
						fill="currentColor"
						stroke="none"
					/>
				</>
			) : null}
			{name === "clock" ? (
				<>
					<path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z" />
					<path d="M12 7.5V12l3.5 2" />
					<circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "check-circle" ? (
				<>
					<path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z" />
					<path d="M7.6 12.1 10.5 15l6-6.2-1.3-1.2-4.7 4.9-1.7-1.7z" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "x-circle" ? (
				<>
					<path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z" />
					<path
						d="M9.1 7.8 12 10.7l2.9-2.9 1.3 1.3-2.9 2.9 2.9 2.9-1.3 1.3-2.9-2.9-2.9 2.9-1.3-1.3 2.9-2.9-2.9-2.9z"
						fill="currentColor"
						stroke="none"
					/>
				</>
			) : null}
			{name === "caret" ? <path d="M9.5 5.5 16.5 12l-7 6.5" /> : null}
			{name === "shield" ? (
				<>
					<path d="M12 4.5 19 7v5c0 4.2-2.8 6.8-7 8-4.2-1.2-7-3.8-7-8V7z" />
					<path d="M12 11v4" />
					<circle cx="12" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
				</>
			) : null}
		</svg>
	);
});
