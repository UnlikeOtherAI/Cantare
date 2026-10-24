import { defineConfig, devices } from "@playwright/test";

// WebGL runs on SwiftShader in headless Chromium: slow, but deterministic.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5180",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }
  ],
  webServer: { command: "pnpm dev", url: "http://localhost:5180", reuseExistingServer: true, timeout: 60_000 }
});
