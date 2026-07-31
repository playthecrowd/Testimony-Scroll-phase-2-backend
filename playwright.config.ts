import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? "https://production.quest4thekingdom.com";

const requiredEnvVars = [
  "HOST_MEMBER_EMAIL",
  "HOST_MEMBER_PASSWORD",
  "MEMBER_EMAIL",
  "MEMBER_PASSWORD",
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(
      `Missing ${key} in .env — E2E smoke tests require host and member test credentials. See .env.example.`,
    );
  }
}

const isLocalhost =
  baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      // Tolerate minor font/antialiasing noise against production.
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
  ],
  ...(isLocalhost
    ? {
        webServer: {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
