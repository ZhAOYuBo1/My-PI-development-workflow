import { describe, expect, it } from "vitest";
import {
	inferPanelPathFromText,
	isUnifiedDiffText,
	panelDiffLines,
	type WorkPanelEntry,
} from "../src/renderer/components/work-panel.ts";

function entry(overrides: Partial<WorkPanelEntry>): WorkPanelEntry {
	return {
		id: "tool-1",
		toolName: "write",
		title: "a.txt",
		path: "a.txt",
		timestamp: 0,
		view: "file",
		renderName: "write",
		body: "",
		isError: false,
		running: false,
		...overrides,
	};
}

describe("panelDiffLines", () => {
	it("does not treat markdown list content as removals", () => {
		const lines = panelDiffLines(entry({ body: "# 金缕衣\n\n- 朝代：唐\n- 作者：佚名\n" }));
		expect(lines.every((line) => line.type === "add")).toBe(true);
		expect(lines.map((line) => line.text)).toContain("- 朝代：唐");
	});

	it("parses a unified patch into add, remove and context lines", () => {
		const body = [
			"--- a.txt",
			"+++ a.txt",
			"@@ -1,5 +1,9 @@",
			"-《金缕衣》",
			"-唐·佚名",
			"+# 金缕衣",
			" ",
			"+- 朝代：唐",
			"+## 正文",
			" 劝君莫惜金缕衣，劝君惜取少年时。",
		].join("\n");
		const lines = panelDiffLines(entry({ toolName: "edit", view: "review", renderName: "edit", body }));
		expect(lines.filter((line) => line.type === "remove")).toHaveLength(2);
		expect(lines.filter((line) => line.type === "add")).toHaveLength(3);
		expect(lines.some((line) => line.type === "hunk")).toBe(true);
	});

	it("only accepts real unified diffs", () => {
		expect(isUnifiedDiffText("- not a diff\n- still content")).toBe(false);
		expect(isUnifiedDiffText("@@ -1 +1 @@\n-a\n+b")).toBe(true);
	});

	it("recovers the new path from a /dev/null patch", () => {
		expect(inferPanelPathFromText("--- /dev/null\n+++ C:\\testPICODE\\a.txt\n@@ -0,0 +1 @@\n+# 金缕衣\n")).toBe(
			"C:/testPICODE/a.txt",
		);
	});
});
