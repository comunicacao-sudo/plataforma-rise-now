// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/** Legacy endpoint retained only to fail closed while existing deployments drain. */
Deno.serve(() =>
  Response.json({ ok: false, error: "Legacy WhatsApp provider disabled." }, { status: 410 }),
);
