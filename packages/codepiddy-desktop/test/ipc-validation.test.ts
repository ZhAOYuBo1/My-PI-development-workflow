import path from "node:path";
import { describe, expect, test } from "vitest";
import {
	assertPathInside,
	parseAgentLocator,
	parseCreateWorkItemInput,
	parseExtensionUiResponseInput,
	parseRoleSkillAssignmentsInput,
} from "../src/main/ipc-validation.ts";

describe("IPC runtime validation", () => {
	test("rejects malformed roles, ids and oversized work item values", () => {
		expect(() =>
			parseAgentLocator({
				agentInstanceId: "agent-1",
				projectId: "project-1",
				workItemId: "OTHER-001",
				role: "admin",
			}),
		).toThrow();
		expect(() =>
			parseCreateWorkItemInput({
				projectRoot: "C:/project",
				lane: "requirements",
				title: "x".repeat(201),
				description: "",
			}),
		).toThrow(/标题/);
	});

	test("validates permission response value types and size", () => {
		expect(() =>
			parseExtensionUiResponseInput({
				agentInstanceId: "agent-1",
				projectId: "project-1",
				workItemId: "FEAT-001",
				role: "coding",
				requestId: "request-1",
				confirmed: "yes",
			}),
		).toThrow(/布尔值/);
	});

	test("normalizes role skill assignments and rejects path escape", () => {
		expect(
			parseRoleSkillAssignmentsInput({ role: "review", skillIds: ["builtin:test", "builtin:test"] }).skillIds,
		).toEqual(["builtin:test"]);
		const parent = path.resolve("C:/workspace/project/.codepiddy");
		expect(() => assertPathInside(parent, path.resolve(parent, "requirements/FEAT-001"), "Work Item")).not.toThrow();
		expect(() => assertPathInside(parent, path.resolve(parent, "../outside"), "Work Item")).toThrow(/超出允许目录/);
	});
});
