import { memo, useEffect, useState } from "react";
import meteorIconUrl from "../../../../../codepiddy-icons/meteor.svg?url";
import { type FinalStreamStats, formatFinalStats, formatStreamingStats } from "./stream-stats.ts";

function StreamStatsGlyph() {
	return <img className="stream-stats-glyph" src={meteorIconUrl} alt="" aria-hidden="true" draggable={false} />;
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
