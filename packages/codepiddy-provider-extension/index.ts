import type { ExtensionAPI, ProviderConfig } from "@earendil-works/pi-coding-agent";

interface RuntimeProviderConfig {
	id: string;
	name: string;
	baseUrl: string;
	api: "openai-completions" | "openai-responses" | "anthropic-messages" | "google-generative-ai";
	apiKeyEnv: string;
	model: {
		id: string;
		name: string;
		reasoning: boolean;
		contextWindow: number;
		maxTokens: number;
	};
}

function isRuntimeProvider(value: unknown): value is RuntimeProviderConfig {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const provider = value as Record<string, unknown>;
	const model = provider.model;
	if (typeof model !== "object" || model === null || Array.isArray(model)) return false;
	const modelRecord = model as Record<string, unknown>;
	return (
		typeof provider.id === "string" &&
		typeof provider.name === "string" &&
		typeof provider.baseUrl === "string" &&
		(provider.api === "openai-completions" ||
			provider.api === "openai-responses" ||
			provider.api === "anthropic-messages" ||
			provider.api === "google-generative-ai") &&
		typeof provider.apiKeyEnv === "string" &&
		typeof modelRecord.id === "string" &&
		typeof modelRecord.name === "string" &&
		typeof modelRecord.reasoning === "boolean" &&
		typeof modelRecord.contextWindow === "number" &&
		typeof modelRecord.maxTokens === "number"
	);
}

export default function codePIddyProviderExtension(pi: ExtensionAPI): void {
	const serialized = process.env.CODEPIDDY_CUSTOM_PROVIDERS_JSON;
	if (!serialized) return;
	let providers: unknown;
	try {
		providers = JSON.parse(serialized) as unknown;
	} catch {
		throw new Error("CODEPIDDY_CUSTOM_PROVIDERS_JSON is invalid");
	}
	if (!Array.isArray(providers)) throw new Error("CODEPIDDY_CUSTOM_PROVIDERS_JSON must be an array");
	for (const value of providers) {
		if (!isRuntimeProvider(value)) throw new Error("CodePIddy custom provider configuration is invalid");
		const config: ProviderConfig = {
			name: value.name,
			baseUrl: value.baseUrl,
			api: value.api,
			apiKey: `$${value.apiKeyEnv}`,
			models: [
				{
					id: value.model.id,
					name: value.model.name,
					reasoning: value.model.reasoning,
					input: ["text", "image"],
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					contextWindow: value.model.contextWindow,
					maxTokens: value.model.maxTokens,
					compat:
						value.api === "openai-completions"
							? { supportsDeveloperRole: false, supportsReasoningEffort: value.model.reasoning }
							: undefined,
				},
			],
		};
		pi.registerProvider(value.id, config);
	}
}
