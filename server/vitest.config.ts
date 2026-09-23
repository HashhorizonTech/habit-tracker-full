import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Each test file builds its own app against its own temporary SQLite DB.
    pool: "forks",
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
