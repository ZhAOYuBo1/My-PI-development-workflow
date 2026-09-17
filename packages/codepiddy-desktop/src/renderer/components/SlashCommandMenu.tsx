import type { AgentCommandOption, AgentModelSelection } from "@codepiddy/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isExecutableSlashInvocation, shouldExecuteCommandOnSelect } from "./slash-command-utils.ts";

interface MenuItem {
	value: string;
	label: string;
	description: string;
	source: string;
	executeOnSelect: boolean;
}

export function SlashCommandMenu({
	query,
	commands,
	loading = false,
	modelSelection,
	onSelect,
	onExecute,
}: {
	query: string;
	commands: AgentCommandOption[];
	loading?: boolean;
	modelSelection?: AgentModelSelection;
	onSelect(command: string): void;
	onExecute(command: string): void;
}) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
	const items = useMemo<MenuItem[]>(() => {
		if (!query.startsWith("/")) return [];
		const firstSpace = query.indexOf(" ");
		if (firstSpace === -1) {
			const normalized = query.slice(1).toLowerCase();
			return commands
				.filter((item) => `${item.name} ${item.description} ${item.source}`.toLowerCase().includes(normalized))
				.map((item) => ({
					value: `${item.command} `,
					label: `${item.command}${item.argumentHint ? ` ${item.argumentHint}` : ""}`,
					description: item.description || "Pi command",
					source: item.source,
					executeOnSelect: shouldExecuteCommandOnSelect(item),
				}));
		}
		const commandName = query.slice(1, firstSpace);
		const argumentPrefix = query
			.slice(firstSpace + 1)
			.trim()
			.toLowerCase();
		if (commandName === "model" && modelSelection) {
			const models = modelSelection.availableModels.filter((model) =>
				`${model.provider}/${model.id} ${model.name}`.toLowerCase().includes(argumentPrefix),
			);
			return [
				{
					value: "/model ",
					label: "/model",
					description: "打开 Pi 模型选择器",
					source: "builtin",
					executeOnSelect: true,
				},
				...models.map((model) => ({
					value: `/model ${model.provider}/${model.id} `,
					label: model.id,
					description: `${model.provider} · ${model.name}`,
					source: "model",
					executeOnSelect: true,
				})),
			];
		}
		if (commandName === "thinking" && modelSelection) {
			return [
				{
					value: "/thinking ",
					label: "/thinking",
					description: "打开 Pi Thinking Level 选择器",
					source: "builtin",
					executeOnSelect: true,
				},
				...modelSelection.availableThinkingLevels
					.filter((level) => level.toLowerCase().includes(argumentPrefix))
					.map((level) => ({
						value: `/thinking ${level} `,
						label: level,
						description: "Thinking Level",
						source: "thinking",
						executeOnSelect: true,
					})),
			];
		}
		return [];
	}, [commands, modelSelection, query]);
	const invocationIsExecutable = useMemo(
		() => isExecutableSlashInvocation(query, commands, modelSelection),
		[commands, modelSelection, query],
	);

	const visible = items.length > 0 && dismissedQuery !== query;

	useEffect(() => {
		setSelectedIndex(0);
		if (dismissedQuery !== query) setDismissedQuery(null);
	}, [query, dismissedQuery]);

	const selectItem = useCallback(
		(item: MenuItem): void => {
			setDismissedQuery(item.value);
			if (item.executeOnSelect) onExecute(item.value.trim());
			else onSelect(item.value);
		},
		[onExecute, onSelect],
	);

	useEffect(() => {
		if (!visible) return;
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setSelectedIndex((current) => (current + 1) % items.length);
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				setSelectedIndex((current) => (current - 1 + items.length) % items.length);
			} else if (event.key === "Enter") {
				if (invocationIsExecutable) return;
				event.preventDefault();
				const selected = items[selectedIndex];
				if (selected) selectItem(selected);
			} else if (event.key === "Escape") {
				event.preventDefault();
				setDismissedQuery(query);
			}
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [invocationIsExecutable, items, query, selectItem, selectedIndex, visible]);

	if (!visible) {
		if (query.startsWith("/") && loading) {
			return <div className="slash-menu slash-menu-loading">正在从 Pi 加载命令…</div>;
		}
		return null;
	}
	return (
		<div className="slash-menu" role="listbox" aria-label="Pi 斜杠命令">
			{items.map((item, index) => (
				<button
					type="button"
					className={index === selectedIndex ? "selected" : ""}
					key={`${item.value}:${index}`}
					onMouseEnter={() => setSelectedIndex(index)}
					onClick={() => selectItem(item)}
					role="option"
					aria-selected={index === selectedIndex}
				>
					<strong>{item.label}</strong>
					<span className="slash-command-description">
						<span>{item.description}</span>
						<em>{item.source}</em>
					</span>
				</button>
			))}
		</div>
	);
}
