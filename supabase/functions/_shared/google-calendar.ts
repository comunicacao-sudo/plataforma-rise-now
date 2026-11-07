// @ts-nocheck
const env = (name: string) => Deno.env.get(name)?.trim() || null;
const bytes = (value: string) => new TextEncoder().encode(value);
const b64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const unb64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const googleFreeBusyScope = "https://www.googleapis.com/auth/calendar.events.freebusy";
export function googleCalendarClient(
  admin: any,
  connectorId: "google_calendar" | "google_drive" = "google_calendar",
) {
  async function encryptionKey() {
    const raw = env("APP_USER_CONNECTION_KEY_SECRET");
    if (!raw) throw new Error("Segredo de conexão Google não configurado.");
    const data = unb64(raw);
    if (data.length !== 32)
      throw new Error("APP_USER_CONNECTION_KEY_SECRET precisa ter 32 bytes em Base64.");
    return crypto.subtle.importKey("raw", data, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  async function encrypt(value: unknown) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await encryptionKey(),
        bytes(JSON.stringify(value)),
      ),
    );
    return `${b64(iv)}.${b64(encrypted)}`;
  }
  async function decrypt(value: string) {
    const [iv, ciphertext] = value.split(".");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(iv) },
      await encryptionKey(),
      unb64(ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }
  async function saveGoogle(userId: string, tokens: any) {
    const { error } = await admin.from("app_user_connections").upsert(
      {
        user_id: userId,
        connector_id: connectorId,
        connection_key_ciphertext: await encrypt(tokens),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,connector_id" },
    );
    if (error) throw new Error(error.message);
  }
  async function googleTokens(userId: string) {
    const { data, error } = await admin
      .from("app_user_connections")
      .select("connection_key_ciphertext")
      .eq("user_id", userId)
      .eq("connector_id", connectorId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return decrypt(data.connection_key_ciphertext);
  }
  async function googleAccess(userId: string) {
    const tokens = await googleTokens(userId);
    if (!tokens) return null;
    if (tokens.access_token && Number(tokens.expires_at ?? 0) > Date.now() + 60_000)
      return tokens.access_token;
    if (!tokens.refresh_token) return null;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID")!,
        client_secret: env("GOOGLE_CLIENT_SECRET")!,
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
    });
    if (!response.ok) return null;
    const next = await response.json();
    const merged = {
      ...tokens,
      ...next,
      expires_at: Date.now() + Number(next.expires_in ?? 3600) * 1000,
    };
    await saveGoogle(userId, merged);
    return merged.access_token;
  }
  async function googleFetch(userId: string, path: string, init: RequestInit = {}) {
    const token = await googleAccess(userId);
    if (!token) return new Response("Reconnect required", { status: 401 });
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(`https://www.googleapis.com${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(20_000),
    });
  }

  function hasGoogleFreeBusyScope(tokens: any) {
    return String(tokens?.scope ?? "")
      .split(/\s+/)
      .includes(googleFreeBusyScope);
  }

  async function googleBusy(userId: string, startsAt: string, endsAt: string) {
    const tokens = await googleTokens(userId);
    if (!tokens || !hasGoogleFreeBusyScope(tokens)) return { connected: false, busy: [] };
    const response = await googleFetch(userId, "/calendar/v3/freeBusy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: startsAt, timeMax: endsAt, items: [{ id: "primary" }] }),
    });
    if (!response.ok) return { connected: false, busy: [] };
    const payload = await response.json();
    if (!payload?.calendars?.primary || payload.calendars.primary.errors?.length)
      return { connected: false, busy: [] };
    return {
      connected: true,
      busy: (payload?.calendars?.primary?.busy ?? []).map((item: any) => ({
        startsAt: item.start,
        endsAt: item.end,
      })),
    };
  }

  return {
    googleTokens,
    googleAccess,
    googleFetch,
    googleBusy,
    saveGoogle,
    hasGoogleFreeBusyScope,
  };
}
