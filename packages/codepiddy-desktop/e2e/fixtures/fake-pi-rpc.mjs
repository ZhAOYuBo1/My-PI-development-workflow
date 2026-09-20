import readline from "node:readline";

const models = [
	{ provider: "test", id: "model-one", name: "Model One", reasoning: true, contextWindow: 128000 },
	{ provider: "test", id: "model-two", name: "Model Two", reasoning: true, contextWindow: 128000 },
];
let model = models[0];
let thinkingLevel = "medium";
let messages = [];
let permissionRequestId = null;

function output(value) {
	process.stdout.write(`${JSON.stringify(value)}\n`);
}

function response(command, id, data) {
	output({ type: "response", command, success: true, ...(id ? { id } : {}), ...(data === undefined ? {} : { data }) });
}

function assistantMessage(text) {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		stopReason: "stop",
		usage: { input: 100, output: 40, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } },
	};
}

function finishWithText(text) {
	const message = assistantMessage(text);
	messages.push(message);
	output({ type: "message_start", message: { ...message, content: [] } });
	output({
		type: "message_update",
		message,
		assistantMessageEvent: { type: "text_delta", delta: text },
	});
	output({ type: "message_end", message });
	output({ type: "turn_end", message, toolResults: [] });
	output({ type: "agent_end", messages: [message] });
	output({ type: "agent_settled" });
}

function handlePrompt(command) {
	response("prompt", command.id);
	messages.push({ role: "user", content: [{ type: "text", text: command.message }] });
	output({ type: "agent_start" });
	output({ type: "turn_start" });
	if (command.message.includes("permission")) {
		permissionRequestId = "permission-request-1";
		output({
			type: "extension_ui_request",
			id: permissionRequestId,
			method: "confirm",
			title: "允许测试工具？",
			message: "E2E permission request",
		});
		return;
	}
	if (command.message.includes("tool-fail")) {
		output({ type: "tool_execution_start", toolCallId: "tool-fail-1", toolName: "read", args: { path: "missing.txt" } });
		const result = { content: [{ type: "text", text: "ENOENT: no such file or directory, missing.txt" }] };
		output({ type: "tool_execution_end", toolCallId: "tool-fail-1", toolName: "read", result, isError: true });
		output({ type: "agent_end", messages: [] });
		output({ type: "agent_settled" });
		return;
	}
	finishWithText("Fake Pi 已完成当前请求。");
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
	let command;
	try {
		command = JSON.parse(line);
	} catch {
		return;
	}
	const id = command.id;
	switch (command.type) {
		case "get_state":
			response("get_state", id, {
				sessionId: "e2e-session",
				sessionName: "E2E Agent",
				sessionFile: "e2e-session.jsonl",
				messageCount: messages.length,
				pendingMessageCount: permissionRequestId ? 1 : 0,
				isStreaming: permissionRequestId !== null,
				isCompacting: false,
				model,
				thinkingLevel,
			});
			break;
		case "get_messages":
			response("get_messages", id, { messages });
			break;
		case "get_commands":
			response("get_commands", id, {
				commands: [
					{ name: "model", description: "Select model", source: "builtin" },
					{ name: "thinking", description: "Set thinking", source: "builtin" },
					{ name: "compact", description: "Compact", source: "builtin" },
					{ name: "hotkeys", description: "Show hotkeys", source: "builtin" },
					{ name: "ext-test", description: "Extension test command", source: "extension" },
					{ name: "prompt-test", description: "Prompt template test", source: "prompt" },
					{ name: "skill:test", description: "Skill test", source: "skill" },
				],
			});
			break;
		case "get_available_models":
			response("get_available_models", id, { models });
			break;
		case "get_available_thinking_levels":
			response("get_available_thinking_levels", id, { levels: ["off", "low", "medium", "high"] });
			break;
		case "set_model":
			model = models.find((candidate) => candidate.provider === command.provider && candidate.id === command.modelId) ?? model;
			response("set_model", id);
			break;
		case "set_thinking_level":
			thinkingLevel = command.level;
			response("set_thinking_level", id);
			break;
		case "get_session_stats":
			response("get_session_stats", id, {
				totalMessages: messages.length,
				tokens: { input: 100, output: 40, cacheRead: 0, cacheWrite: 0, total: 140 },
				cost: 0,
				contextUsage: { tokens: 12000, contextWindow: 128000, percent: 9.375 },
			});
			break;
		case "get_tree":
			response("get_tree", id, { tree: [], leafId: null });
			break;
		case "get_fork_messages":
			response("get_fork_messages", id, { messages: [] });
			break;
		case "prompt":
			handlePrompt(command);
			break;
		case "extension_ui_response":
			if (permissionRequestId === command.id) {
				permissionRequestId = null;
				finishWithText(command.confirmed === true ? "权限已允许，Fake Pi 继续完成请求。" : "权限被拒绝，Fake Pi 已使用替代方案。");
			}
			break;
		case "abort":
			permissionRequestId = null;
			response("abort", id);
			output({ type: "agent_end", messages: [] });
			output({ type: "agent_settled" });
			break;
		case "compact":
			output({ type: "compaction_start" });
			output({ type: "compaction_end" });
			response("compact", id, { summary: "E2E compact", tokensBefore: 12000 });
			break;
		case "reload":
			response("reload", id);
			break;
		case "clone":
			response("clone", id, { cancelled: false });
			break;
		case "new_session":
			messages = [];
			response("new_session", id, { cancelled: false });
			break;
		case "get_last_assistant_text": {
			const last = [...messages].reverse().find((message) => message.role === "assistant");
			response("get_last_assistant_text", id, { text: last?.content?.[0]?.text ?? null });
			break;
		}
		default:
			response(command.type, id, {});
	}
});
