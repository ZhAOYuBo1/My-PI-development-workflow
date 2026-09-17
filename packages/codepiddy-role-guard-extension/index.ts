import path from "node:path";
import type { AgentRole } from "@codepiddy/shared";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWithin(candidate: string, parent: string): boolean {
	const relative = path.relative(parent, candidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolvesToTestPath(candidate: string, projectRoot: string): boolean {
	if (!isWithin(candidate, projectRoot)) return false;
	const normalized = candidate.replaceAll("\\", "/").toLowerCase();
	const relative = path.relative(projectRoot, candidate).replaceAll("\\", "/").toLowerCase();
	const segments = relative.split("/");
	const fileName = segments.at(-1) ?? "";
	return (
		segments.some((segment) =>
			["test", "tests", "__tests__", "spec", "specs", "e2e", "fixtures", "__fixtures__", "mocks", "__mocks__", "__snapshots__"].includes(
				segment,
			),
		) ||
		/\.(test|spec)\.[^.]+$/.test(fileName) ||
		normalized.endsWith(".snap")
	);
}

function requestedPath(event: ToolCallEvent, cwd: string): string | null {
	if (event.toolName !== "edit" && event.toolName !== "write") return null;
	if (!isRecord(event.input) || typeof event.input.path !== "string") return null;
	return path.resolve(cwd, event.input.path);
}

function commandMutatesFiles(command: string): boolean {
	return /(?:^|[;&|]\s*)(?:rm|del|erase|rmdir|move|mv|copy|cp|ren|rename|truncate)\b|(?:^|\s)(?:sed\s+-i|perl\s+-pi)|(?:^|\s)(?:git\s+(?:checkout|restore|reset|clean|apply|am|commit|merge|rebase))\b|(?:^|\s)(?:set-content|add-content|out-file|remove-item|move-item|copy-item|rename-item|new-item)\b|(?:^|[^>])>{1,2}(?!=)/i.test(
		command,
	);
}

export default function codePIddyRoleGuardExtension(pi: ExtensionAPI): void {
	const role = process.env.CODEPIDDY_AGENT_ROLE as AgentRole | undefined;
	const projectRootValue = process.env.CODEPIDDY_PROJECT_ROOT;
	const workItemDirectoryValue = process.env.CODEPIDDY_WORK_ITEM_DIR;
	if (!role || !projectRootValue || !workItemDirectoryValue) return;
	const projectRoot = path.resolve(projectRootValue);
	const workItemDirectory = path.resolve(workItemDirectoryValue);

	pi.on("tool_call", async (event, context) => {
		if (role === "coding" || role === "bug-fix") return;
		if ((event.toolName === "bash" || event.toolName === "powershell") && role === "requirement-analysis") {
			return {
				block: true,
				reason: "需求分析 Agent 只能分析需求和维护当前 Work Item 文档，不能执行 Shell 命令。",
			};
		}
		if (event.toolName === "bash" || event.toolName === "powershell") {
			const command = isRecord(event.input) && typeof event.input.command === "string" ? event.input.command : "";
			if (commandMutatesFiles(command)) {
				return {
					block: true,
					reason: "Review Agent 的 Shell 命令只能用于检查和运行测试；请使用 edit/write 工具修改测试文件。",
				};
			}
			return;
		}
		const targetPath = requestedPath(event, context.cwd);
		if (!targetPath) return;
		if (isWithin(targetPath, workItemDirectory)) return;
		if (role === "requirement-analysis") {
			return {
				block: true,
				reason: `需求分析 Agent 只能修改当前 Work Item 文档目录：${workItemDirectory}`,
			};
		}
		if (role === "review" && resolvesToTestPath(targetPath, projectRoot)) return;
		return {
			block: true,
			reason: "Review Agent 只能修改当前 Work Item 文档和测试文件，禁止修改生产代码。",
		};
	});
}
