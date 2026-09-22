import path from "node:path";
import { describe, expect, test } from "vitest";
import {
	assertPathInside,
	parseAgentLocator,
	parseCreateWorkItemInput,
	parseExtensionUiResponseInput,
	parsePermissionDefaults,
	parseRoleSkillAssignmentsInput,
	parseSendAgentPromptInput,
	parseSetAgentScopedModelsInput,
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

	test("accepts image-only prompts and rejects unsafe image payloads", () => {
		const locator = {
			agentInstanceId: "agent-1",
			projectId: "project-1",
			workItemId: "FEAT-001",
			role: "coding",
		};
		expect(
			parseSendAgentPromptInput({
				...locator,
				message: "",
				images: [{ id: "image-1", name: "example.png", mimeType: "image/png", data: "aA==" }],
			}),
		).toMatchObject({ message: "", images: [{ mimeType: "image/png", data: "aA==" }] });
		expect(() => parseSendAgentPromptInput({ ...locator, message: "", images: [] })).toThrow(/至少需要/);
		expect(() =>
			parseSendAgentPromptInput({
				...locator,
				message: "image",
				images: [{ id: "image-1", name: "bad.svg", mimeType: "image/svg+xml", data: "aA==" }],
			}),
		).toThrow(/不支持的图片格式/);
	});

	test("validates and de-duplicates scoped model configuration", () => {
		const input = {
			agentInstanceId: "agent-1",
			projectId: "project-1",
			workItemId: "FEAT-001",
			role: "coding",
			models: [{ provider: "openai", modelId: "gpt-5", thinkingLevel: "high" }],
		};
		expect(parseSetAgentScopedModelsInput(input).models).toEqual(input.models);
		expect(() => parseSetAgentScopedModelsInput({ ...input, models: [...input.models, ...input.models] })).toThrow(
			/重复/,
		);
	});

	test("validates global permission settings for common tool categories", () => {
		const input = {
			read: "allow",
			write: "allow",
			bash: "allow",
			mcp: "ask",
			skills: "allow",
			otherTools: "ask",
			externalDirectory: "deny",
		};
		expect(parsePermissionDefaults(input)).toEqual(input);
		expect(() => parsePermissionDefaults({ ...input, bash: "always" })).toThrow(/命令执行权限状态无效/);
		expect(() => parsePermissionDefaults({ ...input, read: "always" })).toThrow(/读取权限状态无效/);
	});
});
