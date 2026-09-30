import { expect, test } from "@playwright/test";
import { createFeatureWorkItem, launchCodePIddy, openRequirementAgent, sendComposerMessage } from "./helpers/app.ts";

/**
 * 消息内 GFM 表格。
 * 之前 RichText 完全没有表格分支，所有 `| ... |` 行都掉进段落，
 * 加上 p 上的 white-space:pre-wrap，界面就变成一屏管道符原文。
 */
test("markdown tables render as tables, not raw pipe text", async () => {
	const client = await launchCodePIddy();
	const { page } = client;
	try {
		await createFeatureWorkItem(page);
		await openRequirementAgent(page);
		await sendComposerMessage(page, "给我一个 md-table 的例子");

		const rich = page.locator(".message-rich-text").last();
		await expect(rich.locator("table.message-table").first()).toBeVisible({ timeout: 15_000 });

		// 分隔行和管道符都不许漏到界面上
		await expect(rich).not.toContainText("|---|");
		expect(await rich.innerText()).not.toContain("|");

		const first = rich.locator("table.message-table").first();
		// 表头 2 列 + 数据行 3 列：模型把「首列行标签」漏出了表头，
		// 按最宽的行补足，不能按表头截断（截断会静默吃掉整列内容）。
		await expect(first.locator("thead th")).toHaveCount(3);
		await expect(first.locator("tbody tr")).toHaveCount(6);
		await expect(first).toContainText("撞任意蛇身");
		await expect(first).toContainText("（AI 行为、碰撞网格、重生、排名）");

		// 单元格里的 **加粗** 不能被表格解析吃掉
		await expect(first.locator("tbody strong").first()).toBeVisible();

		// 列宽交给内容，窄栏里也不该溢出容器
		const overflow = await first
			.locator("xpath=..")
			.evaluate((element) => element.scrollWidth - element.clientWidth);
		expect(overflow).toBeLessThanOrEqual(1);

		// :--- / :---: / ---: 要落到真实的 text-align 上
		const aligned = rich.locator("table.message-table").nth(1);
		await expect(aligned.locator("th[data-align='left']")).toHaveText("数量");
		await expect(aligned.locator("th[data-align='center']")).toHaveText("名称");
		await expect(aligned.locator("th[data-align='right']")).toHaveText("分数");
		expect(
			await aligned.locator("td[data-align='right']").first().evaluate((element) => getComputedStyle(element).textAlign),
		).toBe("right");

		// 表格里的字必须和正文一样大。之前表格写死了 12/11/13px，
		// 套上边框后读起来像嵌在正文里的另一个控件。
		const paragraphSize = await rich
			.locator("p")
			.first()
			.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
		const tableSize = await first
			.locator("tbody td")
			.first()
			.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
		expect(paragraphSize).toBe(16);
		expect(tableSize).toBe(paragraphSize);

		// 表格不能被当成普通段落，也不能撑破消息区
		expect(await rich.locator("p:has-text('|')").count()).toBe(0);
	} finally {
		await client.close();
	}
});