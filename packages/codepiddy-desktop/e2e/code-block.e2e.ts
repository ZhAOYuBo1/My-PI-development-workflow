import { expect, test } from "@playwright/test";
import { createFeatureWorkItem, launchCodePIddy, openRequirementAgent, sendComposerMessage } from "./helpers/app.ts";

/**
 * 消息内代码块：默认换行、默认折叠、折叠必须是真的截断。
 * 之前折叠只是把滚动框 420px → 150px（overflow 仍是 auto），内容没截断，视觉上等于坏掉。
 */
test("code blocks wrap by default and collapse by truncating", async () => {
	const client = await launchCodePIddy();
	const { page } = client;
	try {
		await createFeatureWorkItem(page);
		await openRequirementAgent(page);
		await sendComposerMessage(page, "给我一个 code-block-long 的例子");

		const block = page.locator(".message-code-block").first();
		await expect(block).toBeVisible({ timeout: 15_000 });
		const pre = block.locator("pre");

		// 默认换行：pre 必须是 pre-wrap，且没有横向溢出。
		await expect(block).toHaveClass(/\bwrapped\b/);
		expect(await pre.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("pre-wrap");
		const overflows = await pre.evaluate((element) => element.scrollWidth - element.clientWidth);
		expect(overflows).toBeLessThanOrEqual(1);

		// 默认折叠：超过 24 行的代码应处于折叠态，且截断高度远小于完整高度。
		await expect(block).toHaveClass(/\bcollapsed\b/);
		expect(await pre.evaluate((element) => getComputedStyle(element).overflow)).toBe("hidden");
		expect(await pre.evaluate((element) => element.clientHeight)).toBeLessThanOrEqual(150);

		// 折叠必须有可发现的展开入口。
		const expand = block.locator(".message-code-expand");
		await expect(expand).toBeVisible();
		await expand.click();
		await expect(block).not.toHaveClass(/\bcollapsed\b/);
		expect(await pre.evaluate((element) => getComputedStyle(element).overflow)).toBe("auto");
		expect(await pre.evaluate((element) => element.clientHeight)).toBeGreaterThan(150);

		// 工具栏按钮不能是 9px 的等宽字体（DESIGN.md：monospace 只留给代码/路径/命令）。
		const button = block.locator(".message-code-actions button").first();
		expect(await button.evaluate((element) => getComputedStyle(element).fontSize)).toBe("11px");
		expect(await button.evaluate((element) => getComputedStyle(element).fontFamily)).not.toContain("Consolas");
	} finally {
		await client.close();
	}
});
