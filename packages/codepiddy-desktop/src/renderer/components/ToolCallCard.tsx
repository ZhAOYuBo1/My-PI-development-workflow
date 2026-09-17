import { useState } from "react";

export interface ToolCallCardItem {
	id: string;
	name: string;
	args: string;
	text: string;
	status: "running" | "completed";
	isError: boolean;
}

const OUTPUT_PREVIEW_LIMIT = 6000;

function friendlyToolText(item: ToolCallCardItem): string {
	if (/TAVILY_API_KEY is not configured/i.test(item.text)) {
		return "Tavily Search 尚未配置。请在 CodePIddy 设置中保存 Tavily API Key，然后重启或重置当前 Agent。";
	}
	return item.text;
}

function Output({ item, showAll }: { item: ToolCallCardItem; showAll: boolean }) {
	const name = item.name.toLowerCase();
	const terminal = name === "bash" || name === "powershell";
	const diff = name === "edit" || name === "write";
	const friendlyText = friendlyToolText(item);
	const text =
		showAll || friendlyText.length <= OUTPUT_PREVIEW_LIMIT
			? friendlyText
			: friendlyText.slice(0, OUTPUT_PREVIEW_LIMIT);
	if (diff) {
		return (
			<pre className="diff-output">
				{text.split("\n").map((line, index) => (
					<span
						className={line.startsWith("+") ? "diff-add" : line.startsWith("-") ? "diff-remove" : "diff-context"}
						key={`${index}-${line}`}
					>
						{line || " "}
						{"\n"}
					</span>
				))}
			</pre>
		);
	}
	return <pre className={terminal ? "terminal-output" : ""}>{text}</pre>;
}

export function ToolCallCard({ item }: { item: ToolCallCardItem }) {
	const [expanded, setExpanded] = useState(false);
	const [showAll, setShowAll] = useState(false);
	const friendlyText = friendlyToolText(item);
	const truncated = friendlyText.length > OUTPUT_PREVIEW_LIMIT;
	return (
		<div className={`tool-block ${item.isError ? "error" : ""}`}>
			<button className="tool-summary" type="button" onClick={() => setExpanded((current) => !current)}>
				<strong>› {item.name}</strong>
				<span>
					{item.status === "running" ? "运行中" : item.isError ? "失败" : "完成"} {expanded ? "⌃" : "⌄"}
				</span>
			</button>
			{expanded ? (
				<div className="tool-details">
					{item.args ? (
						<>
							<small>参数</small>
							<pre>{item.args}</pre>
						</>
					) : null}
					{item.text ? (
						<>
							<small>结果</small>
							<Output item={item} showAll={showAll} />
							{truncated ? (
								<button
									className="tool-show-all"
									type="button"
									onClick={() => setShowAll((current) => !current)}
								>
									{showAll ? "收起结果" : `显示全部（${friendlyText.length.toLocaleString()} 字符）`}
								</button>
							) : null}
							{item.isError ? (
								<div className="tool-error-guidance">
									工具失败已返回给 Pi，Agent 会继续处理错误或说明替代方案。
								</div>
							) : null}
						</>
					) : null}
				</div>
			) : null}
		</div>
	);
}
