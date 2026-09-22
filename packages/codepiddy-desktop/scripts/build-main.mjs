import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

await Promise.all([
  build({
    entryPoints: ["src/main/index.ts"],
    outfile: "dist/main/index.js",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["electron"],
    sourcemap: true,
  }),
  build({
    entryPoints: ["../codepiddy-permission-extension/index.ts"],
    outfile: "dist/runtime-extensions/permission.js",
    alias: { "jsonc-parser": path.join(repositoryRoot, "node_modules/jsonc-parser/lib/esm/main.js") },
    ignoreAnnotations: true,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  }),
  build({
    entryPoints: ["../codepiddy-tavily-tool-extension/index.ts"],
    outfile: "dist/runtime-extensions/tavily-tool.js",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  }),
  build({
    entryPoints: ["../codepiddy-tavily-search-mcp/src/index.ts"],
    outfile: "dist/runtime-extensions/tavily-search.js",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  }),
  build({
    entryPoints: ["src/preload/index.ts"],
    outfile: "dist/preload/index.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    sourcemap: true,
  }),
]);
