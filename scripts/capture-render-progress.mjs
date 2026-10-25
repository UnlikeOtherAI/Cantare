// Capture the photoreal export's progress states on a real GPU: settings, preparing,
// tracing and done. Needs `pnpm dev` running. Usage: node scripts/capture-render-progress.mjs [outDir] [width] [height]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "docs/screenshots";
const viewport = { width: Number(process.argv[3] ?? 1440), height: Number(process.argv[4] ?? 900) };
const device = viewport.width < 600 ? "phone" : "desktop";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport, deviceScaleFactor: device === "phone" ? 2 : 1, hasTouch: device === "phone", isMobile: device === "phone", acceptDownloads: true });
await page.addInitScript(() => localStorage.setItem("cantare.exportMode", "photoreal"));
await page.goto("http://localhost:5180/");
await page.locator(".splash").waitFor({ state: "detached", timeout: 120_000 });
await page.evaluate(() => {
  const e = window.__editor.getState();
  e.patch("artwork", { url: window.__demo(), name: "Sample: Hopwell IPA" });
  e.patch("water", { density: 0.3, size: 0.4, runs: 0.2, haze: 0.12 });
  window.__ui.getState().set({ welcome: false, dialog: "export" });
});
await page.getByRole("img", { name: "Export preview" }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(1500);
const shot = (name) => page.screenshot({ path: join(out, `${device}-${name}.jpg`), type: "jpeg", quality: 84, timeout: 120_000 });
await shot("export-photoreal");
await page.getByRole("radio", { name: "256 passes" }).click();
await page.getByRole("button", { name: /Render and/ }).click();
await page.locator(".render-steps li.is-active").filter({ hasText: "Starting the photoreal renderer" }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(6000);
await shot("render-preparing");
// Tracing can be quick once the renderer is warm: poll closely for the first passes.
await page.waitForFunction(() => /[1-9]\d* of/.test(document.querySelector(".render-steps__hint.mono")?.textContent ?? ""), null, { timeout: 400_000, polling: 50 });
await page.waitForTimeout(3000);
await shot("render-tracing");
await page.locator(".export__done").waitFor({ timeout: 400_000 });
await shot("render-done");
console.log("captured progress states");
await browser.close();
