import path from "node:path";
import type { ExtensionAPI, ExtensionContext, ToolCallEvent, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { buildReviewEvidence, readReviewFile, type ReviewSnapshot } from "./src/review.ts";

const MUTATION_TOOLS = new Set(["write", "edit"]);

/**
 * 参考 PI-Desktop 的 message-owned review：Write / Edit 执行前抓旧内容，
 * 执行后把 unified patch 写回 tool result 的 details。
 *
 * 走 Pi 的 tool_call / tool_result 扩展点，不改 Pi core，核心升级后依然有效。
 */
const snapshots = new Map<string, ReviewSnapshot>();

function mutationTarget(toolName: string, input: unknown, cwd: string): string | null {
	if (!MUTATION_TOOLS.has(toolName.toLowerCase())) return null;
	if (typeof input !== "object" || input === null) return null;
	const record = input as Record<string, unknown>;
	const rawPath = record.path ?? record.file_path;
	if (typeof rawPath !== "string" || rawPath.trim() === "") return null;
	return path.resolve(cwd, rawPath);
}

function mergeDetails(details: unknown): Record<string, unknown> {
	return typeof details === "object" && details !== null && !Array.isArray(details)
		? (details as Record<string, unknown>)
		: {};
}

export default function reviewSnapshotExtension(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext) => {
		const target = mutationTarget(event.toolName, event.input, ctx.cwd);
		if (!target) return;
		const read = await readReviewFile(target);
		if (read.kind === "skipped") {
			snapshots.delete(event.toolCallId);
			return;
		}
		snapshots.set(event.toolCallId, {
			path: target,
			before: read.kind === "missing" ? null : read.content,
		});
	});

	pi.on("tool_result", async (event: ToolResultEvent) => {
		const snapshot = snapshots.get(event.toolCallId);
		if (!snapshot) return;
		snapshots.delete(event.toolCallId);
		if (event.isError) return;
		const read = await readReviewFile(snapshot.path);
		if (read.kind !== "text") return;
		const evidence = buildReviewEvidence(snapshot, read.content);
		if (!evidence) return;
		return {
			details: {
				...mergeDetails(event.details),
				patch: evidence.patch,
				diff: evidence.patch,
				review: {
					version: 1,
					path: snapshot.path,
					additions: evidence.additions,
					deletions: evidence.deletions,
				},
			},
		};
	});
}
