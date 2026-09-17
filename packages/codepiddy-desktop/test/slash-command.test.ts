import type { AgentCommandOption, AgentModelSelection } from "@codepiddy/shared";
import { describe, expect, test } from "vitest";
import {
	isExecutableSlashInvocation,
	shouldExecuteCommandOnSelect,
} from "../src/renderer/components/slash-command-utils.ts";

const commands: AgentCommandOption[] = [
	{ name: "model", command: "/model", description: "Select model", source: "builtin" },
	{ name: "thinking", command: "/thinking", description: "Set thinking", source: "builtin" },
	{ name: "compact", command: "/compact", description: "Compact", source: "builtin" },
	{ name: "name", command: "/name", description: "Name", source: "builtin" },
];

const selection: AgentModelSelection = {
	model: { provider: "openai", id: "gpt-5.5", name: "GPT-5.5", reasoning: true },
	thinkingLevel: "medium",
	availableThinkingLevels: ["low", "medium", "high"],
	availableModels: [{ provider: "openai", id: "gpt-5.5", name: "GPT-5.5", reasoning: true }],
};

describe("Pi slash command execution detection", () => {
	test("executes exact commands instead of trapping Enter in autocomplete", () => {
		expect(isExecutableSlashInvocation("/compact", commands, selection)).toBe(true);
		expect(isExecutableSlashInvocation("/model", commands, selection)).toBe(true);
		expect(isExecutableSlashInvocation("/name My Session", commands, selection)).toBe(true);
		expect(isExecutableSlashInvocation("/comp", commands, selection)).toBe(false);
	});

	test("validates Pi model and thinking arguments before execution", () => {
		expect(isExecutableSlashInvocation("/model openai/gpt-5.5", commands, selection)).toBe(true);
		expect(isExecutableSlashInvocation("/model openai/missing", commands, selection)).toBe(false);
		expect(isExecutableSlashInvocation("/thinking high", commands, selection)).toBe(true);
		expect(isExecutableSlashInvocation("/thinking ultra", commands, selection)).toBe(false);
	});
	test("executes selected Pi actions immediately while keeping argument-based resources editable", () => {
		expect(shouldExecuteCommandOnSelect(commands[0]!)).toBe(true);
		expect(shouldExecuteCommandOnSelect(commands[2]!)).toBe(true);
		expect(shouldExecuteCommandOnSelect(commands[3]!)).toBe(false);
		expect(
			shouldExecuteCommandOnSelect({
				name: "llama",
				command: "/llama",
				description: "Extension",
				source: "extension",
			}),
		).toBe(true);
		expect(
			shouldExecuteCommandOnSelect({
				name: "skill:grill",
				command: "/skill:grill",
				description: "Skill",
				source: "skill",
			}),
		).toBe(false);
	});
});
