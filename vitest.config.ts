import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirror the `@/*` path alias from tsconfig so tests import like app code.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
