import { describe, expect, it } from "vitest";
import { thinkingLevelLabel } from "../src/renderer/components/thinking-levels.ts";

// Pi 的取值定义在 packages/ai/src/types.ts 的 ModelThinkingLevel。
// 这里把全集列全，是为了让 Pi 以后新增档位时这条测试先红，而不是让用户
// 在输入区看到一段空白按钮。
const PI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

describe("thinkingLevelLabel", () => {
	it("covers every level Pi can report", () => {
		for (const level of PI_THINKING_LEVELS) {
			expect(thinkingLevelLabel(level)).not.toBe(level);
		}
	});

	it("maps the levels the operator reads most", () => {
		expect(thinkingLevelLabel("off")).toBe("关闭");
		expect(thinkingLevelLabel("low")).toBe("低");
		expect(thinkingLevelLabel("high")).toBe("高");
	});

	it("falls back to the raw value for anything unmapped", () => {
		// Pi 新增档位时不应显示空白，也不能崩
		expect(thinkingLevelLabel("ultra")).toBe("ultra");
		expect(thinkingLevelLabel("")).toBe("");
	});
});
