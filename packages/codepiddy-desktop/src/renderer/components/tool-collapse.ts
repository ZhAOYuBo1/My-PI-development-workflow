// 工具卡折叠状态机（desktop-tool-collapse）：纯函数，供 ToolCallCard 与单测共用。
export type ToolPinMode = "auto" | "pinned-open" | "pinned-closed";
export type ToolRunStatus = "running" | "completed";

/** 运行中默认展开、完成后默认折叠；一旦手动 pin，自动规则不再生效。 */
export function resolveToolExpanded(mode: ToolPinMode, status: ToolRunStatus): boolean {
	if (mode === "pinned-open") return true;
	if (mode === "pinned-closed") return false;
	return status === "running";
}

/** 任何一次手动点击即进入 pinned，后续事件不再改变其状态。 */
export function toggleToolPin(expanded: boolean): ToolPinMode {
	return expanded ? "pinned-closed" : "pinned-open";
}
