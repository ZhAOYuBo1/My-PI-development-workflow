import { readFile } from "node:fs/promises";
import path from "node:path";

export type HandoffStage = "requirement-approval" | "feature-review" | "bug-review";

export interface HandoffDocumentIssue {
	fileName: string;
	missingSections: string[];
	detail?: string;
}

export interface HandoffValidationResult {
	ready: boolean;
	missingFiles: string[];
	issues: HandoffDocumentIssue[];
}

interface RequiredSection {
	label: string;
	aliases: string[];
}

interface DocumentSpec {
	fileName: string;
	minimumLength: number;
	sections: RequiredSection[];
	requiresTaskList?: boolean;
}

const documentSpecs: Record<HandoffStage, DocumentSpec[]> = {
	"requirement-approval": [
		{
			fileName: "requirement.md",
			minimumLength: 80,
			sections: [
				{ label: "目标", aliases: ["目标", "goal", "goals", "objective", "objectives"] },
				{ label: "功能需求", aliases: ["功能需求", "需求", "requirements", "functional requirements"] },
				{ label: "验收条件", aliases: ["验收条件", "验收标准", "acceptance", "acceptance criteria"] },
			],
		},
		{
			fileName: "design.md",
			minimumLength: 80,
			sections: [
				{ label: "设计方案", aliases: ["设计方案", "方案", "architecture", "approach", "design"] },
				{ label: "影响范围", aliases: ["影响范围", "影响", "impact", "affected areas"] },
				{ label: "验证策略", aliases: ["验证策略", "测试策略", "verification", "validation", "test strategy"] },
			],
		},
		{
			fileName: "tasks.md",
			minimumLength: 30,
			sections: [{ label: "任务拆解", aliases: ["任务拆解", "任务", "tasks", "implementation tasks"] }],
			requiresTaskList: true,
		},
	],
	"feature-review": [
		{
			fileName: "implementation.md",
			minimumLength: 80,
			sections: [
				{ label: "实现摘要", aliases: ["实现摘要", "实现内容", "summary", "implementation summary"] },
				{ label: "修改文件", aliases: ["修改文件", "修改位置", "changed files", "files changed"] },
				{ label: "测试结果", aliases: ["测试结果", "验证结果", "tests", "test results", "verification"] },
				{ label: "审查重点", aliases: ["审查重点", "review focus", "review notes"] },
			],
		},
	],
	"bug-review": [
		{
			fileName: "fix.md",
			minimumLength: 80,
			sections: [
				{ label: "根因", aliases: ["根因", "root cause", "cause"] },
				{ label: "修改文件", aliases: ["修改文件", "修改位置", "changed files", "files changed"] },
				{ label: "验证结果", aliases: ["验证结果", "测试结果", "verification", "test results"] },
				{ label: "审查重点", aliases: ["审查重点", "review focus", "review notes"] },
			],
		},
	],
};

function normalizeHeading(value: string): string {
	return value
		.toLowerCase()
		.replace(/[`*_~:：()（）[\]【】]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function markdownHeadings(content: string): string[] {
	return content.split(/\r?\n/).flatMap((line) => {
		const match = /^#{2,6}\s+(.+?)\s*$/.exec(line);
		return match?.[1] ? [normalizeHeading(match[1])] : [];
	});
}

function hasSection(headings: string[], section: RequiredSection): boolean {
	return section.aliases.some((alias) => {
		const normalizedAlias = normalizeHeading(alias);
		return headings.some(
			(heading) =>
				heading === normalizedAlias ||
				heading.startsWith(`${normalizedAlias} `) ||
				heading.includes(normalizedAlias),
		);
	});
}

async function validateDocument(
	directory: string,
	spec: DocumentSpec,
): Promise<{
	missing: boolean;
	issue?: HandoffDocumentIssue;
}> {
	let content: string;
	try {
		content = await readFile(path.join(directory, spec.fileName), "utf8");
	} catch {
		return { missing: true };
	}
	const trimmed = content.trim();
	if (!trimmed) return { missing: true };
	const headings = markdownHeadings(trimmed);
	const missingSections = spec.sections
		.filter((section) => !hasSection(headings, section))
		.map((section) => section.label);
	if (spec.requiresTaskList && !/^\s*[-*]\s+\[[ xX]\]\s+\S+/m.test(trimmed))
		missingSections.push("至少一个 Markdown 任务项");
	const detail = trimmed.length < spec.minimumLength ? `内容过短（至少 ${spec.minimumLength} 个字符）` : undefined;
	return missingSections.length > 0 || detail
		? { missing: false, issue: { fileName: spec.fileName, missingSections, ...(detail ? { detail } : {}) } }
		: { missing: false };
}

export async function validateHandoff(directory: string, stage: HandoffStage): Promise<HandoffValidationResult> {
	const checks = await Promise.all(documentSpecs[stage].map((spec) => validateDocument(directory, spec)));
	const missingFiles: string[] = [];
	const issues: HandoffDocumentIssue[] = [];
	for (const [index, check] of checks.entries()) {
		const spec = documentSpecs[stage][index];
		if (!spec) continue;
		if (check.missing) missingFiles.push(spec.fileName);
		else if (check.issue) issues.push(check.issue);
	}
	return { ready: missingFiles.length === 0 && issues.length === 0, missingFiles, issues };
}

export function handoffValidationMessage(result: HandoffValidationResult): string {
	const parts: string[] = [];
	if (result.missingFiles.length > 0) parts.push(`缺少文件：${result.missingFiles.join("、")}`);
	for (const issue of result.issues) {
		const details = [
			...(issue.missingSections.length > 0 ? [`缺少章节：${issue.missingSections.join("、")}`] : []),
			...(issue.detail ? [issue.detail] : []),
		];
		parts.push(`${issue.fileName}（${details.join("；")}）`);
	}
	return parts.join("；");
}
