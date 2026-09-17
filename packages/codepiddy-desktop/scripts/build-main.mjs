import { build } from "esbuild";

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
