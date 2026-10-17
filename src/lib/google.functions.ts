import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appUserReconnectRequired,
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import {
  deleteConnectionForUser,
  getConnectionKeyForUser,
  saveConnectionKeyForUser,
} from "./appUserConnections.server";

const GATEWAY = "https://connector-gateway.lovable.dev";
const CONNECTOR = "google_calendar";
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
];

async function assertStaff(supabase: any, userId: string) {
  const [{ data: a }, { data: m }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
  ]);
  if (!a && !m) throw new Error("Acesso restrito à administração RISE NOW.");
  return { isAdmin: !!a || !!m };
}

export const googleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR);
    if (!key) return { connected: false, reconnectRequired: false, email: null as string | null };
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY,
      connectionAPIKey: key,
      connectorId: CONNECTOR,
      path: "/calendar/v3/calendars/primary",
      requiredScopes: SCOPES,
    });
    if (await appUserReconnectRequired(res)) return { connected: false, reconnectRequired: true, email: null };
    if (!res.ok) {
      console.error("google status", res.status, await res.text());
      return { connected: true, reconnectRequired: false, email: null };
    }
    const body = (await res.json()) as { id?: string };
    return { connected: true, reconnectRequired: false, email: body.id ?? null };
  });

export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const clientKey = process.env["GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientKey) throw new Error("Conexão com o Google ainda não configurada.");
    const request = getRequest();
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/oauth/google/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
    const existing = await getConnectionKeyForUser(context.userId, CONNECTOR);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY,
      connectorId: CONNECTOR,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: SCOPES },
    });
    return { authorizationUrl };
  });

export const completeGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY, data.code);
    if (connectorId !== CONNECTOR) throw new Error("Conector inesperado");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR);
    if (key) {
      await disconnectAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey: key, connectorId: CONNECTOR }).catch((e) =>
        console.error(e),
      );
      await deleteConnectionForUser(context.userId, CONNECTOR);
    }
    return { ok: true };
  });

const meetingSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(4000).optional().default(""),
  phaseId: z.string().uuid().nullable(),
  lessonId: z.string().uuid().nullable(),
  mentorId: z.string().uuid().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  audience: z.enum(["all", "cohort", "selected"]),
  cohortId: z.string().uuid().nullable(),
  enrollmentIds: z.array(z.string().uuid()).max(200),
  kind: z.enum(["grupo", "individual"]),
  createMeet: z.boolean(),
  joinUrl: z.string().url().nullable().optional(),
});

export const createMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => meetingSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Who is invited
    let q = supabaseAdmin.from("enrollments").select("id, mentee:profiles!enrollments_mentee_id_fkey(email)").eq("status", "ativa");
    if (data.audience === "cohort") q = q.eq("cohort_id", data.cohortId!);
    if (data.audience === "selected") q = q.in("id", data.enrollmentIds.length ? data.enrollmentIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data: invitees } = await q;
    const emails = (invitees ?? []).map((r: any) => r.mentee?.email).filter(Boolean) as string[];

    let mentorName: string | null = null;
    if (data.mentorId) {
      const { data: p } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", data.mentorId).maybeSingle();
      mentorName = p?.full_name ?? null;
      if (p?.email) emails.push(p.email);
    }

    let joinUrl = data.joinUrl ?? null;
    let googleEventId: string | null = null;
    if (data.createMeet) {
      const key = await getConnectionKeyForUser(context.userId, CONNECTOR);
      if (!key) return { ok: false as const, error: "Conecte sua conta Google antes de gerar a reunião." };
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY,
        connectionAPIKey: key,
        connectorId: CONNECTOR,
        path: "/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
        requiredScopes: SCOPES,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: `RISE NOW · ${data.title}`,
            description: data.description,
            start: { dateTime: data.startsAt, timeZone: "America/Sao_Paulo" },
            end: { dateTime: data.endsAt, timeZone: "America/Sao_Paulo" },
            attendees: [...new Set(emails)].map((email) => ({ email })),
            conferenceData: {
              createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
            },
          }),
        },
      });
      if (await appUserReconnectRequired(res))
        return { ok: false as const, error: "Sua conexão com o Google precisa ser renovada. Clique em Reconectar." };
      if (!res.ok) {
        const t = await res.text();
        console.error("google create event", res.status, t);
        return { ok: false as const, error: `O Google recusou a criação do evento (${res.status}).` };
      }
      const ev = (await res.json()) as { id: string; hangoutLink?: string; htmlLink?: string };
      googleEventId = ev.id;
      joinUrl = ev.hangoutLink ?? joinUrl;
    }

    const minutes = Math.max(15, Math.round((Date.parse(data.endsAt) - Date.parse(data.startsAt)) / 60000));
    const { data: meeting, error } = await context.supabase
      .from("meetings")
      .insert({
        title: data.title,
        description: data.description || null,
        kind: data.kind,
        scheduled_at: data.startsAt,
        ends_at: data.endsAt,
        duration_minutes: minutes,
        join_url: joinUrl,
        audience: data.audience,
        cohort_id: data.audience === "cohort" ? data.cohortId : null,
        mentor_id: data.mentorId,
        mentor_name: mentorName,
        phase_id: data.phaseId,
        lesson_id: data.lessonId,
        google_event_id: googleEventId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.audience === "selected" && data.enrollmentIds.length) {
      const { error: e2 } = await context.supabase
        .from("meeting_attendees")
        .insert(data.enrollmentIds.map((enrollment_id) => ({ meeting_id: meeting.id, enrollment_id })));
      if (e2) throw new Error(e2.message);
    }
    return { ok: true as const, joinUrl };
  });

export const updateMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), recordingUrl: z.string().url().nullable(), joinUrl: z.string().url().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("meetings")
      .update({ recording_url: data.recordingUrl, join_url: data.joinUrl })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: m } = await context.supabase.from("meetings").select("google_event_id, created_by").eq("id", data.id).maybeSingle();
    if (!m) throw new Error("Encontro não encontrado");
    let googleWarning = false;
    if (m.google_event_id && m.created_by) {
      const key = await getConnectionKeyForUser(m.created_by, CONNECTOR);
      if (key) {
        const res = await callAsAppUser({
          gatewayBaseUrl: GATEWAY,
          connectionAPIKey: key,
          connectorId: CONNECTOR,
          path: `/calendar/v3/calendars/primary/events/${encodeURIComponent(m.google_event_id)}?sendUpdates=all`,
          requiredScopes: SCOPES,
          init: { method: "DELETE" },
        });
        if (!res.ok && res.status !== 410 && res.status !== 404) {
          console.error("google delete", res.status, await res.text());
          googleWarning = true;
        }
      } else googleWarning = true;
    }
    const { error } = await context.supabase.from("meetings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, googleWarning };
  });
