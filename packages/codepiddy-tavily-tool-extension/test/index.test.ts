import { afterEach, describe, expect, test, vi } from "vitest";
import extension from "../index.ts";

const originalKey = process.env.TAVILY_API_KEY;

afterEach(() => {
	if (originalKey === undefined) delete process.env.TAVILY_API_KEY;
	else process.env.TAVILY_API_KEY = originalKey;
});

describe("CodePIddy Tavily tool extension", () => {
	test("does not register web_search when Tavily is not configured", () => {
		delete process.env.TAVILY_API_KEY;
		const registerTool = vi.fn();
		extension({ registerTool, on: vi.fn() } as never);
		expect(registerTool).not.toHaveBeenCalled();
	});

	test("describes search-only behavior and refuses direct URL fetching", async () => {
		process.env.TAVILY_API_KEY = "test-key";
		let tool:
			| { description: string; execute: (...args: unknown[]) => Promise<{ content: Array<{ text: string }> }> }
			| undefined;
		extension({
			registerTool(value: typeof tool) {
				tool = value;
			},
			on: vi.fn(),
		} as never);
		expect(tool?.description).toContain("cannot open, fetch, read");
		const result = await tool!.execute("call", { query: "https://example.com/article" });
		expect(result.content[0]?.text).toContain("cannot fetch or inspect a specific URL");
	});
});
