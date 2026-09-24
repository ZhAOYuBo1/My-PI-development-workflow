import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const electronRoot = path.join(repositoryRoot, "node_modules", "electron");
const installer = path.join(electronRoot, "install.js");
const fallbackMirror = "https://npmmirror.com/mirrors/electron/";

async function runInstall(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [installer], {
      cwd: repositoryRoot,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function verifyInstall() {
  const executable = (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim();
  if (!executable) throw new Error("Electron path.txt is empty");
  await access(path.join(electronRoot, "dist", executable));
}

try {
  await access(installer);
} catch {
  console.error("Electron installer is missing. Run npm ci --ignore-scripts first.");
  process.exit(1);
}

let installed = await runInstall(process.env);
if (!installed && !process.env.ELECTRON_MIRROR) {
  console.warn("Electron official download failed; retrying with the npmmirror mirror.");
  installed = await runInstall({ ...process.env, ELECTRON_MIRROR: fallbackMirror });
}
if (!installed) process.exit(1);
await verifyInstall();
console.log("Electron runtime is ready.");
