import { defineConfig } from "@playwright/test";

// Ad hoc config for manual Batch 1 behavioral checks -- not part of the permanent project config
// (no playwright.config.ts exists at the repo root). See tests/manual/repairBatch1.spec.ts header.
export default defineConfig({
  testDir: __dirname,
  timeout: 15000,
  use: {
    baseURL: "http://localhost:3000",
  },
});
