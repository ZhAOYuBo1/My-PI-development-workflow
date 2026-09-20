import { describe, expect, test, vi } from "vitest";
import { PiRpcProcess, rpcRequestTimeoutMs } from "../src/pi-rpc-process.ts";

type PiRpcPrivate = {
	send(command: Record<string, unknown>): Promise<Record<string, unknown>>;
};

describe("PiRpcProcess prompting", () => {
	test("forwards steering behavior while the Pi agent is already streaming", async () => {
		const rpc = new PiRpcProcess({ command: "node", args: [], cwd: process.cwd() });
		const send = vi.fn(async () => ({ type: "response", command: "prompt", success: true }));
		(rpc as unknown as PiRpcPrivate).send = send;

		await rpc.prompt("追加修复这个边界情况", "steer");

		expect(send).toHaveBeenCalledWith({
			type: "prompt",
			message: "追加修复这个边界情况",
			streamingBehavior: "steer",
		});
	});
	test("forwards image attachments without desktop-only metadata", async () => {
		const rpc = new PiRpcProcess({ command: "node", args: [], cwd: process.cwd() });
		const send = vi.fn(async () => ({ type: "response", command: "prompt", success: true }));
		(rpc as unknown as PiRpcPrivate).send = send;

		await rpc.prompt("inspect", undefined, [
			{ id: "image-1", name: "example.png", mimeType: "image/png", data: "aA==" },
		]);

		expect(send).toHaveBeenCalledWith({
			type: "prompt",
			message: "inspect",
			images: [{ type: "image", mimeType: "image/png", data: "aA==" }],
		});
	});
	test("gets and replaces the Pi scoped model list", async () => {
		const rpc = new PiRpcProcess({ command: "node", args: [], cwd: process.cwd() });
		const models = [{ provider: "openai", modelId: "gpt-5", thinkingLevel: "high" }];
		const send = vi
			.fn()
			.mockResolvedValueOnce({
				type: "response",
				command: "get_scoped_models",
				success: true,
				data: { models },
			})
			.mockResolvedValueOnce({
				type: "response",
				command: "set_scoped_models",
				success: true,
				data: { models },
			});
		(rpc as unknown as PiRpcPrivate).send = send;

		expect(await rpc.getScopedModels()).toEqual(models);
		expect(await rpc.setScopedModels(models)).toEqual(models);
		expect(send).toHaveBeenNthCalledWith(1, { type: "get_scoped_models" });
		expect(send).toHaveBeenNthCalledWith(2, { type: "set_scoped_models", models });
	});
	test("requests Pi session statistics for context usage", async () => {
		const rpc = new PiRpcProcess({ command: "node", args: [], cwd: process.cwd() });
		const send = vi.fn(async () => ({
			type: "response",
			command: "get_session_stats",
			success: true,
			data: { contextUsage: { tokens: 32000, contextWindow: 128000, percent: 25 } },
		}));
		(rpc as unknown as PiRpcPrivate).send = send;

		expect(await rpc.getSessionStats()).toEqual({
			contextUsage: { tokens: 32000, contextWindow: 128000, percent: 25 },
		});
		expect(send).toHaveBeenCalledWith({ type: "get_session_stats" });
	});
	test("uses longer timeouts for compaction and abort without slowing metadata requests", () => {
		expect(rpcRequestTimeoutMs("get_state")).toBe(30_000);
		expect(rpcRequestTimeoutMs("prompt")).toBe(90_000);
		expect(rpcRequestTimeoutMs("abort")).toBe(120_000);
		expect(rpcRequestTimeoutMs("compact")).toBe(600_000);
	});
	test("forwards session resume and import commands", async () => {
		const rpc = new PiRpcProcess({ command: "node", args: [], cwd: process.cwd() });
		const send = vi
			.fn()
			.mockResolvedValueOnce({
				type: "response",
				command: "switch_session",
				success: true,
				data: { cancelled: false },
			})
			.mockResolvedValueOnce({
				type: "response",
				command: "import_jsonl",
				success: true,
				data: { cancelled: false },
			});
		(rpc as unknown as PiRpcPrivate).send = send;

		expect(await rpc.switchSession("session.jsonl")).toEqual({ cancelled: false });
		expect(await rpc.importSession("import.jsonl")).toEqual({ cancelled: false });
		expect(send).toHaveBeenNthCalledWith(1, { type: "switch_session", sessionPath: "session.jsonl" });
		expect(send).toHaveBeenNthCalledWith(2, { type: "import_jsonl", inputPath: "import.jsonl" });
	});
});
