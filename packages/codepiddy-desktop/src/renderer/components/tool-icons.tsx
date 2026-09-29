import { memo } from "react";

// 与 App.tsx AppIcon 同风格：24 grid、线宽 1.7、圆角、currentColor。
// 几何数据由 svg-precision-skill 生成（spec -> build -> validate），
// 详见 src/renderer/assets/icons/*.svg，此处仅保留几何以继承主题色。
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
	if (name === "tavily" || name === "tavily-search") return "globe";
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
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{name === "eye" ? (
				<>
					<path d="M3.5 12 C6 7.5 9.5 5.5 12 5.5 C14.5 5.5 18 7.5 20.5 12 C18 16.5 14.5 18.5 12 18.5 C9.5 18.5 6 16.5 3.5 12 Z" />
					<circle cx="12" cy="12" r="2.5" />
				</>
			) : null}
			{name === "terminal" ? (
				<>
					<rect x="4" y="4" width="16" height="16" rx="2" />
					<path d="M8.5 9.5 L11.5 12 L8.5 14.5" />
					<line x1="13.5" y1="15" x2="16" y2="15" />
				</>
			) : null}
			{name === "edit" ? (
				<>
					<path d="M4 20h4l11-11-4-4L4 16v4Z" />
					<path d="m13.5 6.5 4 4" />
				</>
			) : null}
			{name === "file-plus" ? (
				<>
					<path d="M6 3.5 H13 L17.5 8 V20.5 H6 Z" />
					<path d="M13 3.5 V8 H17.5" />
					<line x1="10" y1="13" x2="10" y2="17" />
					<line x1="8" y1="15" x2="12" y2="15" />
				</>
			) : null}
			{name === "text-search" ? (
				<>
					<circle cx="9" cy="9" r="4.5" />
					<path d="M12.5 12.5 L15.5 15.5" />
					<line x1="17" y1="8.5" x2="20.5" y2="8.5" />
					<line x1="17" y1="12" x2="20.5" y2="12" />
					<line x1="17" y1="15.5" x2="20.5" y2="15.5" />
				</>
			) : null}
			{name === "file-search" ? (
				<>
					<path d="M6 4 H14 L18 8 V20 H6 Z" />
					<path d="M14 4 V8 H18" />
					<circle cx="12" cy="13.5" r="2.8" />
					<path d="M14.2 15.7 L16.5 18" />
				</>
			) : null}
			{name === "list" ? (
				<>
					<line x1="9" y1="6.5" x2="20" y2="6.5" />
					<line x1="9" y1="12" x2="20" y2="12" />
					<line x1="9" y1="17.5" x2="20" y2="17.5" />
					<line x1="4" y1="6.5" x2="6.5" y2="6.5" />
					<line x1="4" y1="12" x2="6.5" y2="12" />
					<line x1="4" y1="17.5" x2="6.5" y2="17.5" />
				</>
			) : null}
			{name === "sparkles" ? (
				<>
					<path d="M12 4 C12.8 8 13.5 10 18 11 C13.5 12 12.8 14 12 18 C11.2 14 10.5 12 6 11 C10.5 10 11.2 8 12 4 Z" />
					<path d="M18.5 15 C18.9 16.8 19.3 17.5 21 18 C19.3 18.5 18.9 19.2 18.5 21 C18.1 19.2 17.7 18.5 16 18 C17.7 17.5 18.1 16.8 18.5 15 Z" />
				</>
			) : null}
			{name === "plug" ? (
				<>
					<line x1="9" y1="3.5" x2="9" y2="7" />
					<line x1="15" y1="3.5" x2="15" y2="7" />
					<path d="M7.5 7 H16.5 V12.5 A4.5 4.5 0 0 1 7.5 12.5 Z" />
					<line x1="12" y1="17" x2="12" y2="20.5" />
					<line x1="9.5" y1="17" x2="14.5" y2="17" />
				</>
			) : null}
			{name === "checklist" ? (
				<>
					<rect x="5" y="4" width="14" height="16" rx="2" />
					<path d="M8.5 9 L10 10.5 L12.5 8" />
					<path d="M8.5 14 L10 15.5 L12.5 13" />
					<line x1="14" y1="9.5" x2="17" y2="9.5" />
					<line x1="14" y1="14.5" x2="17" y2="14.5" />
					<line x1="8.5" y1="18.5" x2="15.5" y2="18.5" />
				</>
			) : null}
			{name === "message-question" ? (
				<>
					<path d="M4 5.5 H20 V14.5 H12 L8.5 18.5 V14.5 H4 Z" />
					<path d="M10.5 9.5 A1.8 1.8 0 1 1 12.5 11.5 C12.5 12.3 12 12.5 12 13.2" />
					<line x1="12" y1="15.5" x2="12.1" y2="15.5" />
				</>
			) : null}
			{name === "globe" ? (
				<>
					<circle cx="12" cy="12" r="7.5" />
					<path d="M12 4.5 C14.5 7 14.5 17 12 19.5 C9.5 17 9.5 7 12 4.5 Z" />
					<line x1="4.5" y1="12" x2="19.5" y2="12" />
				</>
			) : null}
			{name === "clock" ? (
				<>
					<circle cx="12" cy="12" r="7.5" />
					<path d="M12 8 V12 L15 14" />
				</>
			) : null}
			{name === "check-circle" ? (
				<>
					<circle cx="12" cy="12" r="7.5" />
					<path d="M8.5 12.2 L11 14.7 L15.5 9.8" />
				</>
			) : null}
			{name === "x-circle" ? (
				<>
					<circle cx="12" cy="12" r="7.5" />
					<path d="M9.5 9.5 L14.5 14.5" />
					<path d="M14.5 9.5 L9.5 14.5" />
				</>
			) : null}
			{name === "shield" ? (
				<>
					<path d="M12 3.5 L18.5 6 V11.5 C18.5 15.5 15.5 18.5 12 20.5 C8.5 18.5 5.5 15.5 5.5 11.5 V6 Z" />
					<path d="M9.5 11.8 L11.3 13.6 L14.8 10" />
				</>
			) : null}
		</svg>
	);
});
