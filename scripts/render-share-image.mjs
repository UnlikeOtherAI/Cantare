// Render the social share image (public/og.jpg, 1200×630) and touch icon with the app
// itself: the sample can, photoreal, plus the wordmark. Needs `pnpm dev` running.
// Usage: node scripts/render-share-image.mjs [samples]

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const samples = Number(process.argv[2] ?? 256);
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto("http://localhost:5180/");
await page.locator(".splash").waitFor({ state: "detached", timeout: 120_000 });
await page.evaluate(() => {
  const e = window.__editor.getState();
  e.patch("artwork", { url: window.__demo(), name: "Sample", mode: "printed" });
  e.patch("water", { density: 0.3, size: 0.4, runs: 0.25, haze: 0.12, seed: 7 });
  e.patch("lighting", { environment: "softbox", azimuth: -45, elevation: 28 });
  e.patch("background", { kind: "studio", color: "#3a3d43", color2: "#0f1012" });
  e.patch("effects", { ...e.settings.effects, vignette: 0.35, grain: 0.04 });
  window.__ui.getState().set({ welcome: false });
});
await page.waitForTimeout(2500);
await page.evaluate(() => window.__stage.setCameraPreset("three-quarter", false));
await page.waitForTimeout(1500);

const out = await page.evaluate(async (samples) => {
  const toB64 = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(blob); });
  // Render a wide frame with the can at its centre, then place that centre on the
  // right of the card so the backdrop runs edge to edge with no seam.
  const render = await window.__stage.renderFinal({ width: 1760, height: 630, type: "image/png", samples });
  const bitmap = await createImageBitmap(render);
  await document.fonts.load("italic 112px 'Instrument Serif'");
  await document.fonts.load("500 30px 'Instrument Sans'");

  const card = document.createElement("canvas");
  card.width = 1200;
  card.height = 630;
  const ctx = card.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const shade = ctx.createLinearGradient(0, 0, 760, 0);
  shade.addColorStop(0, "rgba(10,11,13,0.82)");
  shade.addColorStop(1, "rgba(10,11,13,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 760, 630);
  ctx.fillStyle = "#f1f0ec";
  ctx.font = "italic 112px 'Instrument Serif'";
  ctx.fillText("Cantare", 72, 290);
  ctx.fillStyle = "rgba(241,240,236,0.72)";
  ctx.font = "500 30px 'Instrument Sans'";
  ctx.fillText("Photoreal beverage-can mock-ups,", 76, 360);
  ctx.fillText("rendered right in your browser.", 76, 402);
  ctx.fillStyle = "#f0b23f";
  ctx.fillRect(76, 446, 56, 4);
  const og = await new Promise((r) => card.toBlob(r, "image/jpeg", 0.9));

  // Touch icon: the can on the dark ground, square.
  const icon = document.createElement("canvas");
  icon.width = icon.height = 180;
  const ic = icon.getContext("2d");
  ic.fillStyle = "#0d0e10";
  ic.fillRect(0, 0, 180, 180);
  // The can fills the middle ~60% of the frame's height around its centre.
  const s = 180 / (bitmap.height * 0.68);
  ic.drawImage(bitmap, 90 - bitmap.width * 0.5 * s, 90 - bitmap.height * 0.5 * s, bitmap.width * s, bitmap.height * s);
  const touch = await new Promise((r) => icon.toBlob(r, "image/png"));
  return { og: await toB64(og), touch: await toB64(touch) };
}, samples);

mkdirSync("public", { recursive: true });
writeFileSync("public/og.jpg", Buffer.from(out.og, "base64"));
writeFileSync("public/apple-touch-icon.png", Buffer.from(out.touch, "base64"));
console.log("wrote public/og.jpg and public/apple-touch-icon.png");
await browser.close();
