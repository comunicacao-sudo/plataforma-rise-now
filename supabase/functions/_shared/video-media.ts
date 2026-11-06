export function driveFileId(source: string) {
  try {
    const url = new URL(source);
    if (
      url.protocol !== "https:" ||
      !["drive.google.com", "docs.google.com"].includes(url.hostname)
    )
      return null;
    const id =
      url.pathname.match(/^\/file\/d\/([\w-]{10,200})(?:\/|$)/)?.[1] ?? url.searchParams.get("id");
    return id && /^[\w-]{10,200}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function validVideoDuration(value: unknown): number | null {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86400
    ? Math.max(1, Math.round(seconds))
    : null;
}

export async function readDriveVideo(
  source: string,
  key: string | null,
  referrer: string,
  fetcher: typeof fetch = fetch,
) {
  const id = driveFileId(source);
  if (!id) throw new Error("Informe o link de um arquivo de vídeo do Google Drive.");
  if (!key)
    throw new Error("A integração do Google Drive ainda precisa ser configurada pela equipe.");
  const query = new URLSearchParams({
    key,
    supportsAllDrives: "true",
    fields: "mimeType,size,videoMediaMetadata(durationMillis),capabilities(canDownload)",
  });
  const response = await fetcher(`https://www.googleapis.com/drive/v3/files/${id}?${query}`, {
    headers: { Referer: new URL(referrer).origin + "/" },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 403 || response.status === 404)
    throw new Error(
      "O Google Drive não liberou este vídeo. Confira o compartilhamento do arquivo e a configuração da chave.",
    );
  if (!response.ok)
    throw new Error("Não foi possível consultar o vídeo no Google Drive. Tente novamente.");
  const file = await response.json();
  if (typeof file.mimeType !== "string" || !file.mimeType.startsWith("video/"))
    throw new Error("O arquivo informado não é um vídeo.");
  if (file.capabilities?.canDownload === false)
    throw new Error(
      "O arquivo não permite a reprodução no player da plataforma. Confira as permissões no Drive.",
    );
  return {
    durationSeconds: validVideoDuration(Number(file.videoMediaMetadata?.durationMillis) / 1000),
    mimeType: file.mimeType,
  };
}

export type MediaTicket = {
  userId: string;
  contentId: string;
  revision: number;
  sessionId: string;
  expiresAt: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encode = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
function decode(value: string) {
  if (!/^[\w-]+$/.test(value)) throw new Error("Ticket inválido.");
  return Uint8Array.from(
    atob(
      value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4),
    ),
    (c) => c.charCodeAt(0),
  );
}
async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`rise-media-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function createMediaTicket(ticket: MediaTicket, secret: string) {
  const body = encode(new TextEncoder().encode(JSON.stringify(ticket)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(body),
  );
  return `${body}.${encode(new Uint8Array(signature))}`;
}
export async function verifyMediaTicket(
  value: string,
  secret: string,
  now = Date.now(),
): Promise<MediaTicket> {
  if (value.length > 1600) throw new Error("Ticket inválido.");
  const parts = value.split(".");
  const [body, signature] = parts;
  if (parts.length !== 2 || !body || !signature) throw new Error("Ticket inválido.");
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      decode(signature),
      new TextEncoder().encode(body),
    ))
  )
    throw new Error("Ticket inválido.");
  const ticket = JSON.parse(new TextDecoder().decode(decode(body))) as MediaTicket;
  if (
    !uuid.test(ticket.userId) ||
    !uuid.test(ticket.contentId) ||
    !uuid.test(ticket.sessionId) ||
    !Number.isInteger(ticket.revision) ||
    ticket.revision < 1 ||
    !Number.isFinite(ticket.expiresAt) ||
    ticket.expiresAt <= now ||
    ticket.expiresAt > now + 7 * 3600_000
  )
    throw new Error("Ticket inválido ou expirado.");
  return ticket;
}

export function mediaSessionId(authorization: string) {
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(
        decode(authorization.replace(/^Bearer\s+/i, "").split(".")[1] ?? ""),
      ),
    );
    if (uuid.test(payload.session_id)) return String(payload.session_id);
  } catch {
    /* A identidade é validada pelo Auth antes desta leitura. */
  }
  throw new Error("Entre novamente para assistir ao vídeo.");
}

export function validRange(value: string | null) {
  if (value === null) return true;
  if (value.length > 64 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(value)) return false;
  const [first, last] = value.slice(6).split("-");
  if (!first) return Number.isSafeInteger(Number(last)) && Number(last) > 0;
  return (
    Number.isSafeInteger(Number(first)) &&
    (!last || (Number.isSafeInteger(Number(last)) && Number(last) >= Number(first)))
  );
}
export function mediaRequestRange(value: string | null) {
  if (!value) return null;
  if (!validRange(value)) throw new Error("Intervalo de vídeo inválido.");
  const [first, last] = value.slice(6).split("-");
  const chunk = 8 * 1024 * 1024;
  if (!first) return `bytes=-${Math.min(Number(last), chunk)}`;
  const start = Number(first);
  return `bytes=${start}-${last ? Math.min(Number(last), start + chunk - 1) : start + chunk - 1}`;
}
