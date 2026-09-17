#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { searchTavily } from "./search.ts";

const apiKey = process.env.TAVILY_API_KEY?.trim();
if (!apiKey) {
	process.stderr.write("TAVILY_API_KEY is required\n");
	process.exit(1);
}

const server = new McpServer({ name: "codepiddy-tavily-search", version: "0.1.0" });

server.registerTool(
	"web_search",
	{
		title: "Web Search",
		description:
			"Search-engine queries with Tavily. Returns ranked results and snippets only. It cannot open, fetch, read, crawl, map, or extract a specific webpage or URL.",
		inputSchema: z.object({
			query: z.string().min(1).describe("Search query"),
			searchDepth: z.enum(["basic", "advanced", "fast", "ultra-fast"]).default("basic"),
			topic: z.enum(["general", "news", "finance"]).default("general"),
			maxResults: z.number().int().min(1).max(20).default(5),
			timeRange: z.enum(["day", "week", "month", "year"]).optional(),
			startDate: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/)
				.optional(),
			endDate: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/)
				.optional(),
			includeDomains: z.array(z.string()).max(300).optional(),
			excludeDomains: z.array(z.string()).max(150).optional(),
			country: z.string().optional(),
		}),
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: true,
		},
	},
	async (input) => {
		const result = await searchTavily(apiKey, input);
		return {
			content: [
				{
					type: "text",
					text: `Search results and snippets only; no webpage was fetched or read.\n\n${JSON.stringify(result, null, 2)}`,
				},
			],
			structuredContent: result,
		};
	},
);

const transport = new StdioServerTransport();
await server.connect(transport);
