// Capture a plain silver can, a gold can and the sample label under each environment,
// for before/after comparisons of the lighting.
// Usage: dev server on some port, then `node scripts/capture-lighting.mjs <prefix> [port] [outDir]`
// e.g. `node scripts/capture-lighting.mjs before 5181 docs/screenshots/lighting`.
// Uses dev-only window hooks (__editor, __ui, __demo) that production builds do not ship.

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const prefix = process.argv[2] ?? "after";
const port = process.argv[3] ?? "5181";
const out = process.argv[4] ?? "docs/screenshots/lighting";
mkdirSync(out, { recursive: true });

const ENVIRONMENTS = ["softbox", "hard", "daylight", "golden", "bar", "overcast"];
const LABEL_ENVIRONMENTS = ["softbox", "golden", "bar"];

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`http://localhost:${port}/`);
await page.locator(".splash").waitFor({ state: "detached", timeout: 90_000 });
await page.evaluate(() => {
  window.__ui.getState().setTool("light");
  window.__ui.getState().set({ welcome: false, sheet: "half", collapsed: true });
});
await page.waitForTimeout(1500);

async function set(editor) {
  await page.evaluate((editor) => {
    const e = window.__editor.getState();
    for (const [key, value] of Object.entries(editor)) e.patch(key, value);
  }, editor);
  await page.waitForTimeout(2200);
}

async function shot(name) {
  const file = join(out, `${prefix}-${name}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: 84 });
  console.log(file);
}

for (const preset of ["silver", "gold"]) {
  await set({ artwork: { url: null, name: null }, body: { preset, finish: "gloss" }, lid: { preset: "silver", finish: "brushed" } });
  for (const environment of ENVIRONMENTS) {
    await set({ lighting: { environment } });
    await shot(`${environment}-${preset}`);
  }
}

await set({ body: { preset: "silver", finish: "gloss" }, artwork: { url: await page.evaluate(() => window.__demo()), name: "Sample: Hopwell IPA", mode: "printed" } });
for (const environment of LABEL_ENVIRONMENTS) {
  await set({ lighting: { environment } });
  await shot(`${environment}-label`);
}

await browser.close();
