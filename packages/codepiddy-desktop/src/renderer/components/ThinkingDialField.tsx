import { memo, useEffect, useRef } from "react";

const CELL = 4;
const FRONT_POOL = 24;
const EMIT_SLOW_MS = 760;
const EMIT_FAST_MS = 420;
const SPEED_SLOW = 0.064;
const SPEED_FAST = 0.15;
const WIDTH_MIN = 22;
const WIDTH_MAX = 40;
const FRONT_RISE = 3.1;
const FRONT_TAIL = 0.72;
const FRONT_GAIN = 1.35;
const FRONT_DECAY_MS = 2400;
const MAX_STEP_MS = 64;
const BURST_ATTACK_MS = 160;
const BURST_MS = 1900;
const BURST_SWEEP_MS = 420;

const ACCENT = [37, 99, 235] as const;
const CREST = [147, 197, 253] as const;
const HOT = [239, 246, 255] as const;
const VIOLET = [124, 58, 237] as const;

interface Front {
	distance: number;
	amp: number;
	width: number;
	speed: number;
	alive: boolean;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function hash1(value: number): number {
	let key = Math.floor(value * 1000) % 2147483647;
	if (key < 0) key += 2147483647;
	let hash = Math.imul(key ^ 0x9e3779b9, 0x85ebca6b);
	hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
	hash ^= hash >>> 16;
	return (hash >>> 0) / 4294967296;
}

function profile(value: number): number {
	if (value <= 0) return 0;
	return FRONT_GAIN * (1 - Math.exp(-value * FRONT_RISE)) * Math.exp(-value * FRONT_TAIL);
}

function mix(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

function mixColor(from: readonly number[], to: readonly number[], amount: number): number[] {
	const t = clamp01(amount);
	return [mix(from[0]!, to[0]!, t), mix(from[1]!, to[1]!, t), mix(from[2]!, to[2]!, t)];
}

function burstEnvelope(elapsed: number): number {
	const attack = clamp01(elapsed / BURST_ATTACK_MS);
	const phase = clamp01(elapsed / BURST_MS);
	const release = 1 - phase * phase * (3 - 2 * phase);
	return attack * release;
}

export const ThinkingDialField = memo(function ThinkingDialField({
	progress,
	dragging,
	top,
}: {
	progress: number;
	dragging: boolean;
	top: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const progressRef = useRef(progress);
	const draggingRef = useRef(dragging);
	const topRef = useRef(top);
	const drawRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		progressRef.current = progress;
		drawRef.current?.();
	}, [progress]);

	useEffect(() => {
		draggingRef.current = dragging;
		drawRef.current?.();
	}, [dragging]);

	useEffect(() => {
		topRef.current = top;
		drawRef.current?.();
	}, [top]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;

		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const fronts: Front[] = Array.from({ length: FRONT_POOL }, () => ({
			distance: 0,
			amp: 0,
			width: 0,
			speed: 0,
			alive: false,
		}));
		const state = {
			lastTime: Number.NaN,
			wave: 0,
			travel: 0,
			emitter: 0,
			burstAt: Number.NEGATIVE_INFINITY,
			wasTop: topRef.current,
		};
		let width = 1;
		let height = 1;
		let frame = 0;

		const resize = () => {
			const bounds = canvas.getBoundingClientRect();
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			width = Math.max(1, bounds.width);
			height = Math.max(1, bounds.height);
			canvas.width = Math.max(1, Math.round(width * ratio));
			canvas.height = Math.max(1, Math.round(height * ratio));
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			context.imageSmoothingEnabled = false;
		};

		const draw = (time: number): void => {
			const step = Number.isFinite(state.lastTime)
				? Math.max(0, Math.min(MAX_STEP_MS, time - state.lastTime))
				: MAX_STEP_MS;
			state.lastTime = time;

			const progress = clamp01(progressRef.current);
			const isTop = topRef.current && progress >= 0.999;
			if (isTop && !state.wasTop) state.burstAt = time;
			state.wasTop = isTop;

			const sinceBurst = time - state.burstAt;
			const burst = sinceBurst >= 0 && Number.isFinite(sinceBurst) ? burstEnvelope(sinceBurst) : 0;
			const sweep = sinceBurst >= 0 && Number.isFinite(sinceBurst) ? clamp01(sinceBurst / BURST_SWEEP_MS) : 0;
			const ramp = progress ** 1.35;
			const speed = (SPEED_SLOW + (SPEED_FAST - SPEED_SLOW) * ramp) * (1 + burst * 0.28);
			const interval = (EMIT_SLOW_MS + (EMIT_FAST_MS - EMIT_SLOW_MS) * ramp) / (1 + burst * 0.5);
			const origin = progress * width;

			context.clearRect(0, 0, width, height);
			if (origin <= 0.5) return;

			const decay = Math.exp(-step / FRONT_DECAY_MS);
			const limit = origin * 1.18;
			for (const front of fronts) {
				if (!front.alive) continue;
				front.distance += front.speed * step;
				front.amp *= decay;
				if (front.distance > limit || front.amp < 0.02) front.alive = false;
			}

			state.emitter += step;
			let budget = 3;
			while (state.emitter >= interval && budget > 0) {
				state.emitter -= interval;
				budget -= 1;
				const slot = fronts.find((front) => !front.alive);
				if (!slot) break;
				const seed = hash1(((state.wave * 0.017) % 4096) + budget * 7.13);
				slot.distance = 0;
				slot.alive = true;
				slot.width = WIDTH_MIN + seed * (WIDTH_MAX - WIDTH_MIN);
				slot.speed = speed * (0.9 + seed * 0.2);
				slot.amp = (0.48 + ramp * 0.38) * (0.76 + seed * 0.44) * (1 + burst * 0.5);
			}
			if (state.emitter > interval * 4) state.emitter = interval * 4;

			const columns = Math.ceil(origin / CELL);
			const rows = Math.ceil(height / CELL);
			const center = height * 0.5;
			for (let column = 0; column < columns; column += 1) {
				const x = column * CELL;
				const distance = origin - (x + CELL * 0.5);
				let energy = 0.18 + 0.04 * Math.sin(distance * 0.052 - state.wave * 0.0012);
				for (const front of fronts) {
					if (!front.alive) continue;
					energy += front.amp * profile((front.distance - distance) / front.width);
				}
				energy /= 1 + (distance / Math.max(70, origin * 0.84)) ** 1.55 * 0.35;
				if (energy <= 0.015) continue;

				const grain = 0.86 + hash1(column * 1.9 + state.wave * 0.0003) * 0.14;
				for (let row = 0; row < rows; row += 1) {
					const y = row * CELL;
					const normalizedY = (y + CELL * 0.5 - center) / Math.max(1, center);
					const rowDepth = 1 - normalizedY * normalizedY * 0.42;
					const lit = clamp01(energy * rowDepth * grain + burst * 0.08);
					if (lit <= 0.025) continue;

					let color = mixColor(ACCENT, CREST, clamp01(lit * 1.12));
					if (ramp > 0.72) color = mixColor(color, VIOLET, (ramp - 0.72) * 0.22 * lit);
					color = mixColor(color, HOT, clamp01((lit - 0.72) * 2.6 + burst * 0.16));
					const alpha = Math.min(0.78, 0.1 + lit * 0.72 + burst * 0.08);
					context.globalAlpha = alpha;
					context.fillStyle = `rgb(${color[0]! | 0} ${color[1]! | 0} ${color[2]! | 0})`;
					context.fillRect(x, y, CELL - 1, CELL - 1);
				}
			}

			const particleCount = 3 + Math.round(ramp * 4);
			for (let index = 0; index < particleCount; index += 1) {
				const cycle = (state.travel * (0.00008 + ramp * 0.000035) + index * 0.23) % 1;
				const x = origin * (1 - cycle);
				const y = 3 + hash1(index * 4.17 + 1.3) * Math.max(1, height - 6);
				const length = 4 + hash1(index * 3.41 + 2.7) * (6 + ramp * 8);
				const alpha = Math.sin(cycle * Math.PI) * (0.18 + ramp * 0.22);
				context.globalAlpha = alpha;
				context.fillStyle = "rgb(224 236 255)";
				context.fillRect(Math.max(0, x - length), y, length, 1);
			}

			const glowRadius = Math.min(height * 2.6, 13 + ramp * 5 + burst * 18);
			const glow = context.createRadialGradient(origin, center, 0, origin, center, glowRadius);
			glow.addColorStop(0, `rgba(255,255,255,${0.2 + burst * 0.28})`);
			glow.addColorStop(0.42, `rgba(147,197,253,${0.16 + ramp * 0.08 + burst * 0.18})`);
			glow.addColorStop(1, "rgba(37,99,235,0)");
			context.globalAlpha = draggingRef.current ? 0.95 : 0.78;
			context.fillStyle = glow;
			context.fillRect(origin - glowRadius, center - glowRadius, glowRadius * 2, glowRadius * 2);

			if (burst > 0.01) {
				context.globalAlpha = burst * 0.2;
				context.fillStyle = "rgb(255 255 255)";
				context.fillRect(0, 0, origin * (1 - sweep), height);
			}

			context.globalAlpha = 1;
			state.wave += step;
			state.travel += step * (0.05 + ramp * 0.16) * (1 + burst * 0.6);
		};

		const tick = (time: number): void => {
			draw(time);
			frame = window.requestAnimationFrame(tick);
		};
		drawRef.current = () => draw(performance.now());

		const observer = new ResizeObserver(() => {
			resize();
			draw(performance.now());
		});
		observer.observe(canvas);
		resize();
		draw(performance.now());
		if (!reducedMotion) frame = window.requestAnimationFrame(tick);

		const onVisibilityChange = (): void => {
			if (document.visibilityState === "hidden") {
				if (frame !== 0) window.cancelAnimationFrame(frame);
				frame = 0;
				draw(performance.now());
				return;
			}
			if (!reducedMotion && frame === 0) frame = window.requestAnimationFrame(tick);
		};
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			if (frame !== 0) window.cancelAnimationFrame(frame);
			observer.disconnect();
			document.removeEventListener("visibilitychange", onVisibilityChange);
			drawRef.current = null;
		};
	}, []);

	return <canvas ref={canvasRef} className="thinking-dial-field" />;
});
