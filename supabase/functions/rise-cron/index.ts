// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const env = (name: string) => Deno.env.get(name)?.trim() || null;

/**
 * Provider-neutral scheduler endpoint. Event preferences, templates, idempotency
 * fields and history tables remain intact; delivery stays disabled until the
 * official provider contract is implemented.
 */
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = env("CRON_SECRET");
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) return new Response("Unauthorized", { status: 401 });
  return Response.json({
    ok: true,
    providerConfigured: false,
    attempted: 0,
    message: "WhatsApp ainda não configurado.",
  });
});
