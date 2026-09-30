import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { listWorkspaceDir, readWorkspaceFile } from "../src/workspace-fs.ts";

let root = "";

beforeAll(() => {
	root = mkdtempSync(path.join(tmpdir(), "workspace-fs-"));
	mkdirSync(path.join(root, "src"));
	mkdirSync(path.join(root, "empty"));
	writeFileSync(path.join(root, "b.md"), "# hi\n");
	writeFileSync(path.join(root, "a.ts"), "const x = 1;\n");
	writeFileSync(path.join(root, "src", "z.ts"), "z\n");
	writeFileSync(path.join(root, "app.exe"), Buffer.from([0x4d, 0x5a, 0x00, 0x01]));
	writeFileSync(
		path.join(root, "dot.png"),
		Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
			"base64",
		),
	);
});

afterAll(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("listWorkspaceDir", () => {
	test("lists dirs first, case-insensitive, with file sizes", async () => {
		const entries = await listWorkspaceDir(root, "");
		expect(entries.map((entry) => entry.name)).toEqual(["empty", "src", "a.ts", "app.exe", "b.md", "dot.png"]);
		expect(entries[0]).toMatchObject({ kind: "dir", size: 0 });
		expect(entries.find((entry) => entry.name === "b.md")?.size).toBeGreaterThan(0);
	});

	test("rejects paths escaping the project root", async () => {
		await expect(listWorkspaceDir(root, "..")).rejects.toThrow("超出项目范围");
		await expect(readWorkspaceFile(root, "../secret")).rejects.toThrow("超出项目范围");
	});
});

describe("readWorkspaceFile", () => {
	test("reads text files", async () => {
		const file = await readWorkspaceFile(root, "b.md");
		expect(file.kind).toBe("text");
		expect(file.content).toBe("# hi\n");
	});

	test("detects binary files", async () => {
		const file = await readWorkspaceFile(root, "app.exe");
		expect(file.kind).toBe("binary");
		expect(file.content).toBeUndefined();
	});

	test("encodes images as data URLs", async () => {
		const file = await readWorkspaceFile(root, "dot.png");
		expect(file.kind).toBe("image");
		expect(file.dataUrl?.startsWith("data:image/png;base64,")).toBe(true);
	});

	test("rejects directories", async () => {
		await expect(readWorkspaceFile(root, "src")).rejects.toThrow("不是文件");
	});
});
