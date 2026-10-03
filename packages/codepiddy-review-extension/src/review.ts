import { readFile } from "node:fs/promises";
import { createTwoFilesPatch, FILE_HEADERS_ONLY } from "diff";

/**
 * 单侧内容超过这个体积就不生成 review patch。
 * 客户端把变更记录持久化到 localStorage，单条 body 上限是 16 万字符，
 * 整文件重写时 patch 约等于两侧内容之和，64KB 是能安全落盘的边界。
 */
export const MAX_REVIEW_BYTES = 64 * 1024;

export type ReviewFileRead = { kind: "text"; content: string } | { kind: "missing" } | { kind: "skipped" };

export interface ReviewSnapshot {
	path: string;
	before: string | null;
}

export interface ReviewEvidence {
	patch: string;
	additions: number;
	deletions: number;
}

function errorCode(error: unknown): string | null {
	if (typeof error !== "object" || error === null || !("code" in error)) return null;
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" ? code : null;
}

/**
 * 读取 review 快照。二进制、目录、超大文件返回 skipped，让上层直接放弃这次 review，
 * 而不是把半个文件或乱码塞进 patch。
 */
export async function readReviewFile(filePath: string): Promise<ReviewFileRead> {
	try {
		const buffer = await readFile(filePath);
		if (buffer.byteLength > MAX_REVIEW_BYTES || buffer.includes(0)) return { kind: "skipped" };
		return { kind: "text", content: buffer.toString("utf8") };
	} catch (error) {
		const code = errorCode(error);
		return code === "ENOENT" || code === "EISDIR" ? { kind: "missing" } : { kind: "skipped" };
	}
}

function countPatchLines(patch: string): { additions: number; deletions: number } {
	let additions = 0;
	let deletions = 0;
	for (const line of patch.split("\n")) {
		if (line.startsWith("+++") || line.startsWith("---")) continue;
		if (line.startsWith("+")) additions += 1;
		else if (line.startsWith("-")) deletions += 1;
	}
	return { additions, deletions };
}

/** 生成标准 unified patch；内容没有变化时返回 null。 */
export function buildReviewEvidence(snapshot: ReviewSnapshot, after: string): ReviewEvidence | null {
	const before = snapshot.before ?? "";
	if (before === after) return null;
	const patch = createTwoFilesPatch(
		snapshot.before === null ? "/dev/null" : snapshot.path,
		snapshot.path,
		before,
		after,
		undefined,
		undefined,
		{ context: 3, headerOptions: FILE_HEADERS_ONLY },
	);
	if (!patch.trim()) return null;
	const { additions, deletions } = countPatchLines(patch);
	return { patch, additions, deletions };
}
