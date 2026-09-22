import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { DEFAULT_KICKOFF_PROMPTS, DEFAULT_ROLE_PROFILES, ensureDefaultRoleProfiles } from "../src/role-profiles.ts";

describe("role handoff defaults", () => {
	test("points to the runtime Work Item location without assuming named handoff files", () => {
		for (const prompt of Object.values(DEFAULT_KICKOFF_PROMPTS)) {
			expect(prompt).toContain("工作目录");
			expect(prompt).not.toMatch(/proposal|spec|design|tasks|\.md/);
		}
	});

	test("updates an unchanged previous bundled profile but preserves user edits", async () => {
		const directory = await mkdtemp(path.join(tmpdir(), "codepiddy-role-profiles-"));
		try {
			await ensureDefaultRoleProfiles(directory);
			const agents = path.join(directory, "agents");
			const coding = path.join(agents, "coding.md");
			const legacy = await readFile(path.join(import.meta.dirname, "fixtures", "legacy-coding-profile.md"), "utf8");
			await writeFile(coding, legacy);
			await ensureDefaultRoleProfiles(directory);
			expect(await readFile(coding, "utf8")).toBe(DEFAULT_ROLE_PROFILES.coding);
			await writeFile(coding, "my customized profile");
			await ensureDefaultRoleProfiles(directory);
			expect(await readFile(coding, "utf8")).toBe("my customized profile");
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
