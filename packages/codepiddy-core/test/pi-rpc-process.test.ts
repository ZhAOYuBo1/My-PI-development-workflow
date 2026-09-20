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
});
