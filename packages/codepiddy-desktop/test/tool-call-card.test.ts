import { describe, expect, test } from "vitest";
import { classifyToolFailure } from "../src/renderer/components/tool-failure-utils.ts";

describe("tool failure classification", () => {
	test("distinguishes permission, path and timeout failures", () => {
		expect(classifyToolFailure("User denied external directory access")).toBe("user-denied");
		expect(classifyToolFailure("Command blocked by policy")).toBe("policy-denied");
		expect(classifyToolFailure("ENOENT: no such file or directory")).toBe("not-found");
		expect(classifyToolFailure("Tool execution timed out after 60s")).toBe("timeout");
		expect(classifyToolFailure("Unknown tool exception")).toBe("error");
	});
});
