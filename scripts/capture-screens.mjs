// Capture the editor's screens and states for review and PR descriptions.
// Usage: pnpm dev (in another shell), then `node scripts/capture-screens.mjs [outDir] [backgroundPng]`.
// Uses dev-only window hooks (__editor, __ui, __demo) that production builds do not ship.

import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "docs/screenshots";
const backgroundFile = process.argv[3];
const background = backgroundFile ? `data:image/png;base64,${readFileSync(backgroundFile).toString("base64")}` : null;
mkdirSync(out, { recursive: true });

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  "tablet-landscape": { viewport: { width: 1366, height: 1024 }, hasTouch: true, isMobile: true },
  "tablet-portrait": { viewport: { width: 1024, height: 1366 }, hasTouch: true, isMobile: true },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
};

const settle = (page, ms = 1800) => page.waitForTimeout(ms);

async function fresh(browser, device) {
  const context = await browser.newContext({ ...DEVICES[device], acceptDownloads: true });
  const page = await context.newPage();
  // Captures use the quick export; the photoreal warm-up would only slow them down.
  await page.addInitScript(() => localStorage.setItem("cantare.exportMode", "quick"));
  await page.goto("http://localhost:5180/");
  await page.locator(".splash").waitFor({ state: "detached", timeout: 90_000 });
  await settle(page, 1200);
  return { context, page };
}

async function scene(page, { art = true, tool = "light", sheet = "half", editor = {}, ui = {} } = {}) {
  await page.evaluate(
    ({ art, tool, sheet, editor, ui }) => {
      const e = window.__editor.getState();
      if (art) e.patch("artwork", { url: window.__demo(), name: "Sample: Hopwell IPA" });
      for (const [key, value] of Object.entries(editor)) {
        if (typeof value === "object" && value) e.patch(key, value);
        else e.set(key, value);
      }
      const u = window.__ui.getState();
      u.setTool(tool);
      u.set({ welcome: false, sheet, ...ui });
    },
    { art, tool, sheet, editor, ui }
  );
  await settle(page);
}

async function shot(page, device, name) {
  const file = join(out, `${device}-${name}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: 84 });
  console.log(file);
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

for (const device of Object.keys(DEVICES)) {
  const compact = device !== "desktop" && device !== "tablet-landscape";
  const { context, page } = await fresh(browser, device);
  const all = device === "desktop" || device === "phone";

  await shot(page, device, "first-run");

  await scene(page, { tool: "can", sheet: compact ? "full" : "half" });
  await shot(page, device, "can");
  if (all) {
    await scene(page, { art: false, tool: "colour", editor: { artwork: { url: null }, body: { preset: "custom", color: "#b4232c", metallic: false, finish: "gloss" }, lid: { preset: "black", finish: "gloss" } } });
    await page.getByRole("radio", { name: "Custom colour" }).first().click();
    await settle(page, 800);
    await shot(page, device, "colour-custom");
    await page.getByRole("button", { name: "Done" }).click();
    await scene(page, { tool: "artwork", editor: { body: { preset: "silver", finish: "gloss" }, lid: { preset: "silver", finish: "brushed" } } });
    await shot(page, device, "artwork-printed");
    await scene(page, { art: false, tool: "artwork", editor: { artwork: { mode: "label", top: null, bottom: null, fit: "auto" } } });
    await shot(page, device, "artwork-label");
    await scene(page, { art: false, tool: "artwork", editor: { artwork: { mode: "sticker", top: null, bottom: null, fit: "auto" } } });
    await shot(page, device, "artwork-sticker");
  }

  await scene(page, { art: false, tool: "light", editor: { artwork: { mode: "printed" } } });
  await shot(page, device, "light");
  if (compact) {
    await page.evaluate(() => window.__ui.getState().set({ sheet: "peek" }));
    await settle(page, 1000);
    await shot(page, device, "light-peek");
  }

  await scene(page, { art: false, tool: "water", editor: { water: { density: 0.45, size: 0.3, runs: 0.25, haze: 0.55, tool: "spray" } } });
  await shot(page, device, "water");

  if (all) {
    await scene(page, { art: false, tool: "camera", editor: { water: { density: 0.3, size: 0.35, runs: 0.2, haze: 0.15, tool: "none" } } });
    await shot(page, device, "camera");
    await scene(page, { art: false, tool: "camera", editor: { tilt: { pitch: -22, roll: 14 }, spin: 30 } });
    await shot(page, device, "camera-tilted");
    await scene(page, { art: false, tool: "camera", editor: { tilt: { pitch: 0, roll: 0 }, spin: 0 } });
    await scene(page, { art: false, tool: "effects", editor: { effects: { ...(await page.evaluate(() => window.__editor.getState().settings.effects)), dofEnabled: true, aperture: 2, reflection: 0.4 } } });
    await shot(page, device, "effects");

    const prompt = "Wet slate bar top at night, warm bokeh lights behind";
    await scene(page, { art: false, tool: "background", editor: { effects: { ...(await page.evaluate(() => window.__editor.getState().settings.effects)), dofEnabled: false } }, ui: { prompt, backgroundSource: "generate" } });
    await shot(page, device, "scene-generate");
    await page.evaluate(() => window.__ui.getState().set({ generation: { status: "generating", startedAt: Date.now() - 9000 } }));
    await settle(page, 1200);
    await shot(page, device, "scene-generating");
    await page.evaluate(() =>
      window.__ui.getState().set({ generation: { status: "error", message: "The image service could not generate a background. Try a different description." } })
    );
    await settle(page, 600);
    await shot(page, device, "scene-error");
    if (background) {
      await page.evaluate(async (url) => {
        window.__ui.getState().set({ generation: { status: "idle" } });
        window.__editor.getState().patch("background", { kind: "image", imageUrl: url, visible: true });
      }, background);
      await settle(page, 2500);
      await shot(page, device, "scene-done");
    } else {
      await page.evaluate(() => window.__ui.getState().set({ generation: { status: "idle" } }));
    }
  }

  // Export: settings, then a real render to the gallery.
  await page.evaluate(() => window.__ui.getState().set({ dialog: "export" }));
  await page.getByRole("img", { name: "Export preview" }).waitFor({ timeout: 60_000 });
  await settle(page, 1000);
  await shot(page, device, "export");
  if (all) {
    const download = page.waitForEvent("download", { timeout: 120_000 });
    await page.getByRole("button", { name: /Download PNG|Save to Photos/ }).click();
    await download;
    await page.locator(".export__done").waitFor({ timeout: 120_000 });
    await settle(page, 600);
    await shot(page, device, "export-done");
    await page.evaluate(() => window.__ui.getState().set({ dialog: "gallery", toast: null }));
    await page.locator(".render").first().waitFor();
    await settle(page, 800);
    await shot(page, device, "gallery");

    // Saved setups: the scene menu, saving, and the list.
    await page.evaluate(() => window.__ui.getState().set({ dialog: null }));
    await settle(page, 400);
    await page.locator(".topbar__centre button").first().click();
    await settle(page, 400);
    await shot(page, device, "scene-menu");
    await page.getByRole("menuitem", { name: /Save setup/ }).click();
    await settle(page, 1500);
    await shot(page, device, "setup-save");
    const name = page.getByRole("dialog").getByRole("textbox").first();
    await name.fill("Hopwell · bar");
    await name.press("Enter");
    await settle(page, 1200);
    await page.evaluate(() => window.__ui.getState().set({ dialog: "setups" }));
    await settle(page, 1200);
    await shot(page, device, "setups");
    await page.evaluate(() => window.__ui.getState().set({ dialog: null }));

    // Photoreal export settings (last: its background warm-up is heavy without a GPU).
    await page.evaluate(() => window.__ui.getState().set({ dialog: "export" }));
    await page.getByRole("radio", { name: "Photoreal" }).click();
    await settle(page, 1200);
    await shot(page, device, "export-photoreal");
  }
  await context.close();

  if (device === "desktop") {
    const empty = await fresh(browser, device);
    await empty.page.evaluate(() => window.__ui.getState().set({ dialog: "gallery" }));
    await empty.page.locator(".gallery__empty").waitFor();
    await shot(empty.page, device, "gallery-empty");
    await empty.page.evaluate(() => window.__ui.getState().set({ dialog: null, collapsed: true, welcome: false }));
    await settle(empty.page, 1200);
    await shot(empty.page, device, "collapsed");
    await empty.page.evaluate(() => window.__ui.getState().set({ collapsed: false, ready: false }));
    await settle(empty.page, 300);
    await shot(empty.page, device, "splash");
    await empty.context.close();
  }
}

await browser.close();
