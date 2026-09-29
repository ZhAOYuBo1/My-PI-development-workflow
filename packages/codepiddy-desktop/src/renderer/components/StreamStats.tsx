import { memo, useEffect, useState } from "react";
import {
	formatFinalStats,
	formatStreamingStats,
	type FinalStreamStats,
} from "./stream-stats.ts";

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
				{formatStreamingStats(text.length, Date.now() - streamStartedAt)}
			</small>
		);
	}
	if (!streamStats) return null;
	return <small className="stream-stats">{formatFinalStats(streamStats)}</small>;
});
