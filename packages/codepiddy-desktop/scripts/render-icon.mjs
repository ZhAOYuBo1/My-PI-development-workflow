import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDirectory, "..");
const iconDirectory = path.join(desktopRoot, "resources", "icons");
const sourcePath = path.join(iconDirectory, "codepiddy-icon.svg");

await mkdir(iconDirectory, { recursive: true });
const source = await readFile(sourcePath, "utf8");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(
  `<style>html,body{margin:0;overflow:hidden;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${source}`,
);

const sizes = [1024, 512, 256, 128, 64, 48, 32, 16];
const pngBySize = new Map();
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  const png = await page.screenshot({ omitBackground: true, animations: "disabled" });
  pngBySize.set(size, png);
  await writeFile(path.join(iconDirectory, `codepiddy-icon-${size}.png`), png);
}

const icoSizes = [256, 128, 64, 48, 32, 16];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);

const entries = [];
let imageOffset = 6 + icoSizes.length * 16;
for (const size of icoSizes) {
  const png = pngBySize.get(size);
  if (!png) throw new Error(`Missing ${size}px PNG for ICO`);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(imageOffset, 12);
  entries.push(entry);
  imageOffset += png.length;
}

await writeFile(
  path.join(iconDirectory, "codepiddy-icon.ico"),
  Buffer.concat([header, ...entries, ...icoSizes.map((size) => pngBySize.get(size))]),
);
await browser.close();
