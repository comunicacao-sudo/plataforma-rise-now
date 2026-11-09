import { handleR2TrashRoute } from "./r2-trash-route.ts";

const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;
const TICKET_TTL_MS = 6 * 60 * 60 * 1000;

const OFFICIAL_APP_ORIGINS = new Set([
  "https://board.mentoriarisenow.com.br",
  "https://plataforma-rise-now.lovable.app",
]);

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return env.APP_ORIGIN;
  return origin === env.APP_ORIGIN || OFFICIAL_APP_ORIGINS.has(origin) ? origin : null;
}

function corsHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Expose-Headers": "ETag,Content-Range,Content-Length,Accept-Ranges",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}
function json(request, env, data, status = 200) {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers });
}
function originAllowed(request, env) {
  return !!allowedOrigin(request, env);
}
async function authUser(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const response = await fetch(env.SUPABASE_URL + "/auth/v1/user", {
    headers: { Authorization: auth, apikey: env.SUPABASE_KEY },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return { user, auth };
}
async function rpc(env, auth, name, body) {
  const response = await fetch(env.SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { Authorization: auth, apikey: env.SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(raw || "RPC " + name + " failed");
  return raw ? JSON.parse(raw) : null;
}
async function requireStaff(request, env) {
  const session = await authUser(request, env);
  if (!session) return { error: json(request, env, { error: "Sessão inválida." }, 401) };
  const staff = await rpc(env, session.auth, "is_staff", {});
  if (staff !== true)
    return { error: json(request, env, { error: "Acesso restrito à equipe." }, 403) };
  return session;
}
function cleanExt(fileName, contentType) {
  const ext = String(fileName || "")
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (ext && ["mp4", "webm", "mov"].includes(ext)) return ext;
  if (contentType === "video/webm") return "webm";
  if (contentType === "video/quicktime") return "mov";
  return "mp4";
}
function validKey(key) {
  return (
    typeof key === "string" &&
    key.startsWith("lessons/") &&
    !key.includes("..") &&
    !key.startsWith("/")
  );
}
function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
async function hmacKey(env) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.TICKET_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
async function makeTicket(env, payload) {
  const encoded = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(env),
    new TextEncoder().encode(encoded),
  );
  return encoded + "." + b64url(new Uint8Array(sig));
}
async function readTicket(env, ticket) {
  if (!ticket || !ticket.includes(".")) return null;
  const [encoded, signature] = ticket.split(".");
  if (!encoded || !signature) return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(env),
    fromB64url(signature),
    new TextEncoder().encode(encoded),
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(encoded)));
    if (!payload || typeof payload.k !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp || !validKey(payload.k)) return null;
    return payload;
  } catch {
    return null;
  }
}
async function handleStart(request, env) {
  if (!originAllowed(request, env))
    return json(request, env, { error: "Origem não permitida." }, 403);
  const session = await requireStaff(request, env);
  if (session.error) return session.error;
  const body = await request.json().catch(() => ({}));
  const size = Number(body.size || 0);
  const contentType = String(body.contentType || "");
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(contentType))
    return json(request, env, { error: "A aula deve ser MP4, WebM ou MOV." }, 400);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES)
    return json(request, env, { error: "Cada aula pode ter no máximo 5 GB." }, 400);
  const ext = cleanExt(body.fileName, contentType);
  const key = "lessons/" + session.user.id + "/" + crypto.randomUUID() + "." + ext;
  const upload = await env.LESSONS.createMultipartUpload(key, {
    httpMetadata: { contentType, cacheControl: "private, no-store" },
    customMetadata: {
      uploadedBy: session.user.id,
      originalName: String(body.fileName || "aula").slice(0, 400),
    },
  });
  return json(request, env, {
    key,
    mediaPath: "r2:" + key,
    uploadId: upload.uploadId,
    partSize: PART_SIZE,
  });
}
async function handlePart(request, env, url) {
  if (!originAllowed(request, env))
    return json(request, env, { error: "Origem não permitida." }, 403);
  const session = await requireStaff(request, env);
  if (session.error) return session.error;
  const key = url.searchParams.get("key") || "";
  const uploadId = url.searchParams.get("uploadId") || "";
  const partNumber = Number(url.searchParams.get("partNumber") || "0");
  if (
    !validKey(key) ||
    !uploadId ||
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > 10000
  )
    return json(request, env, { error: "Parte de upload inválida." }, 400);
  const data = await request.arrayBuffer();
  if (!data.byteLength || data.byteLength > PART_SIZE)
    return json(request, env, { error: "Tamanho da parte inválido." }, 400);
  const upload = env.LESSONS.resumeMultipartUpload(key, uploadId);
  const part = await upload.uploadPart(partNumber, data);
  return json(request, env, { partNumber: part.partNumber, etag: part.etag });
}
async function handleComplete(request, env) {
  if (!originAllowed(request, env))
    return json(request, env, { error: "Origem não permitida." }, 403);
  const session = await requireStaff(request, env);
  if (session.error) return session.error;
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "");
  const uploadId = String(body.uploadId || "");
  const parts = Array.isArray(body.parts)
    ? body.parts
        .map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag || "") }))
        .filter(
          (p) =>
            Number.isInteger(p.partNumber) && p.partNumber > 0 && p.partNumber <= 10000 && p.etag,
        )
        .sort((a, b) => a.partNumber - b.partNumber)
    : [];
  if (!validKey(key) || !uploadId || !parts.length)
    return json(request, env, { error: "Upload incompleto." }, 400);
  const upload = env.LESSONS.resumeMultipartUpload(key, uploadId);
  await upload.complete(parts);
  return json(request, env, { ok: true, mediaPath: "r2:" + key });
}
async function handleAbort(request, env) {
  if (!originAllowed(request, env))
    return json(request, env, { error: "Origem não permitida." }, 403);
  const session = await requireStaff(request, env);
  if (session.error) return session.error;
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "");
  const uploadId = String(body.uploadId || "");
  if (!validKey(key) || !uploadId) return json(request, env, { error: "Upload inválido." }, 400);
  const upload = env.LESSONS.resumeMultipartUpload(key, uploadId);
  await upload.abort();
  return json(request, env, { ok: true });
}
async function handleTicket(request, env) {
  if (!originAllowed(request, env))
    return json(request, env, { error: "Origem não permitida." }, 403);
  const session = await authUser(request, env);
  if (!session) return json(request, env, { error: "Sessão inválida." }, 401);
  const body = await request.json().catch(() => ({}));
  const stepKey = String(body.stepKey || "");
  if (!/^[0-9a-fA-F-]{36}$/.test(stepKey))
    return json(request, env, { error: "Etapa inválida." }, 400);
  const mediaPath = await rpc(env, session.auth, "get_journey_media_path", { _step_key: stepKey });
  if (typeof mediaPath !== "string" || !mediaPath.startsWith("r2:"))
    return json(request, env, { error: "Vídeo do R2 não encontrado para esta etapa." }, 404);
  const key = mediaPath.slice(3);
  if (!validKey(key)) return json(request, env, { error: "Caminho de vídeo inválido." }, 400);
  const exp = Date.now() + TICKET_TTL_MS;
  const ticket = await makeTicket(env, { k: key, exp, u: session.user.id });
  const origin = new URL(request.url).origin;
  return json(request, env, {
    url: origin + "/media?ticket=" + encodeURIComponent(ticket),
    expiresAt: new Date(exp).toISOString(),
  });
}
async function handleMedia(request, env, url) {
  const payload = await readTicket(env, url.searchParams.get("ticket"));
  if (!payload) return new Response("Link expirado ou inválido.", { status: 403 });
  if (request.method === "HEAD") {
    const head = await env.LESSONS.head(payload.k);
    if (!head) return new Response("Not found", { status: 404 });
    const headers = corsHeaders(request, env);
    head.writeHttpMetadata(headers);
    headers.set("ETag", head.httpEtag);
    headers.set("Content-Length", String(head.size));
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, no-store");
    return new Response(null, { status: 200, headers });
  }
  const object = await env.LESSONS.get(payload.k, { range: request.headers });
  if (!object || !("body" in object)) return new Response("Not found", { status: 404 });
  const headers = corsHeaders(request, env);
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  let status = 200;
  if (
    request.headers.has("Range") &&
    object.range &&
    "offset" in object.range &&
    "length" in object.range
  ) {
    status = 206;
    const start = object.range.offset;
    const length = object.range.length;
    headers.set("Content-Range", "bytes " + start + "-" + (start + length - 1) + "/" + object.size);
    headers.set("Content-Length", String(length));
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return new Response(object.body, { status, headers });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!originAllowed(request, env))
      return json(request, env, { error: "Origem não permitida." }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    try {
      const trashResponse = await handleR2TrashRoute(request, env.LESSONS);
      if (trashResponse) {
        for (const [key, value] of corsHeaders(request, env)) trashResponse.headers.set(key, value);
        return trashResponse;
      }
      if (url.pathname === "/health" && request.method === "GET")
        return json(request, env, { ok: true, service: "rise-now-r2" });
      if (url.pathname === "/upload/start" && request.method === "POST")
        return await handleStart(request, env);
      if (url.pathname === "/upload/part" && request.method === "PUT")
        return await handlePart(request, env, url);
      if (url.pathname === "/upload/complete" && request.method === "POST")
        return await handleComplete(request, env);
      if (url.pathname === "/upload/abort" && request.method === "POST")
        return await handleAbort(request, env);

      if (url.pathname === "/ticket" && request.method === "POST")
        return await handleTicket(request, env);
      if (url.pathname === "/media" && (request.method === "GET" || request.method === "HEAD"))
        return await handleMedia(request, env, url);
      return json(request, env, { error: "Not found" }, 404);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "r2_request_failed",
          path: url.pathname,
          error: error instanceof Error ? error.message : "Erro interno.",
        }),
      );
      return json(
        request,
        env,
        {
          error: "Não foi possível concluir esta operação de vídeo. Tente novamente em instantes.",
        },
        500,
      );
    }
  },
};
