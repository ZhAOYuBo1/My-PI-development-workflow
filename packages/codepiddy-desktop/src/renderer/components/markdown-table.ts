// GFM 表格解析的纯逻辑。message-content.tsx 只负责把结果画成 <table>。
// 拆出来是因为根 tsconfig 排除了 src/renderer/**，test/ 里只有 .ts 模块能被断言。
export type TableAlignment = "left" | "center" | "right" | null;

/**
 * 切一行表格单元格。只认首尾都带 `|` 的行，这样正文里偶然出现的单根竖线
 * （ASCII 树、diff、竖排引用）不会被误判成表格。
 * 收尾的 `|` 还没到就返回 null —— 流式输出期间那一行必须留在表格外面，
 * 否则每来一个 token 就会多出半列。
 */
export function splitTableRow(line: string): string[] | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|") || trimmed.length < 3) return null;
	return trimmed
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
}

/** 把 `|---|---|` 分隔行解析成每列的对齐方式；不是分隔行就返回 null。 */
export function tableAlignment(cells: string[] | null): TableAlignment[] | null {
	if (!cells || cells.length === 0) return null;
	if (!cells.every((cell) => /^:?-+:?$/.test(cell))) return null;
	return cells.map((cell) => {
		const left = cell.startsWith(":");
		const right = cell.endsWith(":");
		if (left && right) return "center" as const;
		if (right) return "right" as const;
		if (left) return "left" as const;
		return null;
	});
}

/**
 * 列数取最宽的那一行，不能只信表头。模型很爱写「首列是行标签」的对比表，
 * 却忘了把行标签那一列写进表头（表头 2 列、数据行 3 列），
 * 按 GFM 的表头宽度截断会静默吃掉整列内容。
 */
export function tableColumnCount(head: string[], rows: string[][]): number {
	return Math.max(head.length, ...rows.map((row) => row.length));
}
