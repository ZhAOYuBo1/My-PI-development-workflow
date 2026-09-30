/**
 * Pi 的思考强度取值（packages/ai/src/types.ts 的 ModelThinkingLevel）。
 *
 * 单独成文件而不是放在 ThinkingControl.tsx 里，有两个原因：
 * 映射表是纯数据、不含 JSX，拆出来后根 tsconfig（不带 --jsx，且排除 renderer 目录）
 * 也能让测试直接 import 它；组件文件则只负责交互。
 */
export const THINKING_LEVEL_LABELS: Readonly<Record<string, string>> = {
	off: "关闭",
	minimal: "极低",
	low: "低",
	medium: "中",
	high: "高",
	xhigh: "极高",
	max: "最高",
};

/** 表里没有的原样回显，Pi 以后新增档位时至少还能看出当前是什么。 */
export function thinkingLevelLabel(level: string): string {
	return THINKING_LEVEL_LABELS[level] ?? level;
}
