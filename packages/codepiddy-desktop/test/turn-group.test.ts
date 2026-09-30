import { describe, expect, test } from "vitest";
import {
	formatTurnElapsed,
	groupTranscriptIntoTurns,
	splitTurnEntries,
	turnElapsedMs,
} from "../src/renderer/components/turn-group.ts";

function item(id: string, type: string, extra: Record<string, unknown> = {}) {
	return { id, type, ...extra };
}

describe("groupTranscriptIntoTurns", () => {
	test("starts a new turn at every user message", () => {
		const turns = groupTranscriptIntoTurns([
			item("u1", "user"),
			item("a1", "assistant"),
			item("t1", "tool"),
			item("u2", "user"),
			item("a2", "assistant"),
		]);
		expect(turns.map((turn) => turn.id)).toEqual(["turn-0", "turn-3"]);
		expect(turns[0]!.entries.map((entry) => entry.item.id)).toEqual(["u1", "a1", "t1"]);
		expect(turns[0]!.entries.map((entry) => entry.index)).toEqual([0, 1, 2]);
	});

	test("groups leading non-user records into their own turn", () => {
		const turns = groupTranscriptIntoTurns([item("s1", "system"), item("u1", "user")]);
		expect(turns.map((turn) => turn.id)).toEqual(["turn-0", "turn-1"]);
	});

	test("returns no turns for an empty transcript", () => {
		expect(groupTranscriptIntoTurns([])).toEqual([]);
	});

	test("derives turn time range from createdAt", () => {
		const turns = groupTranscriptIntoTurns([
			item("u1", "user", { createdAt: "2026-09-29T10:00:00.000Z" }),
			item("a1", "assistant", { createdAt: "2026-09-29T10:13:15.000Z" }),
		]);
		expect(turnElapsedMs(turns[0]!)).toBe(13 * 60 * 1000 + 15 * 1000);
	});

	test("omits elapsed time when timestamps are missing", () => {
		const turns = groupTranscriptIntoTurns([item("u1", "user")]);
		expect(turnElapsedMs(turns[0]!)).toBeNull();
	});
});

describe("formatTurnElapsed", () => {
	test("formats chinese durations", () => {
		expect(formatTurnElapsed(45_000)).toBe("45秒");
		expect(formatTurnElapsed(795_000)).toBe("13分钟15秒");
		expect(formatTurnElapsed(13 * 60_000)).toBe("13分钟");
		expect(formatTurnElapsed(2 * 3_600_000 + 3 * 60_000)).toBe("2小时3分钟");
	});
});

describe("splitTurnEntries", () => {
	test("splits user / middle process / final result", () => {
		const turns = groupTranscriptIntoTurns([
			item("u1", "user"),
			item("a1", "assistant"),
			item("t1", "tool"),
			item("a2", "assistant"),
		]);
		const { head, middle, tail } = splitTurnEntries(turns[0]!);
		expect(head.map((entry) => entry.item.id)).toEqual(["u1"]);
		expect(middle.map((entry) => entry.item.id)).toEqual(["a1", "t1"]);
		expect(tail.map((entry) => entry.item.id)).toEqual(["a2"]);
	});

	test("keeps records after the final result with the tail", () => {
		const turns = groupTranscriptIntoTurns([item("u1", "user"), item("a1", "assistant"), item("t1", "tool")]);
		const { head, middle, tail } = splitTurnEntries(turns[0]!);
		expect(head.map((entry) => entry.item.id)).toEqual(["u1"]);
		expect(middle).toEqual([]);
		expect(tail.map((entry) => entry.item.id)).toEqual(["a1", "t1"]);
	});

	test("has no final result yet, so everything after the user folds", () => {
		const turns = groupTranscriptIntoTurns([item("u1", "user"), item("t1", "tool")]);
		const { head, middle, tail } = splitTurnEntries(turns[0]!);
		expect(head.map((entry) => entry.item.id)).toEqual(["u1"]);
		expect(middle.map((entry) => entry.item.id)).toEqual(["t1"]);
		expect(tail).toEqual([]);
	});
});
