import type { AgentCommandOption, AgentModelSelection } from "@codepiddy/shared";

export function isExecutableSlashInvocation(
	query: string,
	commands: AgentCommandOption[],
	modelSelection?: AgentModelSelection,
): boolean {
	const trimmed = query.trim();
	const match = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(trimmed);
	if (!match) return false;
	const name = match[1] ?? "";
	const args = match[2]?.trim() ?? "";
	if (!commands.some((command) => command.name === name)) return false;
	if (!args) return true;
	if (name === "model") {
		return Boolean(modelSelection?.availableModels.some((model) => `${model.provider}/${model.id}` === args));
	}
	if (name === "thinking") return Boolean(modelSelection?.availableThinkingLevels.includes(args));
	return true;
}

export function shouldExecuteCommandOnSelect(command: AgentCommandOption): boolean {
	if (command.source === "skill" || command.source === "prompt") return false;
	return !(command.source === "builtin" && command.name === "name");
}
