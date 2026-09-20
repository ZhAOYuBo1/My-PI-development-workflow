import path from "node:path";
import { describe, expect, test } from "vitest";
import {
	BUILTIN_GRILL_WITH_DOCS_ID,
	BUILTIN_OPEN_CODE_REVIEW_ID,
	BUILTIN_OPENSPEC_APPLY_ID,
	BUILTIN_OPENSPEC_ARCHIVE_ID,
	BUILTIN_OPENSPEC_EXPLORE_ID,
	BUILTIN_OPENSPEC_PROPOSE_ID,
	BUILTIN_OPENSPEC_SYNC_ID,
	BUILTIN_OPENSPEC_UPDATE_ID,
	DEFAULT_ROLE_SKILL_ASSIGNMENTS,
	discoverAgentSkills,
	resolveRoleSkillPaths,
} from "../src/main/skill-catalog.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..", "..");

const bundledIds = [
	BUILTIN_GRILL_WITH_DOCS_ID,
	BUILTIN_OPEN_CODE_REVIEW_ID,
	BUILTIN_OPENSPEC_APPLY_ID,
	BUILTIN_OPENSPEC_ARCHIVE_ID,
	BUILTIN_OPENSPEC_EXPLORE_ID,
	BUILTIN_OPENSPEC_PROPOSE_ID,
	BUILTIN_OPENSPEC_SYNC_ID,
	BUILTIN_OPENSPEC_UPDATE_ID,
];

describe("agent skill catalog", () => {
	test("discovers every bundled CodePIddy skill with stable ids", async () => {
		const skills = await discoverAgentSkills(repositoryRoot);
		const ids = new Set(skills.map((skill) => skill.id));
		for (const id of bundledIds) expect(ids.has(id), `missing ${id}`).toBe(true);
		expect(skills.find((skill) => skill.id === BUILTIN_GRILL_WITH_DOCS_ID)?.name).toBe("grill-with-docs");
		expect(skills.find((skill) => skill.id === BUILTIN_OPEN_CODE_REVIEW_ID)?.name).toBe("open-code-review");
	});

	test("assigns Grill and OpenSpec by role and enables open-code-review for Review", async () => {
		expect(DEFAULT_ROLE_SKILL_ASSIGNMENTS["requirement-analysis"]).toEqual([
			BUILTIN_GRILL_WITH_DOCS_ID,
			BUILTIN_OPENSPEC_EXPLORE_ID,
			BUILTIN_OPENSPEC_PROPOSE_ID,
			BUILTIN_OPENSPEC_UPDATE_ID,
		]);
		expect(DEFAULT_ROLE_SKILL_ASSIGNMENTS.coding).toEqual([BUILTIN_OPENSPEC_APPLY_ID, BUILTIN_OPENSPEC_SYNC_ID]);
		expect(DEFAULT_ROLE_SKILL_ASSIGNMENTS.review).toEqual([BUILTIN_OPEN_CODE_REVIEW_ID]);

		const requirementPaths = await resolveRoleSkillPaths(
			repositoryRoot,
			repositoryRoot,
			"requirement-analysis",
			DEFAULT_ROLE_SKILL_ASSIGNMENTS,
		);
		const reviewPaths = await resolveRoleSkillPaths(
			repositoryRoot,
			repositoryRoot,
			"review",
			DEFAULT_ROLE_SKILL_ASSIGNMENTS,
		);
		expect(requirementPaths).toHaveLength(4);
		expect(reviewPaths).toHaveLength(1);
		expect(reviewPaths[0]).toContain("open-code-review");
	});
});
