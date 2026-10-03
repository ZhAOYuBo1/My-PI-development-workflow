import type { ReactNode } from "react";

export function PanelIconButton({
	label,
	active = false,
	disabled = false,
	onClick,
	children,
}: {
	label: string;
	active?: boolean;
	disabled?: boolean;
	onClick(): void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			className={`work-panel-icon-button${active ? " active" : ""}`}
			aria-label={label}
			title={label}
			aria-pressed={active || undefined}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</button>
	);
}
