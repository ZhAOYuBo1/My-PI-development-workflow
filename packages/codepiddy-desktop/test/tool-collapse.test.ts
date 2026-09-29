import { describe, expect, test } from "vitest";
import { resolveToolExpanded, toggleToolPin } from "../src/renderer/components/tool-collapse.ts";

describe("tool collapse state machine", () => {
	test("auto expands while running and collapses when completed", () => {
		expect(resolveToolExpanded("auto", "running")).toBe(true);
		expect(resolveToolExpanded("auto", "completed")).toBe(false);
	});

	test("pinned state survives status changes", () => {
		expect(resolveToolExpanded("pinned-open", "completed")).toBe(true);
		expect(resolveToolExpanded("pinned-closed", "running")).toBe(false);
	});

	test("manual toggle pins the card", () => {
		expect(toggleToolPin(true)).toBe("pinned-closed");
		expect(toggleToolPin(false)).toBe("pinned-open");
	});
});
