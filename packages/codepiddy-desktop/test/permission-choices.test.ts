import { describe, expect, it } from "vitest";
import {
	PERMISSION_DECISION_LABELS,
	PERMISSION_DECISION_OPTION_IDS,
	permissionDecisionIdForLabel,
} from "../../codepiddy-permission-extension/src/permission-dialog.ts";
import {
	KNOWN_PERMISSION_CHOICE_LABELS,
	permissionChoicePresentation,
} from "../src/renderer/permission-choices.ts";

describe("permission dialog choices", () => {
	// 弹窗是通用扩展 UI：扩展发什么标签，桌面端就渲染什么。桌面端要判断主次按钮，
	// 就必须认识同一组标签。以前两边各写各的英文/中文常量，扩展改一次文案，
	// 桌面端的按钮样式就静默失效。这个断言就是防这种漂移的。
	it("desktop knows exactly the labels the permission extension emits", () => {
		const emitted = PERMISSION_DECISION_OPTION_IDS.map((id) => PERMISSION_DECISION_LABELS[id]);
		expect([...KNOWN_PERMISSION_CHOICE_LABELS].sort()).toEqual([...emitted].sort());
	});

	it("labels are unique so the round trip is unambiguous", () => {
		const labels = PERMISSION_DECISION_OPTION_IDS.map((id) => PERMISSION_DECISION_LABELS[id]);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it("every emitted label round-trips back to its decision id", () => {
		for (const id of PERMISSION_DECISION_OPTION_IDS) {
			expect(permissionDecisionIdForLabel(PERMISSION_DECISION_LABELS[id])).toBe(id);
		}
	});

	it("an unrecognised label resolves to no decision, which the caller treats as a rejection", () => {
		expect(permissionDecisionIdForLabel("Allow Once")).toBeUndefined();
		expect(permissionDecisionIdForLabel(undefined)).toBeUndefined();
	});

	it("approval choices are primary buttons and rejections are not", () => {
		expect(permissionChoicePresentation(PERMISSION_DECISION_LABELS.once).tone).toBe("approve");
		expect(permissionChoicePresentation(PERMISSION_DECISION_LABELS.always).tone).toBe("approve");
		expect(permissionChoicePresentation(PERMISSION_DECISION_LABELS.reject).className).toBe("secondary-button");
		expect(permissionChoicePresentation(PERMISSION_DECISION_LABELS.reject_with_reason).className).toBe(
			"secondary-button",
		);
	});

	it("an unknown label degrades to a neutral secondary button instead of throwing", () => {
		expect(permissionChoicePresentation("Allow Once")).toEqual({
			className: "secondary-button",
			tone: "unknown",
		});
	});
});
