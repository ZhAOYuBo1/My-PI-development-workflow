import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface RetryPolicy {
	enabled: boolean;
	maxRetries: number;
	baseDelayMs: number;
	maxAgentDelayMs: number;
}

/**
 * 与外壳写进 Pi settings.json 的默认值保持一致。
 * 这些值同时被 Pi 内置重试和本扩展使用，避免两套退避参数。
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
	enabled: true,
	maxRetries: 5,
	baseDelayMs: 1000,
	maxAgentDelayMs: 5000,
};

/**
 * 网关并发限制不在 Pi 内置的可重试错误列表里，内置重试不会处理它。
 * 这个模式只用于判断“内置重试放弃后，扩展是否接管”。
 */
const GATEWAY_CONCURRENCY_PATTERN = /gateway_concurrency_limit|concurrency.?limit/i;

export function matchesGatewayConcurrencyError(message: string): boolean {
	return GATEWAY_CONCURRENCY_PATTERN.test(message);
}

export function retryDelayMs(policy: RetryPolicy, attempt: number): number {
	const delay = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
	const safeDelay = Number.isSafeInteger(delay) ? delay : Number.MAX_SAFE_INTEGER;
	return Math.min(safeDelay, policy.maxAgentDelayMs);
}

function nonNegativeInteger(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** 解析 Pi settings.json；缺字段时退回 CodePIddy 默认值。 */
export function parseRetryPolicy(settings: unknown): RetryPolicy {
	const record = typeof settings === "object" && settings !== null ? (settings as Record<string, unknown>) : {};
	const retry =
		typeof record.retry === "object" && record.retry !== null && !Array.isArray(record.retry)
			? (record.retry as Record<string, unknown>)
			: {};
	return {
		enabled: retry.enabled !== false,
		maxRetries: nonNegativeInteger(retry.maxRetries, DEFAULT_RETRY_POLICY.maxRetries),
		baseDelayMs: nonNegativeInteger(retry.baseDelayMs, DEFAULT_RETRY_POLICY.baseDelayMs),
		maxAgentDelayMs: nonNegativeInteger(retry.maxAgentDelayMs, DEFAULT_RETRY_POLICY.maxAgentDelayMs),
	};
}

/** 与 Pi 的 getAgentDir() 口径一致：PI_CODING_AGENT_DIR，缺省 ~/.pi/agent。 */
export function resolvePiAgentDir(env: NodeJS.ProcessEnv = process.env): string {
	const configured = env.PI_CODING_AGENT_DIR?.trim();
	return configured ? path.resolve(configured) : path.join(os.homedir(), ".pi", "agent");
}

export function readRetryPolicy(env: NodeJS.ProcessEnv = process.env): RetryPolicy {
	try {
		const raw = readFileSync(path.join(resolvePiAgentDir(env), "settings.json"), "utf8");
		return parseRetryPolicy(JSON.parse(raw));
	} catch {
		return { ...DEFAULT_RETRY_POLICY };
	}
}
