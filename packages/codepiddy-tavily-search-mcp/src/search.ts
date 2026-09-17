export const SEARCH_DEPTHS = ["basic", "advanced", "fast", "ultra-fast"] as const;
export const SEARCH_TOPICS = ["general", "news", "finance"] as const;
export const TIME_RANGES = ["day", "week", "month", "year"] as const;

export interface TavilySearchInput {
	query: string;
	searchDepth?: (typeof SEARCH_DEPTHS)[number];
	topic?: (typeof SEARCH_TOPICS)[number];
	maxResults?: number;
	timeRange?: (typeof TIME_RANGES)[number];
	startDate?: string;
	endDate?: string;
	includeDomains?: string[];
	excludeDomains?: string[];
	country?: string;
}

export interface TavilySearchItem {
	title: string;
	url: string;
	content: string;
	score?: number;
	publishedDate?: string;
}

export interface TavilySearchResult {
	query: string;
	results: TavilySearchItem[];
	responseTime?: number;
	requestId?: string;
	credits?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

function parseResult(value: unknown): TavilySearchItem | null {
	if (!isRecord(value) || typeof value.title !== "string" || typeof value.url !== "string") return null;
	const score = optionalNumber(value.score);
	return {
		title: value.title,
		url: value.url,
		content: typeof value.content === "string" ? value.content : "",
		...(score === undefined ? {} : { score }),
		...(typeof value.published_date === "string" ? { publishedDate: value.published_date } : {}),
	};
}

export async function searchTavily(
	apiKey: string,
	input: TavilySearchInput,
	fetchImplementation: typeof fetch = fetch,
): Promise<TavilySearchResult> {
	const query = input.query.trim();
	if (!query) throw new Error("Search query is required");
	const response = await fetchImplementation("https://api.tavily.com/search", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query,
			search_depth: input.searchDepth ?? "basic",
			topic: input.topic ?? "general",
			max_results: input.maxResults ?? 5,
			include_answer: false,
			include_raw_content: false,
			include_images: false,
			auto_parameters: false,
			...(input.timeRange ? { time_range: input.timeRange } : {}),
			...(input.startDate ? { start_date: input.startDate } : {}),
			...(input.endDate ? { end_date: input.endDate } : {}),
			...(input.includeDomains?.length ? { include_domains: input.includeDomains } : {}),
			...(input.excludeDomains?.length ? { exclude_domains: input.excludeDomains } : {}),
			...(input.country ? { country: input.country } : {}),
		}),
		signal: AbortSignal.timeout(30_000),
	});
	const body = await response.text();
	if (!response.ok) throw new Error(`Tavily Search failed (${response.status}): ${body.slice(0, 500)}`);
	let parsed: unknown;
	try {
		parsed = JSON.parse(body) as unknown;
	} catch {
		throw new Error("Tavily Search returned invalid JSON");
	}
	if (!isRecord(parsed)) throw new Error("Tavily Search returned an invalid response");
	const results = Array.isArray(parsed.results)
		? parsed.results.map(parseResult).filter((item): item is TavilySearchItem => item !== null)
		: [];
	const usage = isRecord(parsed.usage) ? parsed.usage : null;
	const responseTime = optionalNumber(parsed.response_time);
	const credits = usage ? optionalNumber(usage.credits) : undefined;
	return {
		query: typeof parsed.query === "string" ? parsed.query : query,
		results,
		...(responseTime === undefined ? {} : { responseTime }),
		...(typeof parsed.request_id === "string" ? { requestId: parsed.request_id } : {}),
		...(credits === undefined ? {} : { credits }),
	};
}
