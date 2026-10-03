import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface SelectMenuOption {
	value: string;
	label: string;
	description?: string;
	disabled?: boolean;
}

export function SelectMenu({
	value,
	options,
	onChange,
	label,
	placeholder = "请选择",
	disabled = false,
}: {
	value: string;
	options: SelectMenuOption[];
	onChange(value: string): void;
	label: string;
	placeholder?: string;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const selected = options.find((option) => option.value === value);

	useEffect(() => {
		if (!open) return;
		const closeOnOutside = (event: PointerEvent): void => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				setOpen(false);
				triggerRef.current?.focus();
			}
		};
		document.addEventListener("pointerdown", closeOnOutside);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutside);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [open]);

	return (
		<div className={`select-menu${open ? " is-open" : ""}`} ref={rootRef}>
			<button
				ref={triggerRef}
				type="button"
				className="select-menu-trigger"
				aria-label={label}
				aria-haspopup="listbox"
				aria-expanded={open}
				disabled={disabled}
				onClick={() => setOpen((current) => !current)}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						setOpen(true);
					}
				}}
			>
				<span>{selected?.label ?? placeholder}</span>
				<ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
			</button>
			{open ? (
				<div className="select-menu-list" role="listbox" aria-label={label}>
					{options.length === 0 ? <div className="select-menu-empty">{placeholder}</div> : null}
					{options.map((option) => (
						<button
							key={option.value}
							type="button"
							role="option"
							aria-selected={option.value === value}
							disabled={option.disabled}
							className={`select-menu-option${option.value === value ? " is-selected" : ""}`}
							onClick={() => {
								onChange(option.value);
								setOpen(false);
								triggerRef.current?.focus();
							}}
						>
							<span>
								<strong>{option.label}</strong>
								{option.description ? <small>{option.description}</small> : null}
							</span>
							{option.value === value ? <Check size={13} strokeWidth={2} aria-hidden="true" /> : null}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
