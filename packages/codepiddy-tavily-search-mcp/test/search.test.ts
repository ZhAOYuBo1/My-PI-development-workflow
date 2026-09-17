import { describe, expect, test } from "vitest";
import { searchTavily } from "../src/search.ts";

describe("Tavily Search", () => {
	test("forces search-only Tavily options and normalizes results", async () => {
		let requestBody: Record<string, unknown> | null = null;
		const fetchMock: typeof fetch = async (_input, init) => {
			requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
			return new Response(
				JSON.stringify({
					query: "Pi coding agent",
					results: [{ title: "Pi", url: "https://pi.dev", content: "Agent harness", score: 0.91 }],
					response_time: "0.42",
					request_id: "request-1",
					usage: { credits: 1 },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};
		const result = await searchTavily("tvly-test", { query: "Pi coding agent", maxResults: 3 }, fetchMock);
		expect(requestBody).toMatchObject({
			query: "Pi coding agent",
			search_depth: "basic",
			max_results: 3,
			include_answer: false,
			include_raw_content: false,
			include_images: false,
			auto_parameters: false,
		});
		expect(result).toEqual({
			query: "Pi coding agent",
			results: [{ title: "Pi", url: "https://pi.dev", content: "Agent harness", score: 0.91 }],
			responseTime: 0.42,
			requestId: "request-1",
			credits: 1,
		});
	});

	test("surfaces Tavily HTTP failures", async () => {
		const fetchMock: typeof fetch = async () => new Response("quota exceeded", { status: 429 });
		await expect(searchTavily("tvly-test", { query: "test" }, fetchMock)).rejects.toThrow("429");
	});
});
