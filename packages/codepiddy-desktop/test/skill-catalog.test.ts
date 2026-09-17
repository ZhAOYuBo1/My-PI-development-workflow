import path from "node:path";
import { describe, expect, test } from "vitest";
import {
	BUILTIN_GRILL_WITH_DOCS_ID,
	DEFAULT_ROLE_SKILL_ASSIGNMENTS,
	discoverAgentSkills,
	resolveRoleSkillPaths,
} from "../src/main/skill-catalog.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("agent skill catalog", () => {
	test("assigns the bundled grill skill only to requirement analysis by default", async () => {
		const skills = await discoverAgentSkills(repositoryRoot);
		const grill = skills.find((skill) => skill.id === BUILTIN_GRILL_WITH_DOCS_ID);
		expect(grill?.name).toBe("grill-with-docs");
		expect(DEFAULT_ROLE_SKILL_ASSIGNMENTS["requirement-analysis"]).toEqual([BUILTIN_GRILL_WITH_DOCS_ID]);
		expect(DEFAULT_ROLE_SKILL_ASSIGNMENTS.coding).toEqual([]);
		expect(DEFAULT_ROLE_SKILL_ASSIGNMENTS["bug-fix"]).toEqual([]);
		expect(DEFAULT_ROLE_SKILL_ASSIGNMENTS.review).toEqual([]);

		const requirementPaths = await resolveRoleSkillPaths(
			repositoryRoot,
			repositoryRoot,
			"requirement-analysis",
			DEFAULT_ROLE_SKILL_ASSIGNMENTS,
		);
		const codingPaths = await resolveRoleSkillPaths(
			repositoryRoot,
			repositoryRoot,
			"coding",
			DEFAULT_ROLE_SKILL_ASSIGNMENTS,
		);
		expect(requirementPaths).toEqual([grill?.filePath]);
		expect(codingPaths).toEqual([]);
	});
});
