// 流式速率与耗时：纯函数（desktop-stream-stats），供 App.tsx 与单测共用。
export interface FinalStreamStats {
	tokens: number;
	estimated: boolean;
	elapsedMs?: number;
}

/** 中文场景保守估算：每 4 字符约 1 token，宁可低估不夸大。 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(chars: number): number {
	if (!Number.isFinite(chars) || chars <= 0) return 0;
	return Math.max(1, Math.round(chars / CHARS_PER_TOKEN));
}

export function tokensPerSecond(tokens: number, elapsedMs: number): number {
	if (!Number.isFinite(tokens) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
	return tokens / (elapsedMs / 1000);
}

function formatOneDecimal(value: number): string {
	return (Math.round(value * 10) / 10).toFixed(1);
}

export function formatElapsed(elapsedMs: number): string {
	return `${formatOneDecimal(Math.max(0, elapsedMs) / 1000)}s`;
}

/** provider 上报的 usage.output（真值）；缺失或非法返回 null，调用方改用字符估算。 */
export function extractUsageOutput(message: unknown): number | null {
	if (typeof message !== "object" || message === null) return null;
	const usage = (message as { usage?: unknown }).usage;
	if (typeof usage !== "object" || usage === null) return null;
	const output = (usage as { output?: unknown }).output;
	return typeof output === "number" && Number.isFinite(output) && output > 0 ? output : null;
}

/** 流式中：只有字符增量，一律按估算并带“约”。 */
export function formatStreamingStats(chars: number, elapsedMs: number): string {
	const rate = formatOneDecimal(tokensPerSecond(estimateTokens(chars), elapsedMs));
	return `约 ${rate} tok/s · ${formatElapsed(elapsedMs)}`;
}

/**
 * 终值：有 usage 用真值，无 usage 用估算并标“约”。
 * elapsedMs 缺省（刷新后由历史重建）时省略速率与耗时，只保留 token 数。
 */
export function formatFinalStats(stats: FinalStreamStats): string {
	const prefix = stats.estimated ? "约 " : "";
	const count = `${prefix}${stats.tokens.toLocaleString()} tok`;
	if (stats.elapsedMs === undefined) return count;
	const rate = formatOneDecimal(tokensPerSecond(stats.tokens, stats.elapsedMs));
	return `${prefix}${rate} tok/s · ${count} / ${formatElapsed(stats.elapsedMs)}`;
}
