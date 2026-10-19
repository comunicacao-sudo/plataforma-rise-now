/* eslint-disable @typescript-eslint/no-explicit-any -- Migration 0017 is not part of the generated remote types yet. */
import { createHmac, timingSafeEqual } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildAppLink,
  normalizeBrazilianPhone,
  renderWhatsAppMessage,
  type WhatsAppEventType,
} from "@/lib/whatsapp-templates";

const DEFAULT_SESSION = "rise-principal";
const DEFAULT_ENGINE = "GOWS";

export type WhatsAppSettings = {
  accountCreated: boolean;
  meetingReminder: boolean;
  stageReleased: boolean;
  stageCompletedMentee: boolean;
  stageCompletedMentor: boolean;
  meetingReminderHours: number;
};

export type WhatsAppSessionState = {
  name: string;
  engine: string;
  status: string;
  phone: string | null;
};

type NotificationRecipient = {
  userId: string;
  role: "mentee" | "mentor" | "admin";
  name: string;
  phone: string | null;
};

type SendNotificationInput = {
  type: WhatsAppEventType;
  recipient: NotificationRecipient;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  actionUrl: string;
  template: {
    actorName?: string;
    title?: string;
    startsAt?: string;
  };
  /** Secure Supabase links are sent, but never persisted in the notification log. */
  sensitiveActionUrl?: boolean;
};

type WahaMessageResponse = {
  id?: string;
  key?: { id?: string };
  _data?: { id?: { id?: string } | string };
};

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getWahaConfig() {
  const baseUrl = env("WAHA_BASE_URL")?.replace(/\/$/, "") ?? null;
  const apiKey = env("WAHA_API_KEY");
  const sessionName = env("WAHA_SESSION_NAME") ?? DEFAULT_SESSION;
  const appBaseUrl = env("APP_BASE_URL")?.replace(/\/$/, "") ?? null;
  return {
    baseUrl,
    apiKey,
    sessionName,
    appBaseUrl,
    engine: DEFAULT_ENGINE,
    configured: !!baseUrl && !!apiKey && !!appBaseUrl && sessionName === DEFAULT_SESSION,
  };
}

function defaultSettings(): WhatsAppSettings {
  return {
    accountCreated: false,
    meetingReminder: false,
    stageReleased: false,
    stageCompletedMentee: false,
    stageCompletedMentor: false,
    meetingReminderHours: 24,
  };
}

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  const { data, error } = await (supabaseAdmin as any)
    .from("whatsapp_settings")
    .select(
      "enabled_account_created, enabled_meeting_reminder, enabled_stage_released, enabled_stage_completed_mentee, enabled_stage_completed_mentor, meeting_reminder_hours",
    )
    .eq("id", "primary")
    .maybeSingle();
  if (error) {
    console.error("[WhatsApp] Could not load settings", error.message);
    return defaultSettings();
  }
  if (!data) return defaultSettings();
  return {
    accountCreated: !!data.enabled_account_created,
    meetingReminder: !!data.enabled_meeting_reminder,
    stageReleased: !!data.enabled_stage_released,
    stageCompletedMentee: !!data.enabled_stage_completed_mentee,
    stageCompletedMentor: !!data.enabled_stage_completed_mentor,
    meetingReminderHours: Number(data.meeting_reminder_hours) || 24,
  };
}

function eventEnabled(settings: WhatsAppSettings, type: WhatsAppEventType): boolean {
  const enabled: Record<WhatsAppEventType, boolean> = {
    account_created: settings.accountCreated,
    meeting_reminder: settings.meetingReminder,
    stage_released: settings.stageReleased,
    stage_completed_mentee: settings.stageCompletedMentee,
    stage_completed_mentor: settings.stageCompletedMentor,
  };
  return enabled[type];
}

async function wahaFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = getWahaConfig();
  if (!config.configured || !config.baseUrl || !config.apiKey) {
    throw new Error("Integração com WhatsApp ainda não configurada no servidor.");
  }
  const headers = new Headers(init.headers);
  headers.set("X-Api-Key", config.apiKey);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
}

async function parseWahaError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  return body ? `WAHA ${response.status}: ${body.slice(0, 300)}` : `WAHA ${response.status}`;
}

export function getWhatsAppRuntimeConfig() {
  const config = getWahaConfig();
  return {
    configured: config.configured,
    sessionName: config.sessionName,
    engine: config.engine,
    appBaseUrl: config.appBaseUrl,
  };
}

export async function getWhatsAppSessionState(): Promise<WhatsAppSessionState> {
  const config = getWahaConfig();
  if (!config.configured) {
    return {
      name: config.sessionName,
      engine: config.engine,
      status: "NOT_CONFIGURED",
      phone: null,
    };
  }
  try {
    const response = await wahaFetch(`/api/sessions/${encodeURIComponent(config.sessionName)}`);
    if (response.status === 404) {
      return { name: config.sessionName, engine: config.engine, status: "STOPPED", phone: null };
    }
    if (!response.ok) throw new Error(await parseWahaError(response));
    const body = (await response.json()) as {
      name?: string;
      status?: string;
      engine?: string;
      me?: { id?: string };
    };
    return {
      name: body.name ?? config.sessionName,
      engine: body.engine ?? config.engine,
      status: body.status ?? "UNKNOWN",
      phone: body.me?.id?.replace(/@.+$/, "") ?? null,
    };
  } catch (error) {
    console.error("[WhatsApp] Session status failed", error);
    return { name: config.sessionName, engine: config.engine, status: "UNAVAILABLE", phone: null };
  }
}

export async function startWhatsAppSessionOnWaha(): Promise<void> {
  const config = getWahaConfig();
  const current = await getWhatsAppSessionState();
  if (current.status === "NOT_CONFIGURED") throw new Error("Configure o servidor WAHA primeiro.");
  let response: Response;
  if (current.status === "STOPPED" && current.phone === null) {
    response = await wahaFetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name: config.sessionName, start: true }),
    });
    if (response.status === 409) {
      response = await wahaFetch(`/api/sessions/${encodeURIComponent(config.sessionName)}/start`, {
        method: "POST",
      });
    }
  } else {
    response = await wahaFetch(`/api/sessions/${encodeURIComponent(config.sessionName)}/start`, {
      method: "POST",
    });
  }
  if (!response.ok && response.status !== 409) throw new Error(await parseWahaError(response));
}

export async function restartWhatsAppSessionOnWaha(): Promise<void> {
  const config = getWahaConfig();
  const response = await wahaFetch(
    `/api/sessions/${encodeURIComponent(config.sessionName)}/restart`,
    { method: "POST" },
  );
  if (!response.ok) throw new Error(await parseWahaError(response));
}

export async function disconnectWhatsAppSessionOnWaha(): Promise<void> {
  const config = getWahaConfig();
  const response = await wahaFetch(
    `/api/sessions/${encodeURIComponent(config.sessionName)}/logout`,
    { method: "POST" },
  );
  if (!response.ok && response.status !== 404) throw new Error(await parseWahaError(response));
}

export async function getWhatsAppQrDataUrl(): Promise<string | null> {
  const config = getWahaConfig();
  if (!config.configured) return null;
  const response = await wahaFetch(`/api/${encodeURIComponent(config.sessionName)}/auth/qr`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { data?: string; value?: string; mimetype?: string };
    const raw = body.data ?? body.value;
    if (!raw) return null;
    return raw.startsWith("data:") ? raw : `data:${body.mimetype ?? "image/png"};base64,${raw}`;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType || "image/png"};base64,${bytes.toString("base64")}`;
}

function providerMessageId(body: WahaMessageResponse): string | null {
  if (body.id) return body.id;
  if (body.key?.id) return body.key.id;
  if (typeof body._data?.id === "string") return body._data.id;
  return body._data?.id?.id ?? null;
}

async function sendText(phone: string, text: string): Promise<string | null> {
  const normalized = normalizeBrazilianPhone(phone);
  if (!normalized) throw new Error("Telefone brasileiro inválido ou ausente.");
  const { sessionName } = getWahaConfig();
  const response = await wahaFetch("/api/sendText", {
    method: "POST",
    body: JSON.stringify({ chatId: normalized.chatId, text, session: sessionName }),
  });
  if (!response.ok) throw new Error(await parseWahaError(response));
  return providerMessageId((await response.json()) as WahaMessageResponse);
}

async function insertNotificationLog(input: {
  notification: SendNotificationInput;
  phone: string | null;
  message: string;
  targetUrl: string;
  status: "pending" | "failed";
  errorMessage?: string;
}): Promise<{ id: string } | null> {
  const { notification } = input;
  const { data, error } = await (supabaseAdmin as any)
    .from("whatsapp_notifications")
    .insert({
      recipient_user_id: notification.recipient.userId,
      recipient_role: notification.recipient.role,
      phone: input.phone,
      event_type: notification.type,
      reference_type: notification.referenceType,
      reference_id: notification.referenceId,
      message: input.message,
      target_url: input.targetUrl,
      status: input.status,
      error_message: input.errorMessage ?? null,
      idempotency_key: notification.idempotencyKey,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return null;
  if (error) throw new Error(error.message);
  return data as { id: string };
}

export async function sendTransactionalWhatsApp(
  input: SendNotificationInput,
): Promise<{ sent: boolean; reason?: string }> {
  const settings = await getWhatsAppSettings();
  if (!eventEnabled(settings, input.type)) return { sent: false, reason: "disabled" };

  const runtime = getWahaConfig();
  const safeTarget = input.sensitiveActionUrl
    ? buildAppLink(runtime.appBaseUrl ?? "https://mentoriarisenow.lovable.app", "/reset-password")
    : input.actionUrl;
  const message = renderWhatsAppMessage({
    type: input.type,
    recipientName: input.recipient.name,
    actorName: input.template.actorName ?? null,
    title: input.template.title ?? null,
    startsAt: input.template.startsAt ?? null,
    actionUrl: input.actionUrl,
  });
  const safeMessage = input.sensitiveActionUrl
    ? renderWhatsAppMessage({
        type: input.type,
        recipientName: input.recipient.name,
        actorName: input.template.actorName ?? null,
        title: input.template.title ?? null,
        startsAt: input.template.startsAt ?? null,
        actionUrl: safeTarget,
      })
    : message;
  const normalized = normalizeBrazilianPhone(input.recipient.phone ?? "");
  if (!normalized) {
    await insertNotificationLog({
      notification: input,
      phone: input.recipient.phone,
      message: safeMessage,
      targetUrl: safeTarget,
      status: "failed",
      errorMessage: "Telefone brasileiro inválido ou ausente.",
    }).catch((error) => console.error("[WhatsApp] Could not log missing phone", error));
    return { sent: false, reason: "missing_phone" };
  }

  const log = await insertNotificationLog({
    notification: input,
    phone: normalized.e164,
    message: safeMessage,
    targetUrl: safeTarget,
    status: "pending",
  });
  if (!log) return { sent: false, reason: "duplicate" };

  try {
    const id = await sendText(normalized.e164, message);
    await (supabaseAdmin as any)
      .from("whatsapp_notifications")
      .update({
        status: "sent",
        provider_message_id: id,
        sent_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", log.id);
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Falha desconhecida no envio.";
    await (supabaseAdmin as any)
      .from("whatsapp_notifications")
      .update({ status: "failed", error_message: reason, updated_at: new Date().toISOString() })
      .eq("id", log.id);
    console.error("[WhatsApp] Transactional send failed", reason);
    return { sent: false, reason };
  }
}

async function getProfileRecipient(
  userId: string,
  role: NotificationRecipient["role"],
): Promise<NotificationRecipient | null> {
  const { data } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, full_name, display_name, phone")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: data.id,
    role,
    name: data.display_name || data.full_name || "Participante RISE",
    phone: data.phone,
  };
}

export async function getMentorsForMentee(
  menteeId: string,
  stepKey?: string,
): Promise<NotificationRecipient[]> {
  const ids = new Set<string>();
  const { data: enrollments } = await (supabaseAdmin as any)
    .from("enrollments")
    .select("mentor_id")
    .eq("mentee_id", menteeId)
    .neq("status", "desativada");
  for (const enrollment of enrollments ?? []) {
    if (enrollment.mentor_id) ids.add(enrollment.mentor_id);
  }
  if (stepKey) {
    const { data: rows } = await (supabaseAdmin as any)
      .from("journey_steps")
      .select("version:journey_versions!inner(pillar:journey_pillars!inner(mentor_id))")
      .eq("stable_key", stepKey)
      .limit(20);
    for (const row of rows ?? []) {
      const mentorId = row.version?.pillar?.mentor_id;
      if (mentorId) ids.add(mentorId);
    }
  }
  const recipients = await Promise.all([...ids].map((id) => getProfileRecipient(id, "mentor")));
  return recipients.filter((item): item is NotificationRecipient => !!item);
}

function appUrl(path: string, params?: Record<string, string>): string {
  const base = getWahaConfig().appBaseUrl ?? "https://mentoriarisenow.lovable.app";
  return buildAppLink(base, path, params);
}

export async function notifyAccountCreated(input: {
  userId: string;
  fullName: string;
  phone: string | null;
  role: NotificationRecipient["role"];
  secureActionUrl: string;
}) {
  return sendTransactionalWhatsApp({
    type: "account_created",
    recipient: {
      userId: input.userId,
      role: input.role,
      name: input.fullName,
      phone: input.phone,
    },
    referenceType: "auth_user",
    referenceId: input.userId,
    idempotencyKey: `account_created:${input.userId}`,
    actionUrl: input.secureActionUrl,
    sensitiveActionUrl: true,
    template: {},
  });
}

export async function notifyStageCompleted(input: {
  enrollmentId: string;
  menteeId: string;
  stepKey: string;
}) {
  const [{ data: step }, mentee, mentors] = await Promise.all([
    (supabaseAdmin as any)
      .from("journey_steps")
      .select("title")
      .eq("stable_key", input.stepKey)
      .limit(1)
      .maybeSingle(),
    getProfileRecipient(input.menteeId, "mentee"),
    getMentorsForMentee(input.menteeId, input.stepKey),
  ]);
  const title = step?.title ?? "Etapa da jornada";
  const menteeActionUrl = appUrl("/", { view: "jornada", step: input.stepKey });
  const mentorActionUrl = appUrl("/", { view: "gestao-jornada", step: input.stepKey });
  const tasks: Array<Promise<unknown>> = [];
  if (mentee) {
    tasks.push(
      sendTransactionalWhatsApp({
        type: "stage_completed_mentee",
        recipient: mentee,
        referenceType: "journey_step",
        referenceId: input.stepKey,
        idempotencyKey: `stage_completed_mentee:${input.enrollmentId}:${input.stepKey}`,
        actionUrl: menteeActionUrl,
        template: { title },
      }),
    );
  }
  for (const mentor of mentors) {
    tasks.push(
      sendTransactionalWhatsApp({
        type: "stage_completed_mentor",
        recipient: mentor,
        referenceType: "journey_step",
        referenceId: input.stepKey,
        idempotencyKey: `stage_completed_mentor:${input.enrollmentId}:${input.stepKey}:${mentor.userId}`,
        actionUrl: mentorActionUrl,
        template: { title, actorName: mentee?.name ?? "A mentorada" },
      }),
    );
  }
  await Promise.all(tasks);
}

type ReleaseStep = {
  stable_key: string;
  title: string;
  month_number: number;
  release_at: string | null;
  access_scope: "general" | "cohort" | "mentee";
  cohort_id: string | null;
  mentee_id: string | null;
};

function releasedNow(step: ReleaseStep, now: number): boolean {
  return !step.release_at || Date.parse(step.release_at) <= now;
}

export async function notifyNewlyReleasedSteps(input: {
  previousVersionId: string | null;
  newVersionId: string;
  pillarId: string;
  applyActive: boolean;
}) {
  if (!input.applyActive || !input.previousVersionId) return;
  const { data: pillar } = await (supabaseAdmin as any)
    .from("journey_pillars")
    .select("program_id")
    .eq("id", input.pillarId)
    .maybeSingle();
  if (!pillar?.program_id) return;
  const [{ data: previous }, { data: current }, { data: enrollments }] = await Promise.all([
    (supabaseAdmin as any)
      .from("journey_steps")
      .select("stable_key, title, month_number, release_at, access_scope, cohort_id, mentee_id")
      .eq("version_id", input.previousVersionId)
      .is("archived_at", null),
    (supabaseAdmin as any)
      .from("journey_steps")
      .select("stable_key, title, month_number, release_at, access_scope, cohort_id, mentee_id")
      .eq("version_id", input.newVersionId)
      .is("archived_at", null),
    (supabaseAdmin as any)
      .from("enrollments")
      .select("id, mentee_id, cohort_id, current_month")
      .eq("program_id", pillar.program_id)
      .eq("status", "ativa"),
  ]);
  const oldByKey = new Map<string, ReleaseStep>(
    ((previous ?? []) as ReleaseStep[]).map((step) => [step.stable_key, step]),
  );
  const now = Date.now();
  const newlyReleased = ((current ?? []) as ReleaseStep[]).filter((step) => {
    if (!releasedNow(step, now)) return false;
    const old = oldByKey.get(step.stable_key);
    return !old || !releasedNow(old, now);
  });
  for (const enrollment of enrollments ?? []) {
    const recipient = await getProfileRecipient(enrollment.mentee_id, "mentee");
    if (!recipient) continue;
    for (const step of newlyReleased) {
      if (step.month_number > enrollment.current_month) continue;
      if (step.access_scope === "cohort" && step.cohort_id !== enrollment.cohort_id) continue;
      if (step.access_scope === "mentee" && step.mentee_id !== enrollment.mentee_id) continue;
      const actionUrl = appUrl("/", { view: "jornada", step: step.stable_key });
      await sendTransactionalWhatsApp({
        type: "stage_released",
        recipient,
        referenceType: "journey_step",
        referenceId: step.stable_key,
        idempotencyKey: `stage_released:${enrollment.id}:${step.stable_key}`,
        actionUrl,
        template: { title: step.title },
      });
    }
  }
}

export async function processScheduledStageReleases(now = new Date()) {
  const settings = await getWhatsAppSettings();
  if (!settings.stageReleased) return { steps: 0, attempted: 0 };
  const { data: enrollments, error: enrollmentError } = await (supabaseAdmin as any)
    .from("enrollments")
    .select("id, mentee_id, program_id, cohort_id, current_month")
    .eq("status", "ativa");
  if (enrollmentError) throw new Error(enrollmentError.message);
  if (!enrollments?.length) return { steps: 0, attempted: 0 };

  const enrollmentIds = enrollments.map((row: any) => row.id);
  const programIds = [...new Set(enrollments.map((row: any) => row.program_id))];
  const [{ data: assignments }, { data: pillars, error: pillarError }] = await Promise.all([
    (supabaseAdmin as any)
      .from("enrollment_journey_versions")
      .select("enrollment_id, pillar_id, version_id")
      .in("enrollment_id", enrollmentIds),
    (supabaseAdmin as any)
      .from("journey_pillars")
      .select("id, program_id, current_published_version_id")
      .in("program_id", programIds),
  ]);
  if (pillarError) throw new Error(pillarError.message);
  const assignedVersion = new Map<string, string>(
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
        assignedVersion.get(`${enrollment.id}:${pillar.id}`) ?? pillar.current_published_version_id;
      if (versionId) {
        versions.add(versionId);
        allVersionIds.add(versionId);
      }
    }
    versionsByEnrollment.set(enrollment.id, versions);
  }
  if (!allVersionIds.size) return { steps: 0, attempted: 0 };

  const { data: steps, error: stepError } = await (supabaseAdmin as any)
    .from("journey_steps")
    .select(
      "version_id, stable_key, title, month_number, release_at, access_scope, cohort_id, mentee_id",
    )
    .in("version_id", [...allVersionIds])
    .is("archived_at", null);
  if (stepError) throw new Error(stepError.message);

  let attempted = 0;
  for (const enrollment of enrollments) {
    const recipient = await getProfileRecipient(enrollment.mentee_id, "mentee");
    if (!recipient) continue;
    const versions = versionsByEnrollment.get(enrollment.id) ?? new Set<string>();
    for (const step of (steps ?? []) as Array<ReleaseStep & { version_id: string }>) {
      if (
        !versions.has(step.version_id) ||
        !releasedNow(step, now.getTime()) ||
        step.month_number > enrollment.current_month
      )
        continue;
      if (step.access_scope === "cohort" && step.cohort_id !== enrollment.cohort_id) continue;
      if (step.access_scope === "mentee" && step.mentee_id !== enrollment.mentee_id) continue;
      attempted += 1;
      await sendTransactionalWhatsApp({
        type: "stage_released",
        recipient,
        referenceType: "journey_step",
        referenceId: step.stable_key,
        idempotencyKey: `stage_released:${enrollment.id}:${step.stable_key}`,
        actionUrl: appUrl("/", { view: "jornada", step: step.stable_key }),
        template: { title: step.title },
      });
    }
  }
  return { steps: steps?.length ?? 0, attempted };
}

async function meetingEnrollmentIds(meeting: any): Promise<string[]> {
  if (meeting.enrollment_id) return [meeting.enrollment_id];
  if (meeting.audience === "selected") {
    const { data } = await (supabaseAdmin as any)
      .from("meeting_attendees")
      .select("enrollment_id")
      .eq("meeting_id", meeting.id);
    return (data ?? []).map((row: any) => row.enrollment_id);
  }
  let query = (supabaseAdmin as any).from("enrollments").select("id").eq("status", "ativa");
  if (meeting.audience === "cohort" && meeting.cohort_id) {
    query = query.eq("cohort_id", meeting.cohort_id);
  }
  const { data } = await query;
  return (data ?? []).map((row: any) => row.id);
}

export async function processMeetingReminders(now = new Date()) {
  const settings = await getWhatsAppSettings();
  if (!settings.meetingReminder) return { meetings: 0, attempted: 0 };
  const cutoff = new Date(now.getTime() + settings.meetingReminderHours * 60 * 60 * 1000);
  const { data: meetings, error } = await (supabaseAdmin as any)
    .from("meetings")
    .select("id, title, scheduled_at, audience, cohort_id, enrollment_id")
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", cutoff.toISOString())
    .order("scheduled_at");
  if (error) throw new Error(error.message);
  let attempted = 0;
  for (const meeting of meetings ?? []) {
    const enrollmentIds = await meetingEnrollmentIds(meeting);
    if (!enrollmentIds.length) continue;
    const { data: enrollmentRows } = await (supabaseAdmin as any)
      .from("enrollments")
      .select("id, mentee_id")
      .in("id", enrollmentIds)
      .neq("status", "desativada");
    for (const enrollment of enrollmentRows ?? []) {
      const recipient = await getProfileRecipient(enrollment.mentee_id, "mentee");
      if (!recipient) continue;
      attempted += 1;
      await sendTransactionalWhatsApp({
        type: "meeting_reminder",
        recipient,
        referenceType: "meeting",
        referenceId: meeting.id,
        idempotencyKey: `meeting_reminder:${meeting.id}:${meeting.scheduled_at}:${recipient.userId}`,
        actionUrl: appUrl("/", { view: "agenda", meeting: meeting.id }),
        template: { title: meeting.title, startsAt: meeting.scheduled_at },
      });
    }
  }
  return { meetings: meetings?.length ?? 0, attempted };
}

export async function sendWhatsAppTestMessage(phone: string, message: string) {
  const normalized = normalizeBrazilianPhone(phone);
  if (!normalized) throw new Error("Informe um telefone brasileiro válido.");
  await sendText(normalized.e164, message);
}

export function verifyWahaWebhookSignature(rawBody: string, signature: string | null): boolean {
  const key = env("WAHA_WEBHOOK_HMAC_KEY");
  if (!key || !signature) return false;
  const expected = createHmac("sha512", key).update(rawBody, "utf8").digest("hex");
  const provided = signature.trim().toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(provided)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
}

export async function applyWahaAcknowledgement(payload: {
  event?: string;
  session?: string;
  payload?: { id?: string; ack?: number; ackName?: string };
}) {
  const config = getWahaConfig();
  if (payload.event !== "message.ack" || payload.session !== config.sessionName) return;
  const id = payload.payload?.id;
  if (!id) return;
  const ack = payload.payload?.ack ?? 0;
  const status = ack >= 3 ? "read" : ack >= 2 ? "delivered" : ack >= 1 ? "sent" : null;
  if (!status) return;
  await (supabaseAdmin as any)
    .from("whatsapp_notifications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("provider_message_id", id);
}
