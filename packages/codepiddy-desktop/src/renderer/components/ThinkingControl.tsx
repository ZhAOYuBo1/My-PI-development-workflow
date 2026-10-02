import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { ThinkingDialField } from "./ThinkingDialField.tsx";
import { thinkingLevelLabel } from "./thinking-levels.ts";

const DETENT_RADIUS = 0.22;
const DETENT_LAG = 0.5;

function magnetize(raw: number, count: number): number {
	if (count < 2 || !Number.isFinite(raw)) return raw;
	const anchor = Math.round(raw);
	const delta = raw - anchor;
	const distance = Math.abs(delta);
	if (distance >= DETENT_RADIUS) return raw;
	const reach = distance / DETENT_RADIUS;
	const held = DETENT_RADIUS * (reach - DETENT_LAG * reach * (1 - reach));
	return anchor + Math.sign(delta) * held;
}

function clampPosition(value: number, count: number): number {
	return Math.max(0, Math.min(Math.max(0, count - 1), value));
}

function clampIndex(value: number, count: number): number {
	return Math.max(0, Math.min(Math.max(0, count - 1), Math.round(value)));
}

export interface ThinkingControlProps {
	/**
	 * 当前模型支持的档位。由 Pi 的 get_available_thinking_levels 提供，
	 * 底层读的是模型目录里的 thinkingLevelMap —— 配了什么就是什么，这里不写死。
	 * 非推理模型只会得到 ["off"]。
	 */
	levels: readonly string[];
	/**
	 * 当前档位，严格取自 AgentModelSelection.thinkingLevel。
	 * 不做「就近吸附」：换模型后旧档位可能已经不可用，
	 * 界面上显示的档位必须和真正发给模型的一致。
	 */
	value: string;
	disabled?: boolean;
	onChange(level: string): void;
}

/**
 * 推理强度滑块（Codex 风格）。
 *
 * 收起时只是发送按钮左侧一个安静的小按钮，显示当前档位；
 * 点开才弹出滑块，thumb 跟随指针连续移动，松手才吸附到最近的有效档位。
 * 档位多的时候（最多 7 档）拖比逐个点快得多。
 */
export function ThinkingControl({ levels, value, disabled, onChange }: ThinkingControlProps) {
	const [open, setOpen] = useState(false);
	const [dragPosition, setDragPosition] = useState<number | null>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);

	const committedIndex = levels.indexOf(value);
	const hasSelection = committedIndex >= 0;
	// 只有一档时滑块没有意义（拖了也不会变），改成只作提示。
	const sliderUseful = levels.length >= 2;

	useLayoutEffect(() => {
		if (!open || !sliderUseful) return;
		const node = trackRef.current;
		if (!node) return;
		const measure = () => node.getBoundingClientRect();
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [open, sliderUseful]);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const showPosition = dragPosition ?? (hasSelection ? committedIndex : 0);
	const showIndex = clampIndex(showPosition, levels.length);

	const positionFromClientX = useCallback(
		(clientX: number): number => {
			const track = trackRef.current;
			if (!track || levels.length < 2) return 0;
			const rect = track.getBoundingClientRect();
			const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
			return ratio * (levels.length - 1);
		},
		[levels.length],
	);

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (disabled || !sliderUseful) return;
		event.preventDefault();
		draggingRef.current = true;
		event.currentTarget.setPointerCapture(event.pointerId);
		setDragPosition(magnetize(positionFromClientX(event.clientX), levels.length));
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!draggingRef.current) return;
		setDragPosition(magnetize(positionFromClientX(event.clientX), levels.length));
	};

	const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!draggingRef.current) return;
		draggingRef.current = false;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		const next = clampIndex(magnetize(positionFromClientX(event.clientX), levels.length), levels.length);
		setDragPosition(null);
		const level = levels[next];
		if (level && level !== value) onChange(level);
	};

	const step = useCallback(
		(delta: number) => {
			if (levels.length === 0) return;
			const from = hasSelection ? committedIndex : 0;
			const level = levels[(from + delta + levels.length) % levels.length];
			if (level) onChange(level);
		},
		[levels, committedIndex, hasSelection, onChange],
	);

	const onTrackKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (disabled) return;
		if (event.key === "ArrowRight" || event.key === "ArrowUp") {
			event.preventDefault();
			step(1);
		} else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
			event.preventDefault();
			step(-1);
		} else if (event.key === "Home") {
			event.preventDefault();
			const first = levels[0];
			if (first) onChange(first);
		} else if (event.key === "End") {
			event.preventDefault();
			const last = levels[levels.length - 1];
			if (last) onChange(last);
		}
	};

	if (levels.length === 0) return null;

	const lastIndex = Math.max(1, levels.length - 1);
	const percent = clampPosition(showPosition, levels.length) / lastIndex;
	const isTop = percent >= 0.999;

	return (
		<div className={`thinking-control${disabled ? " is-disabled" : ""}`}>
			<button
				ref={triggerRef}
				type="button"
				className="thinking-control-trigger"
				aria-haspopup="true"
				aria-expanded={open}
				aria-label={`思考强度：${thinkingLevelLabel(value)}`}
				disabled={disabled}
				onClick={() => setOpen((current) => !current)}
			>
				<span className="thinking-control-current">{thinkingLevelLabel(value)}</span>
				<span className={`thinking-control-caret${open ? " is-open" : ""}`} aria-hidden="true" />
			</button>

			{open ? (
				<div ref={popoverRef} className="thinking-control-popover">
					{sliderUseful ? (
						<>
							<div
								ref={trackRef}
								className={`thinking-slider${dragPosition !== null ? " is-dragging" : ""}${isTop ? " is-top" : ""}`}
								role="slider"
								tabIndex={0}
								aria-label="思考强度"
								aria-valuemin={0}
								aria-valuemax={levels.length - 1}
								aria-valuenow={showIndex}
								aria-valuetext={thinkingLevelLabel(levels[showIndex] ?? value)}
								onKeyDown={onTrackKeyDown}
								onPointerDown={onPointerDown}
								onPointerMove={onPointerMove}
								onPointerUp={endDrag}
								onPointerCancel={endDrag}
							>
								<span
									className="thinking-slider-fill"
									style={{
										width: `calc(var(--thinking-inset) + (100% - var(--thinking-thumb)) * ${percent})`,
									}}
								/>
								<ThinkingDialField progress={percent} dragging={dragPosition !== null} top={isTop} />
								<span
									className="thinking-slider-thumb"
									style={{
										left: `calc(var(--thinking-inset) + (100% - var(--thinking-thumb)) * ${percent})`,
									}}
									aria-hidden="true"
								/>
							</div>
							<div className="thinking-control-scale" aria-hidden="true">
								{levels.map((level, index) => (
									<span
										className={`thinking-control-tick${index === showIndex ? " is-current" : ""}`}
										key={level}
										style={{
											left: `calc(var(--thinking-inset) + (100% - var(--thinking-thumb)) * ${index / lastIndex})`,
										}}
									>
										{thinkingLevelLabel(level)}
									</span>
								))}
							</div>
						</>
					) : (
						<p className="thinking-control-hint">该模型只提供一个档位，无需调整。</p>
					)}

					{!hasSelection ? (
						<p className="thinking-control-note">
							当前档位 <code>{value}</code> 不在 Pi 为该模型返回的可用列表中，未自动调整。
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
