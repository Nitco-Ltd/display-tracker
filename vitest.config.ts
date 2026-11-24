import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: "file::memory:", RAW_PAYLOAD_RETENTION_DAYS: "14" },
    pool: "forks",
  },
});
