// POST /api/backgrounds on the hosted site: the Pages Functions version of the Node
// server's endpoint. The Ledger lk_ token is a Pages secret and never reaches the client.

import { backgroundPrompt, parseBackgroundRequest } from "../../server/backgrounds.ts";
import { corsHeaders, generationConfigured, json, type Env } from "../../server/pagesShared.ts";

const GENERATIONS_PER_HOUR = 20;
// Per isolate only: Cloudflare runs many, so this is a speed bump, not a quota. A real
// quota needs sign-in (see docs/brief.md, open questions).
const recent = new Map<string, number[]>();

function allow(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= GENERATIONS_PER_HOUR) return false;
  hits.push(now);
  recent.set(key, hits);
  return true;
}

export const onRequestOptions = ({ request, env }: { request: Request; env: Env }) => new Response(null, { status: 204, headers: corsHeaders(request, env) });

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const cors = corsHeaders(request, env);
  if (!generationConfigured(env)) return json({ error: "Background generation is not configured on this server." }, 503, cors);

  let parsed;
  try {
    const text = await request.text();
    if (text.length > 16 * 1024) throw new Error("Request too large");
    parsed = parseBackgroundRequest(JSON.parse(text));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400, cors);
  }

  const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (!allow(key)) return json({ error: "Generation limit reached. Try again later." }, 429, { ...cors, "Retry-After": "3600" });

  const url = `${env.LEDGER_URL!.replace(/\/$/, "")}/v1/purpose/${encodeURIComponent(env.LEDGER_PURPOSE_ID!)}/images/generations`;
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.LEDGER_TOKEN}`, "Content-Type": "application/json", "x-ledger-app": "cantare" },
      body: JSON.stringify({ prompt: backgroundPrompt(parsed.prompt), size: parsed.size, quality: parsed.quality, n: 1 })
    });
    const payload = (await upstream.json().catch(() => null)) as { data?: { b64_json?: string; url?: string }[] } | null;
    const image = payload?.data?.[0];
    if (!upstream.ok || !(image?.b64_json || image?.url)) {
      return json({ error: "The image service could not generate a background. Try a different description." }, 502, cors);
    }
    return json({ image: image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url }, 200, cors);
  } catch {
    return json({ error: "Could not reach the image service." }, 502, cors);
  }
}
