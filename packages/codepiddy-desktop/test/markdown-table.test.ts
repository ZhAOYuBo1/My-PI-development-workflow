import { describe, expect, it } from "vitest";
import { splitTableRow, tableAlignment, tableColumnCount } from "../src/renderer/components/markdown-table.ts";

// 需求分析 Agent 的方案对比表。GFM 要求表头下面必须紧跟 `|---|---|` 分隔行，
// 少这一行就只能当普通段落，所以之前整张表是以管道符原文显示的。
const LINES = [
	"| 方案 A：经典单人贪吃蛇 | 方案 B：多蛇竞技场（大作战） |",
	"|---|---|",
	"| 场上蛇数 | 1 条（玩家） | 玩家 1 条 + 若干 AI 蛇（如 5–15 条） |",
	"| 死亡条件 | 撞墙 / 撞自己 | 撞墙 / 撞自己 / **撞任意蛇身**（含 AI） |",
	"| 复杂度 | 低（单文件即可） | 中高（AI 行为、碰撞网格、重生、排名） |",
];

function parse(lines: string[]) {
	const head = splitTableRow(lines[0]!);
	const align = tableAlignment(splitTableRow(lines[1]!));
	if (!head || !align) return null;
	const rows: string[][] = [];
	for (const line of lines.slice(2)) {
		const row = splitTableRow(line);
		if (!row) break;
		rows.push(row);
	}
	return { head, align, rows, columns: tableColumnCount(head, rows) };
}

describe("splitTableRow", () => {
	it("splits a row and trims each cell", () => {
		expect(splitTableRow("| 场上蛇数 | 1 条（玩家） |")).toEqual(["场上蛇数", "1 条（玩家）"]);
	});

	it("keeps inline markup inside the cell so it can still be rendered", () => {
		expect(splitTableRow("| 死亡条件 | **撞任意蛇身**（含 AI） |")?.[1]).toBe("**撞任意蛇身**（含 AI）");
	});

	it("rejects a half-written row so streaming never grows a partial column", () => {
		expect(splitTableRow("| 1 | 2")).toBeNull();
		expect(splitTableRow("1 | 2 |")).toBeNull();
		expect(splitTableRow("|")).toBeNull();
	});

	it("does not claim ordinary prose or ASCII art", () => {
		expect(splitTableRow("方案 A 和方案 B 的区别")).toBeNull();
		expect(splitTableRow("| main")).toBeNull();
	});
});

describe("tableAlignment", () => {
	it("reads :--- / :---: / ---: as left / center / right", () => {
		expect(tableAlignment(splitTableRow("| :--- | :---: | ---: |"))).toEqual(["left", "center", "right"]);
	});

	it("treats a plain --- as no alignment", () => {
		expect(tableAlignment(splitTableRow("|---|---|"))).toEqual([null, null]);
	});

	it("rejects a row that is not a delimiter", () => {
		expect(tableAlignment(splitTableRow("| a | b |"))).toBeNull();
		expect(tableAlignment(null)).toBeNull();
	});
});

describe("tableColumnCount", () => {
	it("widens the grid when the header is narrower than the rows", () => {
		// 模型把「首列行标签」漏出了表头：表头 2 列、数据行 3 列。
		// 按 GFM 的表头宽度截断会静默吃掉第三列（含 **撞任意蛇身** 那一整段）。
		const table = parse(LINES);
		expect(table?.columns).toBe(3);
		expect(table?.head).toHaveLength(2);
		expect(table?.rows.every((row) => row.length === 3)).toBe(true);
		// 补出来的第三列必须有内容，不能是空的
		expect(table?.rows[1]?.[2]).toContain("撞任意蛇身");
	});

	it("uses the header width when every row matches it", () => {
		const table = parse(["| a | b |", "|---|---|", "| 1 | 2 |"]);
		expect(table?.columns).toBe(2);
	});

	it("handles a header-only table that is still streaming in", () => {
		const table = parse(["| a | b |", "|---|---|"]);
		expect(table?.columns).toBe(2);
		expect(table?.rows).toEqual([]);
	});
});
