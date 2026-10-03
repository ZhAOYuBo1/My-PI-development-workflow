import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installGatewayRetry } from "./src/gateway-retry.ts";
import { readRetryPolicy } from "./src/retry-policy.ts";

export default function gatewayRetryExtension(pi: ExtensionAPI): void {
	installGatewayRetry(pi, readRetryPolicy());
}
