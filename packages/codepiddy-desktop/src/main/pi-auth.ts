import { type ChildProcessWithoutNullStreams, execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { AuthClientEvent, AuthMethodType, AuthPromptRequest, AuthProviderSummary } from "@codepiddy/shared";

const execFileAsync = promisify(execFile);

interface PiAuthManagerOptions {
	helperPath: string;
	nodeExecutable: string;
	agentDir: string;
	resolvePackageDir(): Promise<string>;
	onEvent(event: AuthClientEvent): void;
}

interface ActiveLogin {
	child: ChildProcessWithoutNullStreams;
	requestId: string;
}

interface HelperPrompt {
	promptId: string;
	type: AuthPromptRequest["type"];
	message: string;
	placeholder?: string;
	options?: AuthPromptRequest["options"];
}

interface HelperEvent {
	type: string;
	message?: string;
	links?: Array<{ url: string; label?: string }>;
	url?: string;
	instructions?: string;
	userCode?: string;
	verificationUri?: string;
	intervalSeconds?: number;
	expiresInSeconds?: number;
}

export class PiAuthManager {
	private readonly options: PiAuthManagerOptions;
	private active: ActiveLogin | null = null;

	constructor(options: PiAuthManagerOptions) {
		this.options = options;
	}

	async listProviders(): Promise<AuthProviderSummary[]> {
		const result = await this.runHelper("list");
		const providers = result.find((entry) => entry.type === "providers")?.providers;
		return Array.isArray(providers) ? (providers as AuthProviderSummary[]) : [];
	}

	async startLogin(providerId: string, authType: AuthMethodType): Promise<string> {
		this.cancel();
		const requestId = randomUUID();
		const packageDir = await this.options.resolvePackageDir();
		const child = spawn(
			this.options.nodeExecutable,
			[
				this.options.helperPath,
				"--package-dir",
				packageDir,
				"--agent-dir",
				this.options.agentDir,
				"--action",
				"login",
				"--provider",
				providerId,
				"--auth-type",
				authType,
			],
			{
				env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
				stdio: ["pipe", "pipe", "pipe"],
				windowsHide: true,
			},
		);
		this.active = { child, requestId };
		let buffer = "";
		let settled = false;
		const emit = (event: AuthClientEvent): void => {
			this.options.onEvent(event);
		};
		const finish = (event: AuthClientEvent): void => {
			if (settled) return;
			settled = true;
			emit(event);
			if (this.active?.requestId === requestId) this.active = null;
		};
		child.stdout.on("data", (chunk: Buffer) => {
			buffer += chunk.toString("utf8");
			for (;;) {
				const newline = buffer.indexOf("\n");
				if (newline < 0) break;
				const line = buffer.slice(0, newline).trim();
				buffer = buffer.slice(newline + 1);
				if (!line) continue;
				let message: Record<string, unknown>;
				try {
					message = JSON.parse(line) as Record<string, unknown>;
				} catch {
					continue;
				}
				if (message.type === "prompt" && typeof message.promptId === "string") {
					const prompt = message.prompt as HelperPrompt | undefined;
					if (!prompt) continue;
					emit({
						type: "prompt",
						requestId,
						prompt: {
							promptId: message.promptId,
							type: prompt.type,
							message: prompt.message,
							...(prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
							...(prompt.options ? { options: prompt.options } : {}),
						},
					});
				} else if (message.type === "event") {
					const event = message.event as HelperEvent | undefined;
					if (!event) continue;
					if (event.type === "info" && typeof event.message === "string") {
						emit({
							type: "info",
							requestId,
							message: event.message,
							...(event.links ? { links: event.links } : {}),
						});
					} else if (event.type === "auth_url" && typeof event.url === "string") {
						emit({
							type: "auth_url",
							requestId,
							url: event.url,
							...(event.instructions ? { instructions: event.instructions } : {}),
						});
					} else if (
						event.type === "device_code" &&
						typeof event.userCode === "string" &&
						typeof event.verificationUri === "string"
					) {
						emit({
							type: "device_code",
							requestId,
							userCode: event.userCode,
							verificationUri: event.verificationUri,
							...(event.intervalSeconds ? { intervalSeconds: event.intervalSeconds } : {}),
							...(event.expiresInSeconds ? { expiresInSeconds: event.expiresInSeconds } : {}),
						});
					} else if (event.type === "progress" && typeof event.message === "string") {
						emit({ type: "progress", requestId, message: event.message });
					}
				} else if (message.type === "complete") {
					finish({ type: "complete", requestId });
				} else if (message.type === "error") {
					finish({
						type: "error",
						requestId,
						error: typeof message.error === "string" ? message.error : "登录失败",
					});
				}
			}
		});
		child.stderr.on("data", () => undefined);
		child.once("error", (error) => {
			finish({ type: "error", requestId, error: error.message });
		});
		child.once("exit", (code) => {
			if (!settled && code !== 0) finish({ type: "error", requestId, error: "登录进程异常退出" });
		});
		return requestId;
	}

	respondPrompt(input: { requestId: string; promptId: string; value?: string; cancelled?: boolean }): void {
		if (this.active?.requestId !== input.requestId) return;
		this.active.child.stdin.write(
			`${JSON.stringify({
				type: "prompt_response",
				promptId: input.promptId,
				...(input.value === undefined ? {} : { value: input.value }),
				...(input.cancelled ? { cancelled: true } : {}),
			})}\n`,
		);
	}

	cancel(): void {
		const active = this.active;
		if (!active) return;
		this.active = null;
		active.child.stdin.write(`${JSON.stringify({ type: "cancel" })}\n`);
		setTimeout(() => active.child.kill(), 250);
	}

	cancelLogin(requestId: string): void {
		if (this.active?.requestId === requestId) this.cancel();
	}

	async logout(providerId: string): Promise<void> {
		const result = await this.runHelper("logout", providerId);
		const failure = result.find((entry) => entry.type === "error");
		if (failure) throw new Error(typeof failure.error === "string" ? failure.error : "退出登录失败");
	}

	private async runHelper(
		action: "list" | "logout",
		providerId?: string,
	): Promise<Array<Record<string, unknown> & { providers?: unknown; error?: unknown }>> {
		const packageDir = await this.options.resolvePackageDir();
		const args = [
			this.options.helperPath,
			"--package-dir",
			packageDir,
			"--agent-dir",
			this.options.agentDir,
			"--action",
			action,
			...(providerId ? ["--provider", providerId] : []),
		];
		const { stdout } = await execFileAsync(this.options.nodeExecutable, args, {
			env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
			maxBuffer: 8 * 1024 * 1024,
			windowsHide: true,
		});
		return stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.flatMap((line) => {
				try {
					return [JSON.parse(line) as Record<string, unknown>];
				} catch {
					return [];
				}
			});
	}
}
