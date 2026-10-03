import type { ExtensionAPI, MessageEndEvent } from "@earendil-works/pi-coding-agent";
import { matchesGatewayConcurrencyError, type RetryPolicy, retryDelayMs } from "./retry-policy.ts";

/**
 * 目标 runtime 是更新后的 Pi（v0.99.1+，`agent_before_settle` 已存在），不做旧版本兼容。
 * 仓库里 vendored 的类型仍停在 0.85.1，所以这里用最小结构声明 + 一次窄化 cast。
 */
interface AgentBeforeSettleEvent {
	type: "agent_before_settle";
	outcome: "completed" | "aborted" | "error";
	context: { canContinue: boolean };
}

interface BoundaryResult {
	continue?: boolean;
}

type RegisterBeforeSettle = (
	event: "agent_before_settle",
	handler: (event: AgentBeforeSettleEvent) => Promise<BoundaryResult | undefined>,
) => void;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 网关并发错误的重试兜底。
 *
 * Pi 内置重试只认它自己的错误列表；网关并发限制不在里面，所以内置重试放弃后
 * 会走到 agent_before_settle。这里按 settings.json 的同一套退避参数再发起一轮，
 * 不新增 user 消息、不改 Pi core，Pi 更新后依然有效。
 */
export function installGatewayRetry(pi: ExtensionAPI, policy: RetryPolicy): void {
	if (!policy.enabled || policy.maxRetries === 0) return;

	let lastError = "";
	let attempts = 0;

	pi.on("message_end", (event: MessageEndEvent) => {
		if (event.message.role !== "assistant") return;
		if (event.message.stopReason === "error") {
			lastError = event.message.errorMessage ?? "";
			return;
		}
		lastError = "";
		attempts = 0;
	});

	pi.on("agent_start", () => {
		attempts = 0;
	});

	const onBeforeSettle = pi.on as unknown as RegisterBeforeSettle;
	onBeforeSettle("agent_before_settle", async (event) => {
		if (event.outcome !== "error" || !event.context?.canContinue) return;
		if (!lastError || !matchesGatewayConcurrencyError(lastError)) return;
		if (attempts >= policy.maxRetries) return;
		attempts += 1;
		await sleep(retryDelayMs(policy, attempts));
		return { continue: true };
	});
}
