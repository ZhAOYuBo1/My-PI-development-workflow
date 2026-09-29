import { memo } from "react";

// 与 App.tsx AppIcon 同源：24 grid、2px 粗线、圆角、每图标一个实心点缀、currentColor。
// 几何数据由 svg-precision-skill 生成（spec -> build -> validate），v3 高级版（2px + 实心点缀），
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
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{name === "eye" ? (
				<>
					<path d="M3.5 12Q7.5 5.8 12 5.8Q16.5 5.8 20.5 12Q16.5 18.2 12 18.2Q7.5 18.2 3.5 12Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "terminal" ? (
				<>
					<rect x="5" y="4.5" width="14" height="15" rx="3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M9.3 9.3L12.3 12L9.3 14.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<rect x="13.6" y="10.9" width="3" height="2.2" rx="1.1" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "edit" ? (
				<>
					<path d="M4.8 19.2l1-3.8L16.3 4.9a2.05 2.05 0 0 1 2.9 2.9L8.7 18.3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M14.8 6.4l2.9 2.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="5.6" cy="18.4" r="1.4" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "file-plus" ? (
				<>
					<path d="M7 3.5h5.5L17 8v12.5h-10Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M12.5 3.5V8H17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<rect x="12.6" y="14.7" width="6.4" height="2.6" rx="1.3" fill="currentColor" stroke="none" />
					<rect x="14.5" y="12.8" width="2.6" height="6.4" rx="1.3" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "text-search" ? (
				<>
					<path d="M4.5 7h8.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M4.5 10.5h8.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<rect x="4.5" y="12.9" width="5" height="2.6" rx="1.3" fill="currentColor" stroke="none" />
					<circle cx="16.3" cy="16.3" r="2.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M18.4 18.4L20.5 20.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
				</>
			) : null}
			{name === "file-search" ? (
				<>
					<path d="M7 3.5h5.5L17 8v12.5h-10Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M12.5 3.5V8H17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="15.3" cy="15.3" r="3.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M17.7 17.7L20.3 20.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="15.3" cy="15.3" r="1.6" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "list" ? (
				<>
					<circle cx="5.3" cy="6.5" r="1.8" fill="currentColor" stroke="none" />
					<circle cx="5.3" cy="12" r="1.8" fill="currentColor" stroke="none" />
					<circle cx="5.3" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
					<path d="M9.8 6.5h9.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M9.8 12h9.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M9.8 17.5h9.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
				</>
			) : null}
			{name === "sparkles" ? (
				<>
					<path d="M10 3Q11.2 8.8 17 10Q11.2 11.2 10 17Q8.8 11.2 3 10Q8.8 8.8 10 3Z" fill="currentColor" stroke="none" />
					<path d="M17.3 14.1Q17.7 16.9 20.5 17.3Q17.7 17.7 17.3 20.5Q16.9 17.7 14.1 17.3Q16.9 16.9 17.3 14.1Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="18.3" cy="6.3" r="1.3" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "plug" ? (
				<>
					<rect x="8.7" y="3.5" width="2.4" height="4.5" rx="1.2" fill="currentColor" stroke="none" />
					<rect x="12.9" y="3.5" width="2.4" height="4.5" rx="1.2" fill="currentColor" stroke="none" />
					<path d="M8 10h8v4a4 4 0 0 1-8 0Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M12 18v2.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
				</>
			) : null}
			{name === "checklist" ? (
				<>
					<rect x="6" y="4.5" width="12" height="15.5" rx="2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<rect x="9.8" y="3" width="4.4" height="3" rx="1.5" fill="currentColor" stroke="none" />
					<path d="M8.3 10.2l1.5 1.5 2.7-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M13.8 10.2h2.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M8.3 14.7l1.5 1.5 2.7-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M13.8 14.7h2.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
				</>
			) : null}
			{name === "message-question" ? (
				<>
					<rect x="3.5" y="4" width="17" height="12" rx="3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M9 15.8V19.2L13 15.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M10.2 10.4c0-1.9 1-2.8 2-2.8 1 0 1.8.9 1.6 2-.2 1.2-1 1.6-1.8 1.9v.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="12" cy="13.9" r="1.4" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "globe" ? (
				<>
					<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<ellipse cx="12" cy="12" rx="3.6" ry="8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M4 12h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="14.6" cy="8.6" r="1.7" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "clock" ? (
				<>
					<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M12 7.5V12L15.3 13.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
				</>
			) : null}
			{name === "check-circle" ? (
				<>
					<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M8.3 12.3l2.5 2.5 4.9-5.4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
				</>
			) : null}
			{name === "x-circle" ? (
				<>
					<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M9.4 9.4L14.6 14.6M14.6 9.4L9.4 14.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
				</>
			) : null}
			{name === "shield" ? (
				<>
					<path d="M12 3.5L18 6v5.5c0 4-2.6 6.8-6 8.5-3.4-1.7-6-4.5-6-8.5V6Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M9.2 11.6l2 2.1 3.9-4.4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
				</>
			) : null}
		</svg>
	);
});
