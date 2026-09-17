import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import extension from "../index.ts";

const originalEnvironment = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnvironment };
});

function createHandler(role: "requirement-analysis" | "coding" | "bug-fix" | "review") {
	process.env.CODEPIDDY_AGENT_ROLE = role;
	process.env.CODEPIDDY_PROJECT_ROOT = path.resolve("C:/project");
	process.env.CODEPIDDY_WORK_ITEM_DIR = path.resolve("C:/project/.codepiddy/requirements/FEAT-001");
	let handler: ((event: Record<string, unknown>, context: { cwd: string }) => Promise<unknown>) | undefined;
	extension({
		on(event: string, next: typeof handler) {
			if (event === "tool_call") handler = next;
		},
	} as never);
	if (!handler) throw new Error("Expected role guard handler");
	return handler;
}

describe("role guard extension", () => {
	test("keeps requirement analysis inside the work item documents", async () => {
		const handler = createHandler("requirement-analysis");
		await expect(
			handler(
				{ type: "tool_call", toolCallId: "1", toolName: "write", input: { path: "src/app.ts" } },
				{ cwd: "C:/project" },
			),
		).resolves.toMatchObject({ block: true });
		await expect(
			handler(
				{
					type: "tool_call",
					toolCallId: "2",
					toolName: "write",
					input: { path: ".codepiddy/requirements/FEAT-001/design.md" },
				},
				{ cwd: "C:/project" },
			),
		).resolves.toBeUndefined();
		await expect(
			handler(
				{ type: "tool_call", toolCallId: "3", toolName: "bash", input: { command: "npm test" } },
				{ cwd: "C:/project" },
			),
		).resolves.toMatchObject({ block: true });
	});

	test("allows review test edits but blocks production edits and mutating shell commands", async () => {
		const handler = createHandler("review");
		await expect(
			handler(
				{ type: "tool_call", toolCallId: "1", toolName: "edit", input: { path: "src/app.ts" } },
				{ cwd: "C:/project" },
			),
		).resolves.toMatchObject({ block: true });
		await expect(
			handler(
				{ type: "tool_call", toolCallId: "2", toolName: "write", input: { path: "test/app.test.ts" } },
				{ cwd: "C:/project" },
			),
		).resolves.toBeUndefined();
		await expect(
			handler(
				{ type: "tool_call", toolCallId: "3", toolName: "bash", input: { command: "npm test" } },
				{ cwd: "C:/project" },
			),
		).resolves.toBeUndefined();
		await expect(
			handler(
				{ type: "tool_call", toolCallId: "4", toolName: "bash", input: { command: "rm src/app.ts" } },
				{ cwd: "C:/project" },
			),
		).resolves.toMatchObject({ block: true });
	});
});
