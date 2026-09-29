import { describe, expect, test } from "vitest";
import {
	extractPanelPath,
	extractPanelTitle,
	formatPanelSize,
	normalizePanelPath,
	parseToolArgs,
	projectToolToPanel,
	type ProjectableToolItem,
} from "../src/renderer/components/work-panel.ts";

function tool(overrides: Partial<ProjectableToolItem> = {}): ProjectableToolItem {
	return {
		id: "tool-1",
		name: "write",
		args: "",
		text: "",
		status: "completed",
		isError: false,
		...overrides,
	};
}

describe("tool args parsing", () => {
	test("parses JSON args and tolerates garbage", () => {
		expect(parseToolArgs('{"filePath":"a.md"}')).toEqual({ filePath: "a.md" });
		expect(parseToolArgs("")).toEqual({});
		expect(parseToolArgs("not json")).toEqual({});
		expect(parseToolArgs("[1,2]")).toEqual({});
	});
});

describe("panel title extraction", () => {
	test("uses the basename of file paths", () => {
		expect(extractPanelTitle("read", '{"filePath":"C:\\\\proj\\\\notes.md"}')).toBe("notes.md");
		expect(extractPanelTitle("read", '{"path":"src/app.ts"}')).toBe("app.ts");
	});

	test("falls back to the command first line for shells", () => {
		expect(extractPanelTitle("bash", '{"command":"npm run build\\nmore"}')).toBe("npm run build");
		expect(extractPanelTitle("bash", "")).toBe("bash");
	});
});

describe("tool event projection", () => {
	test("write projects file content from args", () => {
		const entry = projectToolToPanel(
			tool({ name: "write", args: '{"filePath":"notes.md","content":"hello"}', text: "已写入" }),
		);
		expect(entry?.view).toBe("file");
		expect(entry?.title).toBe("notes.md");
		expect(entry?.body).toBe("hello");
	});

	test("edit projects review from result text", () => {
		const entry = projectToolToPanel(
			tool({ name: "edit", args: '{"filePath":"a.ts"}', text: "+new line" }),
		);
		expect(entry?.view).toBe("review");
		expect(entry?.renderName).toBe("edit");
	});

	test("read projects text and bash projects terminal output", () => {
		const read = projectToolToPanel(tool({ name: "read", args: '{"path":"a.md"}', text: "body" }));
		expect(read?.view).toBe("file");
		const bash = projectToolToPanel(
			tool({ name: "bash", args: '{"command":"ls"}', text: "a.md" }),
		);
		expect(bash?.view).toBe("terminal");
		expect(bash?.title).toBe("ls");
	});

	test("unknown tools and empty completed tools project to nothing", () => {
		expect(projectToolToPanel(tool({ name: "skill" }))).toBeNull();
		expect(projectToolToPanel(tool({ name: "read", text: "" }))).toBeNull();
	});

	test("running tools project even before output arrives", () => {
		const entry = projectToolToPanel(tool({ name: "bash", status: "running", text: "" }));
		expect(entry?.view).toBe("terminal");
		expect(entry?.running).toBe(true);
	});
});

describe("panel path extraction", () => {
	test("extracts normalized file paths for file tools", () => {
		expect(extractPanelPath("write", '{"filePath":"notes.md"}')).toBe("notes.md");
		expect(extractPanelPath("edit", '{"path":"src\\\\app.ts"}')).toBe("src/app.ts");
		expect(extractPanelPath("read", '{"path":"./a.md"}')).toBe("a.md");
	});

	test("returns null for non-file tools or missing paths", () => {
		expect(extractPanelPath("bash", '{"command":"ls"}')).toBeNull();
		expect(extractPanelPath("write", "")).toBeNull();
		expect(normalizePanelPath("a\\b\\c")).toBe("a/b/c");
	});

	test("formats file sizes compactly", () => {
		expect(formatPanelSize(213)).toBe("213 B");
		expect(formatPanelSize(2048)).toBe("2.0 KB");
		expect(formatPanelSize(5 * 1024 * 1024)).toBe("5.0 MB");
	});
});
