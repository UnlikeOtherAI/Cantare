// Shared bits for the Cloudflare Pages Functions in functions/api/ that replace server/index.ts on the
// hosted site. Rendering stays on the user's device; these only proxy generation.

export interface Env {
  LEDGER_URL?: string;
  LEDGER_TOKEN?: string;
  LEDGER_PURPOSE_ID?: string;
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ORIGINS = "capacitor://localhost,https://localhost";

export function generationConfigured(env: Env) {
  return Boolean(env.LEDGER_URL && env.LEDGER_TOKEN && env.LEDGER_PURPOSE_ID);
}

/** Same-origin requests need no CORS; the native apps call from their own origins. */
export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS).split(",").map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }
  });
}
