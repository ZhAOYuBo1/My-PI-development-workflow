import { memo, useEffect, useState } from "react";
import { type FinalStreamStats, formatFinalStats, formatStreamingStats } from "./stream-stats.ts";

function StreamStatsGlyph() {
	return (
		<svg
			className="stream-stats-glyph"
			viewBox="0 0 12 12"
			width="12"
			height="12"
			aria-hidden="true"
			focusable="false"
		>
			<path fill="currentColor" stroke="none" d="M8.7 1.1 3 7.1h3L4.1 11l5.1-6.3H6.9z" />
		</svg>
	);
}

export const StreamStats = memo(function StreamStats({
	status,
	text,
	streamStartedAt,
	streamStats,
}: {
	status: "streaming" | "complete" | "aborted" | "error";
	text: string;
	streamStartedAt?: number;
	streamStats?: FinalStreamStats;
}) {
	const [, setTick] = useState(0);
	useEffect(() => {
		if (status !== "streaming") return;
		const timer = setInterval(() => setTick((tick) => tick + 1), 500);
		return () => clearInterval(timer);
	}, [status]);
	if (status === "streaming") {
		if (!streamStartedAt) return null;
		return (
			<small className="stream-stats" aria-live="polite">
				<StreamStatsGlyph />
				{formatStreamingStats(text.length, Date.now() - streamStartedAt)}
			</small>
		);
	}
	if (!streamStats) return null;
	return (
		<small className="stream-stats">
			<StreamStatsGlyph />
			{formatFinalStats(streamStats)}
		</small>
	);
});
