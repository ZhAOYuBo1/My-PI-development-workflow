import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentRole, AgentSkillSource, AgentSkillSummary, RoleSkillAssignments } from "@codepiddy/shared";

export const BUILTIN_GRILL_WITH_DOCS_ID = "builtin:grill-with-docs";

export const DEFAULT_ROLE_SKILL_ASSIGNMENTS: RoleSkillAssignments = {
	"requirement-analysis": [BUILTIN_GRILL_WITH_DOCS_ID],
	coding: [],
	"bug-fix": [],
	review: [],
};

function frontmatterValue(content: string, key: string): string | null {
	const match = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(content);
	return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? null;
}

async function readSkill(filePath: string, source: AgentSkillSource, id?: string): Promise<AgentSkillSummary | null> {
	try {
		const content = await readFile(filePath, "utf8");
		const name = frontmatterValue(content, "name");
		if (!name) return null;
		return {
			id: id ?? `path:${path.resolve(filePath)}`,
			name,
			description: frontmatterValue(content, "description") ?? "",
			filePath: path.resolve(filePath),
			source,
		};
	} catch {
		return null;
	}
}

async function discoverSkillDirectory(directory: string, source: AgentSkillSource): Promise<AgentSkillSummary[]> {
	const direct = await readSkill(path.join(directory, "SKILL.md"), source);
	const result = direct ? [direct] : [];
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const skill = await readSkill(path.join(directory, entry.name, "SKILL.md"), source);
			if (skill) result.push(skill);
		}
	} catch {}
	return result;
}

export async function discoverAgentSkills(repositoryRoot: string, projectRoot?: string): Promise<AgentSkillSummary[]> {
	const builtin =
		(await readSkill(
			path.join(repositoryRoot, "packages", "codepiddy-agent-skills", "grill-with-docs", "SKILL.md"),
			"builtin",
			BUILTIN_GRILL_WITH_DOCS_ID,
		)) ??
		(await readSkill(
			path.join(repositoryRoot, "skills", "grill-with-docs", "SKILL.md"),
			"builtin",
			BUILTIN_GRILL_WITH_DOCS_ID,
		));
	const home = os.homedir();
	const groups: Array<Promise<AgentSkillSummary[]>> = [
		discoverSkillDirectory(path.join(home, ".codex", "skills"), "codex"),
		discoverSkillDirectory(path.join(home, ".agents", "skills"), "agents"),
		discoverSkillDirectory(path.join(home, ".pi", "agent", "skills"), "pi"),
	];
	if (projectRoot) {
		groups.push(
			discoverSkillDirectory(path.join(projectRoot, ".pi", "skills"), "project"),
			discoverSkillDirectory(path.join(projectRoot, ".agents", "skills"), "project"),
		);
	}
	const discovered = (await Promise.all(groups)).flat();
	const byName = new Map<string, AgentSkillSummary>();
	if (builtin) byName.set(builtin.name, builtin);
	for (const skill of discovered) {
		if (!byName.has(skill.name)) byName.set(skill.name, skill);
	}
	return [...byName.values()].sort((left, right) => {
		if (left.source === "builtin" && right.source !== "builtin") return -1;
		if (right.source === "builtin" && left.source !== "builtin") return 1;
		return left.name.localeCompare(right.name);
	});
}

export async function resolveRoleSkillPaths(
	repositoryRoot: string,
	projectRoot: string,
	role: AgentRole,
	assignments: RoleSkillAssignments,
): Promise<string[]> {
	const catalog = await discoverAgentSkills(repositoryRoot, projectRoot);
	const byId = new Map(catalog.map((skill) => [skill.id, skill.filePath]));
	return assignments[role].flatMap((id) => {
		const filePath = byId.get(id);
		return filePath ? [filePath] : [];
	});
}
