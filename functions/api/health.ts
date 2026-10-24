import { corsHeaders, generationConfigured, json, type Env } from "../../server/pagesShared.ts";

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) =>
  json({ ok: true, generation: generationConfigured(env) }, 200, corsHeaders(request, env));

export const onRequestOptions = ({ request, env }: { request: Request; env: Env }) => new Response(null, { status: 204, headers: corsHeaders(request, env) });
