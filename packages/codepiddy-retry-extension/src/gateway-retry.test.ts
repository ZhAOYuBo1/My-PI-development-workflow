import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { installGatewayRetry } from "./gateway-retry.ts";
import { DEFAULT_RETRY_POLICY } from "./retry-policy.ts";

type Handler = (event: unknown) => unknown;

function createFakePi(): { pi: ExtensionAPI; handlers: Map<string, Handler> } {
	const handlers = new Map<string, Handler>();
	const pi = {
		on: (event: string, handler: Handler) => {
			handlers.set(event, handler);
		},
	} as unknown as ExtensionAPI;
	return { pi, handlers };
}

const FAST_POLICY = { ...DEFAULT_RETRY_POLICY, baseDelayMs: 1, maxAgentDelayMs: 2, maxRetries: 2 };

function assistantError(message: string): unknown {
	return { message: { role: "assistant", stopReason: "error", errorMessage: message } };
}

function boundary(outcome: "completed" | "aborted" | "error", canContinue = true): unknown {
	return { outcome, context: { canContinue } };
}

describe("installGatewayRetry", () => {
	it("forces a continuation for gateway concurrency errors until the budget is spent", async () => {
		const { pi, handlers } = createFakePi();
		installGatewayRetry(pi, FAST_POLICY);
		await handlers.get("message_end")!(assistantError("upstream: gateway_concurrency_limit"));
		expect(await handlers.get("agent_before_settle")!(boundary("error"))).toEqual({ continue: true });
		expect(await handlers.get("agent_before_settle")!(boundary("error"))).toEqual({ continue: true });
		expect(await handlers.get("agent_before_settle")!(boundary("error"))).toBeUndefined();
	});

	it("ignores errors the built-in retry already handles", async () => {
		const { pi, handlers } = createFakePi();
		installGatewayRetry(pi, FAST_POLICY);
		await handlers.get("message_end")!(assistantError("429 too many requests"));
		expect(await handlers.get("agent_before_settle")!(boundary("error"))).toBeUndefined();
	});

	it("does nothing after a successful assistant message or without continuation", async () => {
		const { pi, handlers } = createFakePi();
		installGatewayRetry(pi, FAST_POLICY);
		await handlers.get("message_end")!(assistantError("gateway_concurrency_limit"));
		await handlers.get("message_end")!({ message: { role: "assistant", stopReason: "stop" } });
		expect(await handlers.get("agent_before_settle")!(boundary("error"))).toBeUndefined();
		await handlers.get("message_end")!(assistantError("gateway_concurrency_limit"));
		expect(await handlers.get("agent_before_settle")!(boundary("error", false))).toBeUndefined();
	});
});
