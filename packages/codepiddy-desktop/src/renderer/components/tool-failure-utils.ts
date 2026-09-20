export type ToolFailureKind = "user-denied" | "policy-denied" | "not-found" | "timeout" | "error";

export function classifyToolFailure(text: string): ToolFailureKind {
	if (/user denied|denied by user|用户拒绝|用户已拒绝/i.test(text)) return "user-denied";
	if (/policy denied|blocked by policy|not permitted|permission.*unavailable|权限策略|策略禁止/i.test(text)) {
		return "policy-denied";
	}
	if (/ENOENT|no such file or directory|path .*not found|找不到.*文件|文件不存在/i.test(text)) return "not-found";
	if (/timed out|timeout|超时/i.test(text)) return "timeout";
	return "error";
}

export function toolFailureLabel(kind: ToolFailureKind): string {
	if (kind === "user-denied") return "用户已拒绝";
	if (kind === "policy-denied") return "策略已阻止";
	if (kind === "not-found") return "路径不存在";
	if (kind === "timeout") return "执行超时";
	return "失败";
}

export function toolFailureGuidance(kind: ToolFailureKind): string {
	if (kind === "user-denied") return "该操作由用户拒绝。Pi 应改用无需该权限的方案，或明确说明为什么仍需要授权。";
	if (kind === "policy-denied") return "该操作被权限策略阻止。Pi 不应原样重试，应使用允许的工具、路径或替代方案。";
	if (kind === "not-found") return "目标路径不存在。Pi 应重新确认当前 Work Item 和项目路径，而不是猜测其他目录。";
	if (kind === "timeout") return "工具执行超时。Pi 可以缩小操作范围、拆分命令或使用替代检查方式。";
	return "工具错误已返回给 Pi；Agent 应继续处理错误、选择替代方案或明确报告阻塞原因。";
}
