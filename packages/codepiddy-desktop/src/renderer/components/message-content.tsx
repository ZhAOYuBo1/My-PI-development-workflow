import { memo, useMemo, useState } from "react";
import { splitTableRow, type TableAlignment, tableAlignment, tableColumnCount } from "./markdown-table.ts";

// 轻量 markdown 渲染（标题/列表/引用/行内码/围栏代码块/表格），从 App.tsx 移出供对话与文件预览共用。
function InlineText({ text }: { text: string }) {
	const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
	return (
		<>
			{tokens.map((token, index) => {
				if (token.startsWith("**") && token.endsWith("**")) {
					return <strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>;
				}
				if (token.startsWith("`") && token.endsWith("`")) {
					return (
						<code className="inline-code" key={`${index}-${token}`}>
							{token.slice(1, -1)}
						</code>
					);
				}
				return <span key={`${index}-${token}`}>{token}</span>;
			})}
		</>
	);
}

// GFM 表格：必须同时有表头行和分隔行（`|---|---|`）才算表格，解析见 markdown-table.ts。

// biome 的 noArrayIndexKey 连模板字符串里的下标也不放过，所以 key 一律由内容生成，
// 重复时加后缀（表格里两行完全相同是合法的，不能撞 key）。
function uniqueKeys(values: string[]): string[] {
	const seen = new Map<string, number>();
	return values.map((value) => {
		const count = seen.get(value) ?? 0;
		seen.set(value, count + 1);
		return count === 0 ? value : `${value} #${count}`;
	});
}

function RichTable({
	head,
	align,
	rows,
	columns,
}: {
	head: string[];
	align: TableAlignment[];
	rows: string[][];
	columns: number;
}) {
	const columnKeys = uniqueKeys(
		Array.from({ length: columns }, (_, columnIndex) => head[columnIndex] || `col${columnIndex + 1}`),
	);
	const rowKeys = uniqueKeys(rows.map((row) => row.join(" ")));
	return (
		<div className="message-table-scroll">
			<table className="message-table">
				<thead>
					<tr>
						{columnKeys.map((columnKey, columnIndex) => (
							<th key={columnKey} data-align={align[columnIndex] ?? undefined}>
								<InlineText text={head[columnIndex] ?? ""} />
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr key={rowKeys[rowIndex]}>
							{columnKeys.map((columnKey, columnIndex) => (
								<td key={columnKey} data-align={align[columnIndex] ?? undefined}>
									<InlineText text={row[columnIndex] ?? ""} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function RichText({ text }: { text: string }) {
	const lines = text.split("\n");
	const blocks: React.ReactNode[] = [];
	let paragraph: string[] = [];
	let list: { ordered: boolean; items: string[] } | null = null;
	const flushParagraph = (): void => {
		if (paragraph.length === 0) return;
		const value = paragraph.join("\n").trim();
		if (value)
			blocks.push(
				<p key={`p-${blocks.length}`}>
					<InlineText text={value} />
				</p>,
			);
		paragraph = [];
	};
	const flushList = (): void => {
		if (!list) return;
		const Tag = list.ordered ? "ol" : "ul";
		blocks.push(
			<Tag key={`list-${blocks.length}`}>
				{list.items.map((item, index) => (
					<li key={`${index}-${item}`}>
						<InlineText text={item} />
					</li>
				))}
			</Tag>,
		);
		list = null;
	};
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!;
		const head = splitTableRow(line);
		const nextLine = lines[index + 1];
		const align = nextLine === undefined ? null : tableAlignment(splitTableRow(nextLine));
		if (head && align) {
			flushParagraph();
			flushList();
			const rows: string[][] = [];
			let cursor = index + 2;
			for (; cursor < lines.length; cursor++) {
				const row = splitTableRow(lines[cursor]!);
				if (!row) break;
				rows.push(row);
			}
			blocks.push(
				<RichTable
					key={`table-${blocks.length}`}
					head={head}
					align={align}
					rows={rows}
					columns={tableColumnCount(head, rows)}
				/>,
			);
			index = cursor - 1;
			continue;
		}
		const heading = /^(#{1,4})\s+(.+)$/.exec(line);
		const unordered = /^[-*]\s+(.+)$/.exec(line);
		const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
		const quote = /^>\s?(.*)$/.exec(line);
		if (heading) {
			flushParagraph();
			flushList();
			const level = Math.min(heading[1]!.length + 2, 6);
			const Tag = `h${level}` as "h3" | "h4" | "h5" | "h6";
			blocks.push(
				<Tag key={`h-${blocks.length}`}>
					<InlineText text={heading[2] ?? ""} />
				</Tag>,
			);
		} else if (unordered || ordered) {
			flushParagraph();
			const isOrdered = Boolean(ordered);
			if (list && list.ordered !== isOrdered) flushList();
			list ??= { ordered: isOrdered, items: [] };
			list.items.push((ordered?.[1] ?? unordered?.[1] ?? "").trim());
		} else if (quote) {
			flushParagraph();
			flushList();
			blocks.push(
				<blockquote key={`q-${blocks.length}`}>
					<InlineText text={quote[1] ?? ""} />
				</blockquote>,
			);
		} else if (!line.trim()) {
			flushParagraph();
			flushList();
		} else {
			flushList();
			paragraph.push(line);
		}
	}
	flushParagraph();
	flushList();
	return <>{blocks}</>;
}

const COLLAPSE_LINE_THRESHOLD = 24;
const COLLAPSE_LENGTH_THRESHOLD = 3000;

function MessageCodeBlock({ value, language }: { value: string; language?: string }) {
	const [copied, setCopied] = useState(false);
	// 长代码默认折叠。折叠必须是真的截断（overflow:hidden + 渐隐），
	// 之前只是把滚动框从 420px 缩到 150px，内容一行没少，读起来像坏了。
	const [collapsed, setCollapsed] = useState(
		value.length > COLLAPSE_LENGTH_THRESHOLD || value.split("\n").length > COLLAPSE_LINE_THRESHOLD,
	);
	// 默认换行：桌面端代码列窄，不换行的话横向滚动条几乎每块都在。
	const [wrapped, setWrapped] = useState(true);
	async function copyCode(): Promise<void> {
		try {
			await navigator.clipboard.writeText(value.replace(/\n$/, ""));
			setCopied(true);
			setTimeout(() => setCopied(false), 1400);
		} catch {}
	}
	return (
		<div className={`message-code-block ${collapsed ? "collapsed" : ""} ${wrapped ? "wrapped" : ""}`}>
			<div className="message-code-toolbar">
				<span className="message-code-lang">{language || "code"}</span>
				<div className="message-code-actions">
					<button
						type="button"
						className={wrapped ? "is-active" : ""}
						aria-pressed={wrapped}
						onClick={() => setWrapped((current) => !current)}
					>
						换行
					</button>
					<button type="button" className={copied ? "is-active" : ""} onClick={() => void copyCode()}>
						{copied ? "已复制" : "复制"}
					</button>
					<button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed((current) => !current)}>
						{collapsed ? "展开" : "折叠"}
					</button>
				</div>
			</div>
			<pre>
				<code>{value.replace(/\n$/, "")}</code>
			</pre>
			{collapsed ? (
				<button type="button" className="message-code-expand" onClick={() => setCollapsed(false)}>
					展开全部代码
				</button>
			) : null}
		</div>
	);
}

export const MessageContent = memo(function MessageContent({ text }: { text: string }) {
	const parts = useMemo(() => {
		const result: Array<{ type: "text" | "code"; value: string; language?: string }> = [];
		const pattern = /```([^\n`]*)\n?([\s\S]*?)```/g;
		let cursor = 0;
		for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
			if (match.index > cursor) result.push({ type: "text", value: text.slice(cursor, match.index) });
			result.push({ type: "code", value: match[2] ?? "", language: match[1]?.trim() || undefined });
			cursor = match.index + match[0].length;
		}
		if (cursor < text.length) result.push({ type: "text", value: text.slice(cursor) });
		if (result.length === 0) result.push({ type: "text", value: text });
		return result;
	}, [text]);
	return (
		<>
			{parts.map((part, index) =>
				part.type === "code" ? (
					<MessageCodeBlock
						key={`${index}-${part.value.slice(0, 20)}`}
						value={part.value}
						language={part.language}
					/>
				) : (
					<div className="message-rich-text" key={`${index}-${part.value.slice(0, 20)}`}>
						<RichText text={part.value} />
					</div>
				),
			)}
		</>
	);
});
