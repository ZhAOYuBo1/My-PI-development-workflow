import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
	AgentRole,
	AgentSlotSummary,
	ApproveRequirementInput,
	ArchiveWorkItemInput,
	CreateWorkItemInput,
	LaneKind,
	LaneSummary,
	ProjectSummary,
	RenameWorkItemInput,
	WorkItemStatus,
	WorkItemSummary,
} from "@codepiddy/shared";
import { DEFAULT_KICKOFF_PROMPTS, ensureDefaultRoleProfiles } from "./role-profiles.ts";

const CODEPIDDY_DIRECTORY_NAME = ".codepiddy";
const PROJECT_MANIFEST_NAME = "manifest.json";
const WORK_ITEM_MANIFEST_NAME = "work-item.json";
const WORK_ITEM_DOCUMENT_NAME = "work-item.md";
const PERMISSIONS_FILE_NAME = "permissions.jsonc";

interface ProjectManifest {
	schemaVersion: 1;
	projectId: string;
	name: string;
	createdAt: string;
}

interface WorkItemManifest {
	schemaVersion: 1;
	id: string;
	lane: LaneKind;
	title: string;
	description: string;
	status: WorkItemStatus;
	createdAt: string;
	archivedAt?: string;
	requirementApprovedAt?: string;
}

const roleDisplayNames: Record<AgentRole, string> = {
	"requirement-analysis": "需求分析 Agent",
	coding: "Coding Agent",
	"bug-fix": "Bug Fix Agent",
	review: "Review Agent",
};

function rolesForLane(lane: LaneKind): AgentRole[] {
	return lane === "requirements" ? ["requirement-analysis", "coding", "review"] : ["bug-fix", "review"];
}

const workflowDocuments: Record<LaneKind, readonly string[]> = {
	requirements: ["requirement.md", "design.md", "tasks.md", "implementation.md", "review.md"],
	bugs: ["fix.md", "review.md"],
};

async function removeLegacySeedDocument(directory: string, manifest: WorkItemManifest): Promise<void> {
	const documentName = manifest.lane === "requirements" ? "requirement.md" : "bug.md";
	const legacyContent = `# ${manifest.title}\n\n${manifest.description || "请在这里补充初始描述。"}\n`;
	const filePath = path.join(directory, documentName);
	try {
		if ((await readFile(filePath, "utf8")) === legacyContent) await rm(filePath, { force: true });
	} catch (error) {
		if (!isObject(error) || error.code !== "ENOENT") throw error;
	}
}

async function removeEmptyWorkflowDocuments(directory: string, lane: LaneKind): Promise<void> {
	await Promise.all(
		workflowDocuments[lane].map(async (documentName) => {
			const filePath = path.join(directory, documentName);
			try {
				if ((await readFile(filePath, "utf8")).trim().length === 0) await rm(filePath, { force: true });
			} catch (error) {
				if (!isObject(error) || error.code !== "ENOENT") throw error;
			}
		}),
	);
}

async function fileHasContent(filePath: string): Promise<boolean> {
	try {
		return (await readFile(filePath, "utf8")).trim().length > 0;
	} catch {
		return false;
	}
}

async function createAgentSlots(
	lane: LaneKind,
	directory: string,
	manifest: WorkItemManifest,
): Promise<AgentSlotSummary[]> {
	const reviewInputReady = await fileHasContent(
		path.join(directory, lane === "requirements" ? "implementation.md" : "fix.md"),
	);
	return rolesForLane(lane).map((role) => {
		let blockedReason: string | undefined;
		if (role === "coding" && !manifest.requirementApprovedAt) {
			blockedReason = "需求文档尚未由用户批准";
		} else if (role === "review" && !reviewInputReady) {
			blockedReason =
				lane === "requirements" ? "等待 Coding Agent 生成 implementation.md" : "等待 Bug Fix Agent 生成 fix.md";
		}
		return {
			role,
			displayName: roleDisplayNames[role],
			status: "not-created" as const,
			kickoffPrompt: DEFAULT_KICKOFF_PROMPTS[role],
			...(blockedReason ? { blockedReason } : {}),
		};
	});
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== "string") throw new Error(`Invalid ${field}`);
	return value;
}

function parseProjectManifest(value: unknown): ProjectManifest {
	if (!isObject(value) || value.schemaVersion !== 1) throw new Error("Invalid CodePIddy project manifest");
	return {
		schemaVersion: 1,
		projectId: requireString(value.projectId, "projectId"),
		name: requireString(value.name, "name"),
		createdAt: requireString(value.createdAt, "createdAt"),
	};
}

function parseLane(value: unknown): LaneKind {
	if (value === "requirements" || value === "bugs") return value;
	throw new Error("Invalid work item lane");
}

function parseStatus(value: unknown): WorkItemStatus {
	if (value === "active" || value === "archived") return value;
	throw new Error("Invalid work item status");
}

function parseWorkItemManifest(value: unknown): WorkItemManifest {
	if (!isObject(value) || value.schemaVersion !== 1) throw new Error("Invalid CodePIddy work item manifest");
	const archivedAt = value.archivedAt;
	if (archivedAt !== undefined && typeof archivedAt !== "string") throw new Error("Invalid archivedAt");
	const requirementApprovedAt = value.requirementApprovedAt;
	if (requirementApprovedAt !== undefined && typeof requirementApprovedAt !== "string") {
		throw new Error("Invalid requirementApprovedAt");
	}
	return {
		schemaVersion: 1,
		id: requireString(value.id, "id"),
		lane: parseLane(value.lane),
		title: requireString(value.title, "title"),
		description: requireString(value.description, "description"),
		status: parseStatus(value.status),
		createdAt: requireString(value.createdAt, "createdAt"),
		...(archivedAt === undefined ? {} : { archivedAt }),
		...(requirementApprovedAt === undefined ? {} : { requirementApprovedAt }),
	};
}

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
	const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
	await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	await rename(temporaryPath, filePath);
}

function codepiddyPath(projectRoot: string): string {
	return path.join(path.resolve(projectRoot), CODEPIDDY_DIRECTORY_NAME);
}

function lanePath(projectRoot: string, lane: LaneKind): string {
	return path.join(codepiddyPath(projectRoot), lane);
}

async function ensureDefaultPermissions(dataPath: string): Promise<void> {
	const filePath = path.join(dataPath, PERMISSIONS_FILE_NAME);
	const content = {
		defaultPolicy: { tools: "ask", bash: "ask", mcp: "ask", skills: "ask", special: "ask" },
		tools: { read: "allow", grep: "allow", find: "allow", ls: "allow", write: "ask", edit: "ask" },
		bash: { "git status*": "allow", "git diff*": "allow", "git log*": "allow", "git show*": "allow", "*": "ask" },
		mcp: {},
		skills: { "*": "ask" },
		special: { external_directory: "ask" },
	};
	try {
		await writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
	} catch (error) {
		if (!isObject(error) || error.code !== "EEXIST") throw error;
	}
}

async function ensureProjectManifest(projectRoot: string): Promise<ProjectManifest> {
	const rootPath = path.resolve(projectRoot);
	const dataPath = codepiddyPath(rootPath);
	const manifestPath = path.join(dataPath, PROJECT_MANIFEST_NAME);
	await mkdir(path.join(dataPath, "requirements"), { recursive: true });
	await mkdir(path.join(dataPath, "bugs"), { recursive: true });
	await mkdir(path.join(dataPath, "agents"), { recursive: true });
	await ensureDefaultPermissions(dataPath);
	await ensureDefaultRoleProfiles(dataPath);
	try {
		return parseProjectManifest(await readJson(manifestPath));
	} catch (error) {
		if (!(error instanceof Error) || !error.message.includes("ENOENT")) {
			try {
				await readFile(manifestPath, "utf8");
			} catch (readError) {
				if (!(readError instanceof Error) || !readError.message.includes("ENOENT")) throw error;
			}
		}
		const manifest: ProjectManifest = {
			schemaVersion: 1,
			projectId: randomUUID(),
			name: path.basename(rootPath),
			createdAt: new Date().toISOString(),
		};
		await writeJsonAtomic(manifestPath, manifest);
		return manifest;
	}
}

async function listWorkItems(projectRoot: string, lane: LaneKind): Promise<WorkItemSummary[]> {
	const directory = lanePath(projectRoot, lane);
	const entries = await readdir(directory, { withFileTypes: true });
	const items: WorkItemSummary[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const itemDirectory = path.join(directory, entry.name);
		try {
			const manifest = parseWorkItemManifest(await readJson(path.join(itemDirectory, WORK_ITEM_MANIFEST_NAME)));
			if (manifest.lane !== lane) continue;
			await removeLegacySeedDocument(itemDirectory, manifest);
			await removeEmptyWorkflowDocuments(itemDirectory, lane);
			items.push({
				id: manifest.id,
				lane,
				title: manifest.title,
				description: manifest.description,
				status: manifest.status,
				createdAt: manifest.createdAt,
				...(manifest.archivedAt === undefined ? {} : { archivedAt: manifest.archivedAt }),
				...(manifest.requirementApprovedAt === undefined
					? {}
					: { requirementApprovedAt: manifest.requirementApprovedAt }),
				directoryPath: itemDirectory,
				agentSlots: await createAgentSlots(lane, itemDirectory, manifest),
			});
		} catch {
			// Ignore directories that are not valid CodePIddy work items.
		}
	}
	return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function laneSummary(kind: LaneKind, workItems: WorkItemSummary[]): LaneSummary {
	return {
		kind,
		displayName: kind === "requirements" ? "新需求" : "修漏洞",
		workItems,
	};
}

export async function openProject(projectRoot: string): Promise<ProjectSummary> {
	const rootPath = path.resolve(projectRoot);
	const manifest = await ensureProjectManifest(rootPath);
	const [requirements, bugs] = await Promise.all([
		listWorkItems(rootPath, "requirements"),
		listWorkItems(rootPath, "bugs"),
	]);
	return {
		id: manifest.projectId,
		name: manifest.name,
		rootPath,
		codepiddyPath: codepiddyPath(rootPath),
		lanes: [laneSummary("requirements", requirements), laneSummary("bugs", bugs)],
	};
}

async function nextWorkItemId(projectRoot: string, lane: LaneKind): Promise<string> {
	const prefix = lane === "requirements" ? "FEAT" : "BUG";
	const entries = await readdir(lanePath(projectRoot, lane), { withFileTypes: true });
	let maximum = 0;
	const pattern = new RegExp(`^${prefix}-(\\d+)$`);
	for (const entry of entries) {
		const match = pattern.exec(entry.name);
		if (entry.isDirectory() && match?.[1]) maximum = Math.max(maximum, Number.parseInt(match[1], 10));
	}
	return `${prefix}-${String(maximum + 1).padStart(3, "0")}`;
}

function workItemMarkdown(manifest: WorkItemManifest): string {
	return `---\nid: ${manifest.id}\ntype: ${manifest.lane === "requirements" ? "feature" : "bugfix"}\ntitle: ${manifest.title}\nstatus: ${manifest.status}\ncreatedAt: ${manifest.createdAt}\n${manifest.archivedAt ? `archivedAt: ${manifest.archivedAt}\n` : ""}---\n\n${manifest.description}\n`;
}

export async function createWorkItem(input: CreateWorkItemInput): Promise<ProjectSummary> {
	const projectRoot = path.resolve(input.projectRoot);
	await ensureProjectManifest(projectRoot);
	const title = input.title.trim();
	if (!title) throw new Error("Work item title is required");
	const id = await nextWorkItemId(projectRoot, input.lane);
	const directory = path.join(lanePath(projectRoot, input.lane), id);
	await mkdir(directory, { recursive: false });
	const manifest: WorkItemManifest = {
		schemaVersion: 1,
		id,
		lane: input.lane,
		title,
		description: input.description.trim(),
		status: "active",
		createdAt: new Date().toISOString(),
	};
	await writeJsonAtomic(path.join(directory, WORK_ITEM_MANIFEST_NAME), manifest);
	await writeFile(path.join(directory, WORK_ITEM_DOCUMENT_NAME), workItemMarkdown(manifest), "utf8");
	return openProject(projectRoot);
}

export async function approveRequirement(input: ApproveRequirementInput): Promise<ProjectSummary> {
	const projectRoot = path.resolve(input.projectRoot);
	const directory = path.join(lanePath(projectRoot, "requirements"), input.workItemId);
	const manifestPath = path.join(directory, WORK_ITEM_MANIFEST_NAME);
	const manifest = parseWorkItemManifest(await readJson(manifestPath));
	if (manifest.id !== input.workItemId || manifest.lane !== "requirements") {
		throw new Error("Work item identity mismatch");
	}
	const requiredDocuments = ["requirement.md", "design.md", "tasks.md"];
	const missing: string[] = [];
	for (const documentName of requiredDocuments) {
		if (!(await fileHasContent(path.join(directory, documentName)))) missing.push(documentName);
	}
	if (missing.length > 0) {
		throw new Error(`批准需求前必须完成交接文档：${missing.join("、")}`);
	}
	const next: WorkItemManifest = {
		...manifest,
		requirementApprovedAt: new Date().toISOString(),
	};
	await writeJsonAtomic(manifestPath, next);
	await writeFile(path.join(directory, WORK_ITEM_DOCUMENT_NAME), workItemMarkdown(next), "utf8");
	return openProject(projectRoot);
}

async function setArchived(input: ArchiveWorkItemInput, archived: boolean): Promise<ProjectSummary> {
	const projectRoot = path.resolve(input.projectRoot);
	const directory = path.join(lanePath(projectRoot, input.lane), input.workItemId);
	const manifestPath = path.join(directory, WORK_ITEM_MANIFEST_NAME);
	const manifest = parseWorkItemManifest(await readJson(manifestPath));
	if (manifest.id !== input.workItemId || manifest.lane !== input.lane) throw new Error("Work item identity mismatch");
	const next: WorkItemManifest = {
		...manifest,
		status: archived ? "archived" : "active",
		...(archived ? { archivedAt: new Date().toISOString() } : {}),
	};
	if (!archived) delete next.archivedAt;
	await writeJsonAtomic(manifestPath, next);
	await writeFile(path.join(directory, WORK_ITEM_DOCUMENT_NAME), workItemMarkdown(next), "utf8");
	return openProject(projectRoot);
}

export async function archiveWorkItem(input: ArchiveWorkItemInput): Promise<ProjectSummary> {
	return setArchived(input, true);
}

export async function restoreWorkItem(input: ArchiveWorkItemInput): Promise<ProjectSummary> {
	return setArchived(input, false);
}

export async function renameWorkItem(input: RenameWorkItemInput): Promise<ProjectSummary> {
	const title = input.title.trim();
	if (!title) throw new Error("Work item title is required");
	const projectRoot = path.resolve(input.projectRoot);
	const directory = path.join(lanePath(projectRoot, input.lane), input.workItemId);
	const manifestPath = path.join(directory, WORK_ITEM_MANIFEST_NAME);
	const manifest = parseWorkItemManifest(await readJson(manifestPath));
	if (manifest.id !== input.workItemId || manifest.lane !== input.lane) throw new Error("Work item identity mismatch");
	const next = { ...manifest, title };
	await writeJsonAtomic(manifestPath, next);
	await writeFile(path.join(directory, WORK_ITEM_DOCUMENT_NAME), workItemMarkdown(next), "utf8");
	return openProject(projectRoot);
}

export async function deleteWorkItem(input: ArchiveWorkItemInput): Promise<ProjectSummary> {
	const projectRoot = path.resolve(input.projectRoot);
	const directory = path.join(lanePath(projectRoot, input.lane), input.workItemId);
	const manifest = parseWorkItemManifest(await readJson(path.join(directory, WORK_ITEM_MANIFEST_NAME)));
	if (manifest.id !== input.workItemId || manifest.lane !== input.lane) throw new Error("Work item identity mismatch");
	await rm(directory, { recursive: true, force: false });
	return openProject(projectRoot);
}
