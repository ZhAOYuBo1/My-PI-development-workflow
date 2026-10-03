import { describe, expect, it } from "vitest";
import {
	DEFAULT_RETRY_POLICY,
	matchesGatewayConcurrencyError,
	parseRetryPolicy,
	retryDelayMs,
} from "./retry-policy.ts";

describe("matchesGatewayConcurrencyError", () => {
	it("matches the gateway concurrency wording", () => {
		expect(matchesGatewayConcurrencyError("upstream error: gateway_concurrency_limit")).toBe(true);
		expect(matchesGatewayConcurrencyError("Gateway Concurrency Limit reached")).toBe(true);
		expect(matchesGatewayConcurrencyError("connection refused")).toBe(false);
	});
});

describe("retryDelayMs", () => {
	it("backs off exponentially and respects the cap", () => {
		const policy = { ...DEFAULT_RETRY_POLICY, baseDelayMs: 1000, maxAgentDelayMs: 5000 };
		expect(retryDelayMs(policy, 1)).toBe(1000);
		expect(retryDelayMs(policy, 2)).toBe(2000);
		expect(retryDelayMs(policy, 3)).toBe(4000);
		expect(retryDelayMs(policy, 4)).toBe(5000);
	});
});

describe("parseRetryPolicy", () => {
	it("reads explicit settings and fills missing fields with defaults", () => {
		expect(parseRetryPolicy({ retry: { maxRetries: 2 } })).toEqual({
			...DEFAULT_RETRY_POLICY,
			maxRetries: 2,
		});
	});

	it("honours disabled retries and falls back on invalid values", () => {
		expect(parseRetryPolicy({ retry: { enabled: false, maxRetries: "5" } })).toEqual({
			...DEFAULT_RETRY_POLICY,
			enabled: false,
		});
	});
});
