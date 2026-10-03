import { describe, expect, it } from "vitest";
import { buildReviewEvidence } from "./review.ts";

const POEM = [
	"《金缕衣》",
	"唐·佚名",
	"",
	"劝君莫惜金缕衣，劝君惜取少年时。",
	"花开堪折直须折，莫待无花空折枝。",
	"",
].join("\n");

const MARKDOWN = [
	"# 金缕衣",
	"",
	"- 朝代：唐",
	"- 作者：佚名",
	"",
	"## 正文",
	"",
	"劝君莫惜金缕衣，劝君惜取少年时。",
	"花开堪折直须折，莫待无花空折枝。",
	"",
].join("\n");

describe("buildReviewEvidence", () => {
	it("marks a brand-new file as additions only", () => {
		const evidence = buildReviewEvidence({ path: "a.txt", before: null }, "# 金缕衣\n\n- 朝代：唐\n");
		expect(evidence).not.toBeNull();
		expect(evidence?.patch).toContain("--- /dev/null");
		expect(evidence?.patch).toContain("+# 金缕衣");
		expect(evidence?.additions).toBe(3);
		expect(evidence?.deletions).toBe(0);
	});

	it("diffs an overwrite instead of misreading markdown list lines as removals", () => {
		const evidence = buildReviewEvidence({ path: "a.txt", before: POEM }, MARKDOWN);
		expect(evidence).not.toBeNull();
		expect(evidence?.patch).toContain("-《金缕衣》");
		expect(evidence?.patch).toContain("+- 朝代：唐");
		expect(evidence?.additions).toBe(6);
		expect(evidence?.deletions).toBe(2);
	});

	it("returns null when the content did not change", () => {
		expect(buildReviewEvidence({ path: "a.txt", before: MARKDOWN }, MARKDOWN)).toBeNull();
	});
});
