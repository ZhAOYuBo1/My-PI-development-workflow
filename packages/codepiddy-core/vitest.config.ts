import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@codepiddy/shared": fileURLToPath(new URL("../codepiddy-shared/src/index.ts", import.meta.url)),
    },
  },
});
