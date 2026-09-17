import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import type { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";

const WebSearchInput = Type.Object({
  query: Type.String({ minLength: 1, description: "Search query" }),
  searchDepth: Type.Optional(Type.Union([
    Type.Literal("basic"),
    Type.Literal("advanced"),
    Type.Literal("fast"),
    Type.Literal("ultra-fast"),
  ])),
  topic: Type.Optional(Type.Union([Type.Literal("general"), Type.Literal("news"), Type.Literal("finance")])),
  maxResults: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
  timeRange: Type.Optional(Type.Union([
    Type.Literal("day"),
    Type.Literal("week"),
    Type.Literal("month"),
    Type.Literal("year"),
  ])),
  startDate: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String()),
  includeDomains: Type.Optional(Type.Array(Type.String(), { maxItems: 300 })),
  excludeDomains: Type.Optional(Type.Array(Type.String(), { maxItems: 150 })),
  country: Type.Optional(Type.String()),
});

type WebSearchInputType = Static<typeof WebSearchInput>;

interface SearchToolDetails {
  structuredContent: unknown;
  isError: boolean;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resultText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.content)) return JSON.stringify(value, null, 2);
  const texts = value.content
    .filter(isRecord)
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text as string);
  return texts.length > 0 ? texts.join("\n") : JSON.stringify(value.structuredContent ?? value, null, 2);
}

export default function codePIddyTavilyToolExtension(pi: ExtensionAPI): void {
  const configuredApiKey = process.env.TAVILY_API_KEY?.trim();
  if (!configuredApiKey) return;
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let connecting: Promise<Client> | null = null;

  const connect = async (): Promise<Client> => {
    if (client) return client;
    if (connecting) return connecting;
    connecting = (async () => {
      const entry = process.env.CODEPIDDY_TAVILY_MCP_ENTRY;
      const loader = process.env.CODEPIDDY_TSX_LOADER;
      if (!entry) throw new Error("CodePIddy Tavily MCP path is not configured");
      if (!configuredApiKey) throw new Error("Tavily Search is not configured");
      transport = new StdioClientTransport({
        command: process.env.CODEPIDDY_NODE_EXECUTABLE ?? "node",
        args: loader ? ["--import", loader, entry] : [entry],
        env: { ...getDefaultEnvironment(), TAVILY_API_KEY: configuredApiKey },
        stderr: "pipe",
      });
      const nextClient = new Client({ name: "codepiddy-tavily-client", version: "0.1.0" });
      await nextClient.connect(transport);
      client = nextClient;
      return nextClient;
    })();
    try {
      return await connecting;
    } finally {
      connecting = null;
    }
  };

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search-engine queries through Tavily. Returns search results and snippets only. It cannot open, fetch, read, crawl, map, or extract a specific webpage or URL. Never use it as proof that a page was read.",
    parameters: WebSearchInput,
    async execute(_toolCallId, input: WebSearchInputType): Promise<AgentToolResult<SearchToolDetails>> {
      try {
        if (/^https?:\/\//i.test(input.query.trim())) {
          return {
            content: [{
              type: "text",
              text: "web_search is a search engine and cannot fetch or inspect a specific URL. Search using keywords and optional domain filters. Any returned text is a search-result snippet, not webpage content.",
            }],
            details: { structuredContent: null, isError: false },
          };
        }
        const mcpClient = await connect();
        const result = await mcpClient.callTool({ name: "web_search", arguments: input });
        return {
          content: [{
            type: "text",
            text: `Search results and snippets only; no webpage was fetched or read.\n\n${resultText(result)}`,
          }],
          details: { structuredContent: result.structuredContent, isError: result.isError === true },
        };
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
  });

  pi.on("session_shutdown", async () => {
    await client?.close();
    client = null;
    transport = null;
  });
}




