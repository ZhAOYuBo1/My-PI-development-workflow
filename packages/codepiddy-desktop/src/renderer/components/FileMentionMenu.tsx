import { useEffect, useState } from "react";

function fileGlyph(file: string): string {
	const extension = file.split(".").pop()?.toLowerCase();
	if (extension === "ts" || extension === "tsx" || extension === "js" || extension === "jsx") return "TS";
	if (extension === "json" || extension === "jsonc") return "{}";
	if (extension === "md" || extension === "mdx") return "M↓";
	if (extension === "css" || extension === "scss") return "#";
	return "·/";
}

export function FileMentionMenu({
	query,
	files,
	onSelect,
}: {
	query: string;
	files: string[];
	onSelect(path: string): void;
}) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
	const match = /(?:^|\s)@([^\s]*)$/.exec(query);
	const visible = Boolean(match && files.length > 0 && dismissedQuery !== query);

	useEffect(() => {
		setSelectedIndex(0);
		if (dismissedQuery !== query) setDismissedQuery(null);
	}, [query, dismissedQuery]);

	useEffect(() => {
		if (!visible) return;
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setSelectedIndex((current) => (current + 1) % files.length);
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				setSelectedIndex((current) => (current - 1 + files.length) % files.length);
			} else if (event.key === "Enter") {
				event.preventDefault();
				const selected = files[selectedIndex];
				if (selected) onSelect(selected);
			} else if (event.key === "Escape") {
				event.preventDefault();
				setDismissedQuery(query);
			}
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [files, onSelect, query, selectedIndex, visible]);

	if (!visible) return null;
	return (
		<div className="slash-menu file-menu" role="listbox" aria-label="项目文件">
			{files.map((file, index) => (
				<button
					type="button"
					className={index === selectedIndex ? "selected" : ""}
					key={file}
					onMouseEnter={() => setSelectedIndex(index)}
					onClick={() => onSelect(file)}
					role="option"
					aria-selected={index === selectedIndex}
				>
					<strong className="file-glyph">{fileGlyph(file)}</strong>
					<span>{file}</span>
				</button>
			))}
		</div>
	);
}
