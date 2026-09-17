import { app, nativeImage } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDirectory, "..");
const iconDirectory = path.join(desktopRoot, "resources", "icons");
const sourcePath = path.join(iconDirectory, "codepiddy-icon.svg");

await app.whenReady();
await mkdir(iconDirectory, { recursive: true });
const source = nativeImage.createFromPath(sourcePath);
if (source.isEmpty()) throw new Error(`Unable to load ${sourcePath}`);
for (const size of [1024, 512, 256, 128, 64, 32]) {
  const image = source.resize({ width: size, height: size, quality: "best" });
  await writeFile(path.join(iconDirectory, `codepiddy-icon-${size}.png`), image.toPNG());
}
app.quit();
