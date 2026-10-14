import { defineConfig, devices } from "@playwright/test";

// ビルドした dist/ を astro preview で配信して確かめる。
// base は SITE_BASE で切り替える(既定は /kawahara-lab-site/)。"/" でも通ることを CI で確かめる
const base = process.env.SITE_BASE ?? "/kawahara-lab-site/";
const port = 4322;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}${base}`,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run build && npx astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { SITE_BASE: base },
  },
});
