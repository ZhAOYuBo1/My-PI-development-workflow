import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { loadPiBuiltinCommands, mergePiCommands } from "../src/main/pi-builtin-commands.ts";

describe("Pi built-in slash commands", () => {
	test("reads the installed Pi version's own command table and merges RPC resources", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "codepiddy-pi-builtins-"));
		try {
			const file = path.join(root, "dist", "core", "slash-commands.js");
			await mkdir(path.dirname(file), { recursive: true });
			await writeFile(path.join(root, "package.json"), '{"type":"module"}');
			await writeFile(
				file,
				'export const BUILTIN_SLASH_COMMANDS = [{name:"model",description:"Updated model selector"},{name:"compact",description:"Updated compact"},{name:"bug",description:"TUI-only"}];',
			);
			const builtins = await loadPiBuiltinCommands(root, process.execPath);
			expect(builtins.map((item) => item.name)).toEqual(["model", "compact"]);
			expect(builtins[0]?.description).toBe("Updated model selector");
			const remote = [
				{ name: "skill:test", command: "/skill:test", description: "Skill", source: "skill" as const },
			];
			expect(mergePiCommands(remote, builtins).map((item) => item.name)).toEqual(["model", "compact", "skill:test"]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
