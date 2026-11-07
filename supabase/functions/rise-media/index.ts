import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import {
  driveFileId,
  driveFailure,
  validRange,
  mediaRequestRange,
  verifyMediaTicket,
} from "../_shared/video-media.ts";

const base = Deno.env.get("SUPABASE_URL")!;
const secret =
  Deno.env.get("APP_USER_CONNECTION_KEY_SECRET")?.trim() ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.trim();
const db = createClient(base, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const site = Deno.env.get("APP_BASE_URL") || "https://board.mentoriarisenow.com.br";
const cors = {
  "Access-Control-Allow-Origin": new URL(site).origin,
  "Access-Control-Allow-Headers": "range,content-type",
  "Access-Control-Expose-Headers": "content-range,accept-ranges,content-length,x-rise-media-error",
  "Cache-Control": "private, no-store",
};
const deny = (status: number, code?: string) =>
  new Response(null, {
    status,
    headers: { ...cors, ...(code ? { "X-Rise-Media-Error": code } : {}) },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: { ...cors, "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS" },
    });
  if (!["GET", "HEAD"].includes(request.method)) return deny(405);
  const range = request.headers.get("range");
  if (!validRange(range)) return deny(416);
  try {
    let ticket;
    try {
      ticket = await verifyMediaTicket(
        new URL(request.url).searchParams.get("ticket") || "",
        secret,
      );
    } catch {
      return deny(401, "invalid_ticket");
    }
    const { data: source, error } = await db.rpc("authorize_stage_video", {
      p_user_id: ticket.userId,
      p_content_id: ticket.contentId,
      p_session_id: ticket.sessionId,
    });
    if (error) return deny(503, "access_check_failed");
    if (!source || source.revision !== ticket.revision) return deny(403, "access_denied");
    const id = driveFileId(source.externalUrl || "");
    const key = Deno.env.get("GOOGLE_DRIVE_API_KEY")?.trim();
    if (!id) return deny(404);
    if (!key) return deny(503, "drive_key_missing");
    const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true", key });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let upstream: Response;
    try {
      upstream = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?${params}`, {
        method: request.method,
        headers: {
          Referer: new URL(site).origin + "/",
          ...(range ? { Range: mediaRequestRange(range)! } : {}),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (upstream.status === 416) {
      await upstream.body?.cancel();
      return deny(416);
    }
    if (!upstream.ok) {
      const failure = await driveFailure(upstream);
      return deny(upstream.status === 403 || upstream.status === 404 ? 403 : 502, failure.code);
    }
    const mime = upstream.headers.get("content-type") || "";
    if (!mime.startsWith("video/") && !mime.startsWith("application/octet-stream")) {
      await upstream.body?.cancel();
      return deny(502);
    }
    const headers = new Headers(cors);
    for (const name of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return deny(504, "drive_timeout");
    return deny(503, "media_unavailable");
  }
});
