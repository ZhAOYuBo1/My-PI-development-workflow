/**
 * 权限弹窗按钮的呈现规则。
 *
 * 弹窗是通用扩展 UI：扩展把选项文案原样发过来，桌面端照着渲染。所以桌面端必须
 * 知道哪个是主按钮、哪个是放行 —— 之前是 `option.startsWith("Allow")`，扩展一旦
 * 改文案（现在改成中文了）样式就全部失效。
 *
 * 这里用标签查表而不是猜前缀；`permission-choices.test.ts` 会断言这张表和
 * 权限扩展导出的 `PERMISSION_DECISION_LABELS` 完全一致，两边不会各自漂移。
 * 表里没有的标签一律按「次要按钮 + 中性」处理，不会有未定义行为。
 */
export type PermissionChoicePresentation = {
	readonly className: "primary-button" | "secondary-button";
	readonly tone: "approve" | "deny" | "unknown";
};

const APPROVE_OPTIONS: readonly string[] = ["仅本次允许", "该 Agent 始终允许"];
const DENY_OPTIONS: readonly string[] = ["拒绝", "拒绝并说明原因"];

export function permissionChoicePresentation(label: string): PermissionChoicePresentation {
	if (APPROVE_OPTIONS.includes(label)) {
		// 放行类都是主色；「仅本次允许」排在第一位，回车默认落在它上面。
		return { className: "primary-button", tone: "approve" };
	}
	if (DENY_OPTIONS.includes(label)) {
		return { className: "secondary-button", tone: "deny" };
	}
	return { className: "secondary-button", tone: "unknown" };
}

/** 供测试断言：桌面端认识的全部标签。 */
export const KNOWN_PERMISSION_CHOICE_LABELS: readonly string[] = [...APPROVE_OPTIONS, ...DENY_OPTIONS];
