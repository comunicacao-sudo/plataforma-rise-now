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
const cfg = () => ({
  base: env("WAHA_BASE_URL")?.replace(/\/$/, ""),
  key: env("WAHA_API_KEY"),
  session: env("WAHA_SESSION_NAME") ?? "rise-principal",
  app: env("APP_BASE_URL") ?? "https://mentoriarisenow.lovable.app",
});

async function send(phone: string, text: string) {
  const c = cfg();
  if (!c.base || !c.key) throw new Error("WAHA não configurado.");
  let digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  const response = await fetch(`${c.base}/api/sendText`, {
    method: "POST",
    headers: { "X-Api-Key": c.key, "Content-Type": "application/json" },
    body: JSON.stringify({ session: c.session, chatId: `${digits}@c.us`, text }),
  });
  if (!response.ok) throw new Error(`WAHA respondeu ${response.status}.`);
}
async function logAndSend(
  eventType: string,
  user: any,
  referenceType: string,
  referenceId: string,
  idempotencyKey: string,
  text: string,
  targetUrl: string,
) {
  if (!user?.phone) return false;
  const { data, error } = await admin
    .from("whatsapp_notifications")
    .insert({
      event_type: eventType,
      recipient_user_id: user.id,
      recipient_role: "mentee",
      phone: user.phone,
      message: text,
      target_url: targetUrl,
      reference_type: referenceType,
      reference_id: referenceId,
      idempotency_key: idempotencyKey,
      status: "pending",
    })
    .select("id")
    .single();
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  try {
    await send(user.phone, text);
    await admin
      .from("whatsapp_notifications")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id);
    return true;
  } catch (e) {
    await admin
      .from("whatsapp_notifications")
      .update({ status: "failed", error_message: e.message })
      .eq("id", data.id);
    return false;
  }
}

async function processStageReleases(settings: any, now: Date) {
  if (!settings.enabled_stage_released) return 0;
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
  const { data: steps, error: stepError } = await admin
    .from("journey_steps")
    .select(
      "version_id, stable_key, title, month_number, release_at, access_scope, cohort_id, mentee_id",
    )
    .in("version_id", [...allVersionIds])
    .is("archived_at", null);
  if (stepError) throw new Error(stepError.message);
  const userIds = [...new Set(enrollments.map((row: any) => row.mentee_id))];
  const { data: users } = await admin
    .from("profiles")
    .select("id, display_name, full_name, phone")
    .in("id", userIds);
  const userById = new Map((users ?? []).map((user: any) => [user.id, user]));
  let attempted = 0;
  for (const enrollment of enrollments) {
    const user = userById.get(enrollment.mentee_id);
    if (!user) continue;
    const versions = versionsByEnrollment.get(enrollment.id) ?? new Set<string>();
    for (const step of steps ?? []) {
      if (
        !versions.has(step.version_id) ||
        (step.release_at && Date.parse(step.release_at) > now.getTime()) ||
        step.month_number > enrollment.current_month
      )
        continue;
      if (step.access_scope === "cohort" && step.cohort_id !== enrollment.cohort_id) continue;
      if (step.access_scope === "mentee" && step.mentee_id !== enrollment.mentee_id) continue;
      const link = `${cfg().app}/?view=jornada&step=${encodeURIComponent(step.stable_key)}`;
      const text = `Olá, ${user.display_name || user.full_name}! ✨\n\nA etapa *${step.title}* já está disponível na sua jornada.\n\nAcesse aqui:\n${link}`;
      attempted += Number(
        await logAndSend(
          "stage_released",
          user,
          "journey_step",
          step.stable_key,
          `stage_released:${enrollment.id}:${step.stable_key}`,
          text,
          link,
        ),
      );
    }
  }
  return attempted;
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

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = env("CRON_SECRET");
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) return new Response("Unauthorized", { status: 401 });
  try {
    const { data: settings } = await admin
      .from("whatsapp_settings")
      .select("*")
      .eq("id", "primary")
      .maybeSingle();
    if (!settings) return Response.json({ ok: true, attempted: 0 });
    const now = new Date();
    let attempted = await processStageReleases(settings, now);
    if (settings.enabled_meeting_reminder) {
      const cutoff = new Date(
        now.getTime() + Number(settings.meeting_reminder_hours ?? 24) * 3600000,
      );
      const { data: meetings } = await admin
        .from("meetings")
        .select("id, title, scheduled_at, audience, cohort_id, enrollment_id")
        .gt("scheduled_at", now.toISOString())
        .lte("scheduled_at", cutoff.toISOString());
      for (const meeting of meetings ?? []) {
        const ids = await meetingEnrollmentIds(meeting);
        const { data: rows } = ids.length
          ? await admin
              .from("enrollments")
              .select(
                "id, mentee:profiles!enrollments_mentee_id_fkey(id, display_name, full_name, phone)",
              )
              .in("id", ids)
              .neq("status", "desativada")
          : { data: [] };
        for (const row of rows ?? []) {
          const u = row.mentee;
          const link = `${cfg().app}/?view=agenda&meeting=${meeting.id}`;
          const when = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(meeting.scheduled_at));
          const text = `Olá, ${u.display_name || u.full_name}! ⏰\n\nLembrete: o encontro *${meeting.title}* está marcado para ${when}.\n\nVeja os detalhes na plataforma:\n${link}`;
          attempted += Number(
            await logAndSend(
              "meeting_reminder",
              u,
              "meeting",
              meeting.id,
              `meeting_reminder:${meeting.id}:${meeting.scheduled_at}:${u.id}`,
              text,
              link,
            ),
          );
        }
      }
    }
    return Response.json({ ok: true, attempted });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "Falha ao processar lembretes." }, { status: 500 });
  }
});
