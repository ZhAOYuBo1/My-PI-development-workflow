import { expect, test } from "@playwright/test";
import { launchCodePIddy, type CodePIddyE2EApp } from "./helpers/app.ts";

let client: CodePIddyE2EApp;
test.beforeEach(async () => { client = await launchCodePIddy(); });
test.afterEach(async () => { await client.close(); });

test("Windows title bar shares the app canvas color and keeps native window controls", async () => {
	test.skip(process.platform !== "win32", "Windows title bar overlay");
	const { page, app } = client;
	const titlebar = page.locator(".app-titlebar");
	await expect(titlebar).toBeVisible();
	const box = await titlebar.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.y).toBe(0);
	expect(box!.height).toBe(32);
	const colors = await page.evaluate(() => ({
		bar: getComputedStyle(document.querySelector(".app-titlebar")!).backgroundColor,
		frame: getComputedStyle(document.querySelector(".app-shell")!).backgroundColor,
		drag: getComputedStyle(document.querySelector(".app-titlebar")!).getPropertyValue("-webkit-app-region"),
	}));
	expect(colors.bar).toBe(colors.frame);
	expect(colors.drag).toBe("drag");
	const browserWindow = await app.browserWindow(page);
	expect(await browserWindow.evaluate((window) => window.isMinimizable() && window.isMaximizable() && window.isClosable())).toBe(true);
});
