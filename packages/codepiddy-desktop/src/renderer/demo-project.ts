import type { ProjectSummary } from "@codepiddy/shared";

export const demoProject: ProjectSummary = {
	id: "demo-project",
	name: "CodePIddy",
	rootPath: "C:\\Projects\\CodePIddy",
	codepiddyPath: "C:\\Projects\\CodePIddy\\.codepiddy",
	lanes: [
		{
			kind: "requirements",
			displayName: "新需求",
			workItems: [
				{
					id: "FEAT-001",
					lane: "requirements",
					title: "增加登录功能",
					description: "支持账号密码登录，并为后续第三方登录预留扩展点。",
					status: "active",
					createdAt: "2026-09-16T02:00:00.000Z",
					requirementApprovedAt: "2026-09-16T03:00:00.000Z",
					directoryPath: "C:\\Projects\\CodePIddy\\.codepiddy\\requirements\\FEAT-001",
					agentSlots: [
						{
							role: "requirement-analysis",
							displayName: "需求分析 Agent",
							status: "completed",
							currentInstanceId: "RA-001",
						},
						{ role: "coding", displayName: "Coding Agent", status: "running", currentInstanceId: "CODE-001" },
						{ role: "review", displayName: "Review Agent", status: "not-created" },
					],
				},
				{
					id: "FEAT-002",
					lane: "requirements",
					title: "导出项目报告",
					description: "导出当前项目的工作项摘要。",
					status: "active",
					createdAt: "2026-09-15T07:00:00.000Z",
					directoryPath: "C:\\Projects\\CodePIddy\\.codepiddy\\requirements\\FEAT-002",
					agentSlots: [
						{
							role: "requirement-analysis",
							displayName: "需求分析 Agent",
							status: "idle",
							currentInstanceId: "RA-002",
						},
						{
							role: "coding",
							displayName: "Coding Agent",
							status: "not-created",
							blockedReason: "需求尚未由用户批准",
						},
						{ role: "review", displayName: "Review Agent", status: "not-created" },
					],
				},
			],
		},
		{
			kind: "bugs",
			displayName: "修漏洞",
			workItems: [
				{
					id: "BUG-001",
					lane: "bugs",
					title: "项目切换后白屏",
					description: "从大型项目切换到空项目时界面偶发白屏。",
					status: "active",
					createdAt: "2026-09-16T01:00:00.000Z",
					directoryPath: "C:\\Projects\\CodePIddy\\.codepiddy\\bugs\\BUG-001",
					agentSlots: [
						{ role: "bug-fix", displayName: "Bug Fix Agent", status: "waiting", currentInstanceId: "FIX-001" },
						{ role: "review", displayName: "Review Agent", status: "not-created" },
					],
				},
			],
		},
	],
};
