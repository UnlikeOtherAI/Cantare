// Cantare's only server work: background generation through Ledger, plus serving the
// built web app. Rendering and export happen on the user's device.
//
// Run with `node server/index.ts` (Node 24 strips the types).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { backgroundPrompt, parseBackgroundRequest } from "./backgrounds.ts";
import { RateLimiter } from "./rateLimit.ts";

const PORT = Number(process.env.PORT ?? 8797);
const LEDGER_URL = (process.env.LEDGER_URL ?? "").replace(/\/$/, "");
const LEDGER_TOKEN = process.env.LEDGER_TOKEN ?? "";
const LEDGER_PURPOSE_ID = process.env.LEDGER_PURPOSE_ID ?? "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "capacitor://localhost,https://localhost,http://localhost:5180")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? "dist");
const GENERATIONS_PER_HOUR = Number(process.env.GENERATIONS_PER_HOUR ?? 20);

const limiter = new RateLimiter(GENERATIONS_PER_HOUR, 60 * 60 * 1000);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json"
};

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 16 * 1024): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("Request too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function clientKey(req: IncomingMessage) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (first ?? req.socket.remoteAddress ?? "unknown").trim();
}

async function generateBackground(req: IncomingMessage, res: ServerResponse) {
  if (!LEDGER_URL || !LEDGER_TOKEN || !LEDGER_PURPOSE_ID) {
    return json(res, 503, { error: "Background generation is not configured on this server." });
  }
  let request;
  try {
    request = parseBackgroundRequest(JSON.parse(await readBody(req)));
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : "Invalid request" });
  }
  const key = clientKey(req);
  const wait = limiter.take(key);
  if (wait > 0) {
    res.setHeader("Retry-After", String(Math.ceil(wait / 1000)));
    return json(res, 429, { error: "Generation limit reached. Try again later." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  req.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const upstream = await fetch(`${LEDGER_URL}/v1/purpose/${encodeURIComponent(LEDGER_PURPOSE_ID)}/images/generations`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LEDGER_TOKEN}`,
        "Content-Type": "application/json",
        "x-ledger-app": "cantare"
      },
      body: JSON.stringify({ prompt: backgroundPrompt(request.prompt), size: request.size, quality: request.quality, n: 1 })
    });
    const payload = (await upstream.json().catch(() => null)) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } } | null;
    if (!upstream.ok) {
      limiter.refund(key);
      console.error("Ledger image generation failed", upstream.status, payload?.error?.message);
      return json(res, 502, { error: "The image service could not generate a background. Try a different description." });
    }
    const image = payload?.data?.[0];
    if (image?.b64_json) return json(res, 200, { image: `data:image/png;base64,${image.b64_json}` });
    if (image?.url) return json(res, 200, { image: image.url });
    limiter.refund(key);
    return json(res, 502, { error: "The image service returned no image." });
  } catch (error) {
    limiter.refund(key);
    const aborted = error instanceof Error && error.name === "AbortError";
    return json(res, aborted ? 504 : 502, { error: aborted ? "Generation took too long." : "Could not reach the image service." });
  } finally {
    clearTimeout(timeout);
  }
}

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  let file = join(STATIC_DIR, relative);
  if (!file.startsWith(STATIC_DIR)) return json(res, 404, { error: "Not found" });
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
  } catch {
    file = join(STATIC_DIR, "index.html");
  }
  try {
    const body = await readFile(file);
    const immutable = file.includes(`${join(STATIC_DIR, "assets")}`);
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache"
    });
    res.end(body);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/api/health") return json(res, 200, { ok: true, generation: Boolean(LEDGER_URL && LEDGER_TOKEN && LEDGER_PURPOSE_ID) });
  if (path === "/api/backgrounds" && req.method === "POST") return generateBackground(req, res);
  if (path.startsWith("/api/")) return json(res, 404, { error: "Not found" });
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
  json(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => console.log(`Cantare server on :${PORT}`));
