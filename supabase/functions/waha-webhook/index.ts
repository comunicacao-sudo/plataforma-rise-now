// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const env = (name: string) => Deno.env.get(name)?.trim() || null;
const keyFromJson = (name: string) => {
  try {
    return JSON.parse(env(name) ?? "{}").default ?? null;
  } catch {
    return null;
  }
};
const admin = createClient(
  env("SUPABASE_URL")!,
  keyFromJson("SUPABASE_SECRET_KEYS") ?? env("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await request.text();
  const secret = env("WAHA_WEBHOOK_HMAC_KEY");
  const provided = request.headers.get("x-webhook-hmac")?.trim().toLowerCase();
  if (!secret || !provided) return new Response("Unauthorized", { status: 401 });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  if (!/^[a-f0-9]{128}$/.test(provided) || provided.length !== expected.length)
    return new Response("Unauthorized", { status: 401 });
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1)
    mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  if (mismatch !== 0) return new Response("Unauthorized", { status: 401 });
  try {
    const body = JSON.parse(raw);
    if (
      body.event === "message.ack" &&
      body.session === (env("WAHA_SESSION_NAME") ?? "rise-principal") &&
      body.payload?.id
    ) {
      const ack = Number(body.payload.ack ?? 0);
      const status = ack >= 3 ? "read" : ack >= 2 ? "delivered" : ack >= 1 ? "sent" : null;
      if (status)
        await admin
          .from("whatsapp_notifications")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("provider_message_id", body.payload.id);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Invalid webhook payload" }, { status: 400 });
  }
});
