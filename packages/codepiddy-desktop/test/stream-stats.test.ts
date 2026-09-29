import { describe, expect, test } from "vitest";
import {
	estimateTokens,
	extractUsageOutput,
	formatFinalStats,
	formatStreamingStats,
	tokensPerSecond,
} from "../src/renderer/components/stream-stats.ts";

describe("stream stats estimation", () => {
	test("estimates one token per four chars", () => {
		expect(estimateTokens(400)).toBe(100);
		expect(estimateTokens(0)).toBe(0);
		expect(estimateTokens(-5)).toBe(0);
		expect(estimateTokens(3)).toBe(1);
	});

	test("computes tokens per second", () => {
		expect(tokensPerSecond(150, 6000)).toBe(25);
		expect(tokensPerSecond(150, 0)).toBe(0);
		expect(tokensPerSecond(150, -100)).toBe(0);
	});

	test("streaming readout is always marked as estimated", () => {
		const text = formatStreamingStats(400, 4000);
		expect(text).toContain("约");
		expect(text).toContain("tok/s");
		expect(text).toContain("4.0s");
	});

	test("final readout prefers provider usage without estimate marker", () => {
		const text = formatFinalStats({ tokens: 150, estimated: false, elapsedMs: 6000 });
		expect(text).toBe("⚡ 25.0 tok/s · 150 tok / 6.0s");
	});

	test("final readout marks character estimates", () => {
		const text = formatFinalStats({ tokens: 100, estimated: true, elapsedMs: 6000 });
		expect(text).toContain("约");
		expect(text).toContain("100 tok");
	});

	test("final readout without elapsed time keeps only the token count", () => {
		expect(formatFinalStats({ tokens: 150, estimated: false })).toBe("⚡ 150 tok");
		expect(formatFinalStats({ tokens: 100, estimated: true })).toBe("⚡ 约 100 tok");
	});
});

describe("usage extraction", () => {
	test("reads provider output tokens", () => {
		expect(extractUsageOutput({ usage: { input: 10, output: 150 } })).toBe(150);
	});

	test("rejects missing or invalid usage", () => {
		expect(extractUsageOutput({})).toBeNull();
		expect(extractUsageOutput(null)).toBeNull();
		expect(extractUsageOutput({ usage: { output: 0 } })).toBeNull();
		expect(extractUsageOutput({ usage: { output: "150" } })).toBeNull();
	});
});
