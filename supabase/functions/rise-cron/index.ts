// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import {
  WHATSAPP_PENDING_MAX_AGE_MS,
  WHATSAPP_SEND_INTERVAL_MS,
  deliverNotification,
  enqueueNotification,
  gatewayConfig,
  gatewayConfigured,
  getGatewaySession,
  sleep,
  whatsappSettings,
} from "../_shared/whatsapp-gateway.ts";
import { renderTemplate } from "../_shared/whatsapp-templates.ts";
import { runAutomations } from "./automations.ts";

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
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Máximo de mensagens por execução (com 3,5 s de pausa ≈ 70 s de envio). */
const MAX_SENDS_PER_RUN = 20;
/** Etapas liberadas por data só geram aviso se a liberação aconteceu nesta janela. */
const STAGE_RELEASE_WINDOW_MS = 24 * 3_600_000;

const firstName = (user: any) =>
  String(user?.display_name || user?.full_name || "")
    .trim()
    .split(/\s+/)[0] || "";
const link = (params: Record<string, string>) => {
  const target = new URL("/", gatewayConfig().appBase);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.toString();
};

async function queueStageReleases(settings: any, now: Date) {
  const { data: enrollments, error: enrollmentError } = await admin
    .from("enrollments")
    .select("id, mentee_id, program_id, cohort_id, current_month")
    .eq("status", "ativa");
  if (enrollmentError) throw new Error(enrollmentError.message);
  if (!enrollments?.length) return 0;
  const enrollmentIds = enrollments.map((row: any) => row.id);
  const programIds = [...new Set(enrollments.map((row: any) => row.program_id))];
  const [{ data: assignments }, { data: pillars, error: pillarError }] = await Promise.all([
    admin
      .from("enrollment_journey_versions")
      .select("enrollment_id, pillar_id, version_id")
      .in("enrollment_id", enrollmentIds),
    admin
      .from("journey_pillars")
      .select("id, program_id, current_published_version_id")
      .in("program_id", programIds),
  ]);
  if (pillarError) throw new Error(pillarError.message);
  const assigned = new Map(
    (assignments ?? []).map((row: any) => [
      `${row.enrollment_id}:${row.pillar_id}`,
      row.version_id,
    ]),
  );
  const versionsByEnrollment = new Map<string, Set<string>>();
  const allVersionIds = new Set<string>();
  for (const enrollment of enrollments) {
    const versions = new Set<string>();
    for (const pillar of pillars ?? []) {
      if (pillar.program_id !== enrollment.program_id) continue;
      const versionId =
        assigned.get(`${enrollment.id}:${pillar.id}`) ?? pillar.current_published_version_id;
      if (versionId) {
        versions.add(String(versionId));
        allVersionIds.add(String(versionId));
      }
    }
    versionsByEnrollment.set(enrollment.id, versions);
  }
  if (!allVersionIds.size) return 0;

  // Só etapas com data de liberação recente: evita disparar em massa o histórico
  // de etapas antigas na primeira vez que o aviso for ligado.
  const windowStart = new Date(now.getTime() - STAGE_RELEASE_WINDOW_MS).toISOString();
  const { data: steps, error: stepError } = await admin
    .from("journey_steps")
    .select(
      "version_id, stable_key, title, month_number, release_at, access_scope, cohort_id, mentee_id",
    )
    .in("version_id", [...allVersionIds])
    .is("archived_at", null)
    .gt("release_at", windowStart)
    .lte("release_at", now.toISOString());
  if (stepError) throw new Error(stepError.message);
  if (!steps?.length) return 0;

  const userIds = [...new Set(enrollments.map((row: any) => row.mentee_id))];
  const { data: users } = await admin
    .from("profiles")
    .select("id, display_name, full_name, phone")
    .in("id", userIds);
  const userById = new Map((users ?? []).map((user: any) => [user.id, user]));
  let queued = 0;
  for (const enrollment of enrollments) {
    const user = userById.get(enrollment.mentee_id);
    if (!user?.phone) continue;
    const versions = versionsByEnrollment.get(enrollment.id) ?? new Set<string>();
    for (const step of steps) {
      if (!versions.has(step.version_id) || step.month_number > enrollment.current_month) continue;
      if (step.access_scope === "cohort" && step.cohort_id !== enrollment.cohort_id) continue;
      if (step.access_scope === "mentee" && step.mentee_id !== enrollment.mentee_id) continue;
      const url = link({ view: "jornada", step: step.stable_key });
      const row = await enqueueNotification(admin, {
        eventType: "stage_released",
        recipientId: user.id,
        recipientRole: "mentee",
        phone: user.phone,
        referenceType: "journey_step",
        referenceId: step.stable_key,
        idempotencyKey: `stage_released:${enrollment.id}:${step.stable_key}`,
        targetUrl: url,
        message: renderTemplate("stage_released", settings.message_templates, {
          nome: firstName(user),
          etapa: step.title,
          link: url,
        }),
      });
      queued += Number(!!row);
    }
  }
  return queued;
}

async function meetingEnrollmentIds(meeting: any) {
  if (meeting.enrollment_id) return [meeting.enrollment_id];
  if (meeting.audience === "selected") {
    const { data } = await admin
      .from("meeting_attendees")
      .select("enrollment_id")
      .eq("meeting_id", meeting.id);
    return (data ?? []).map((row: any) => row.enrollment_id);
  }
  let query = admin.from("enrollments").select("id").eq("status", "ativa");
  if (meeting.audience === "cohort" && meeting.cohort_id)
    query = query.eq("cohort_id", meeting.cohort_id);
  const { data } = await query;
  return (data ?? []).map((row: any) => row.id);
}

async function queueMeetingReminders(settings: any, now: Date) {
  const cutoff = new Date(
    now.getTime() + Number(settings.meeting_reminder_hours ?? 24) * 3_600_000,
  );
  const { data: meetings, error } = await admin
    .from("meetings")
    .select("id, title, scheduled_at, audience, cohort_id, enrollment_id, mentor_id, created_by")
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", cutoff.toISOString());
  if (error) throw new Error(error.message);
  const when = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(new Date(iso))
      .replace(",", " às");
  const toMentees = !!settings.enabled_meeting_reminder;
  const toMentors = !!settings.enabled_meeting_reminder_mentor;
  let queued = 0;
  for (const meeting of meetings ?? []) {
    const ids = await meetingEnrollmentIds(meeting);
    const { data: rows } = ids.length
      ? await admin
          .from("enrollments")
          .select(
            "id, mentee:profiles!enrollments_mentee_id_fkey(id, display_name, full_name, phone)",
          )
          .in("id", ids)
          .eq("status", "ativa")
      : { data: [] };

    // Lembrete para a mentora responsável (ou quem criou o encontro).
    const mentorId = meeting.mentor_id ?? meeting.created_by;
    if (toMentors && mentorId) {
      const { data: mentor } = await admin
        .from("profiles")
        .select("id, display_name, full_name, phone")
        .eq("id", mentorId)
        .maybeSingle();
      if (mentor?.phone) {
        const url = link({ view: "agenda", meeting: meeting.id });
        const total = (rows ?? []).length;
        const created = await enqueueNotification(admin, {
          eventType: "meeting_reminder_mentor",
          recipientId: mentor.id,
          recipientRole: "mentor",
          phone: mentor.phone,
          referenceType: "meeting",
          referenceId: meeting.id,
          idempotencyKey: `meeting_reminder_mentor:${meeting.id}:${meeting.scheduled_at}:${mentor.id}`,
          targetUrl: url,
          message: renderTemplate("meeting_reminder_mentor", settings.message_templates, {
            nome: firstName(mentor),
            encontro: meeting.title,
            data: when(meeting.scheduled_at),
            participantes: total === 1 ? "1 mentorada" : `${total} mentoradas`,
            link: url,
          }),
        });
        queued += Number(!!created);
      }
    }

    if (!toMentees) continue;
    for (const row of rows ?? []) {
      const user = row.mentee;
      if (!user?.phone) continue;
      const url = link({ view: "agenda", meeting: meeting.id });
      const created = await enqueueNotification(admin, {
        eventType: "meeting_reminder",
        recipientId: user.id,
        recipientRole: "mentee",
        phone: user.phone,
        referenceType: "meeting",
        referenceId: meeting.id,
        idempotencyKey: `meeting_reminder:${meeting.id}:${meeting.scheduled_at}:${user.id}`,
        targetUrl: url,
        message: renderTemplate("meeting_reminder", settings.message_templates, {
          nome: firstName(user),
          encontro: meeting.title,
          data: when(meeting.scheduled_at),
          link: url,
        }),
      });
      queued += Number(!!created);
    }
  }
  return queued;
}

/** Envia as pendentes em fila, uma por vez, com pausa entre elas. */
async function deliverPending(now: Date) {
  const oldest = new Date(now.getTime() - WHATSAPP_PENDING_MAX_AGE_MS).toISOString();
  // Pendentes antigas demais (ex.: lembrete de encontro que já passou) expiram.
  await admin
    .from("whatsapp_notifications")
    .update({ status: "failed", error_message: "Expirou sem conexão com o WhatsApp." })
    .eq("status", "pending")
    .lt("created_at", oldest);
  const { data: pending, error } = await admin
    .from("whatsapp_notifications")
    .select("id, phone, chat_id, message, updated_at")
    .eq("status", "pending")
    .gte("created_at", oldest)
    .order("created_at", { ascending: true })
    .limit(MAX_SENDS_PER_RUN);
  if (error) throw new Error(error.message);
  const result = { sent: 0, failed: 0 };
  for (const [index, row] of (pending ?? []).entries()) {
    if (index > 0) await sleep(WHATSAPP_SEND_INTERVAL_MS);
    const outcome = await deliverNotification(admin, row);
    if (outcome === "sent") result.sent += 1;
    if (outcome === "failed") result.failed += 1;
  }
  return result;
}

/**
 * Segredo do agendamento: usa o secret CRON_SECRET se existir; senão, o valor
 * guardado no Vault do banco (migration 0043), o mesmo que o pg_cron envia.
 */
let vaultSecret: string | null = null;
async function expectedCronSecret() {
  const fromEnv = env("CRON_SECRET");
  if (fromEnv) return fromEnv;
  if (vaultSecret) return vaultSecret;
  const { data, error } = await admin.rpc("rise_cron_secret");
  if (error) {
    console.error("[rise-cron] Falha ao ler o segredo do Vault", error.message);
    return null;
  }
  vaultSecret = typeof data === "string" && data.length >= 32 ? data : null;
  return vaultSecret;
}

function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = await expectedCronSecret();
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided || !sameSecret(provided, expected))
    return new Response("Unauthorized", { status: 401 });
  // Avança o mês da jornada de cada mentorada pela data de início (migration 0046).
  const months = await admin.rpc("refresh_journey_months");
  if (months.error) console.error("[rise-cron] mês da jornada", months.error.message);
  if (!gatewayConfigured())
    return Response.json({ ok: true, providerConfigured: false, queued: 0, sent: 0 });
  try {
    const settings = await whatsappSettings(admin);
    if (!settings) return Response.json({ ok: true, queued: 0, sent: 0 });
    const now = new Date();
    let queued = 0;
    if (settings.enabled_stage_released) queued += await queueStageReleases(settings, now);
    if (settings.enabled_meeting_reminder || settings.enabled_meeting_reminder_mentor)
      queued += await queueMeetingReminders(settings, now);
    queued += await runAutomations(admin, settings, now);

    // Confere a conexão antes de enviar: se o número caiu, as mensagens ficam pendentes.
    const session = await getGatewaySession().catch(() => null);
    if (session?.status !== "ready")
      return Response.json({
        ok: true,
        queued,
        sent: 0,
        sessionStatus: session?.status ?? "unreachable",
        message: "WhatsApp desconectado; mensagens mantidas na fila.",
      });
    const { sent, failed } = await deliverPending(now);
    return Response.json({ ok: true, queued, sent, failed, sessionStatus: session.status });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "Falha ao processar notificações." }, { status: 500 });
  }
});
