// @ts-nocheck
/**
 * Motor das automações de WhatsApp. Roda a cada execução do rise-cron (5 min):
 * para cada automação ligada, encontra o que aconteceu (ou vai acontecer) e
 * coloca as mensagens na fila. O envio em si fica com deliverPending, em fila,
 * com pausa entre mensagens. Chaves de idempotência impedem envios repetidos.
 */
import { enqueueNotification, gatewayConfig } from "../_shared/whatsapp-gateway.ts";
import { checkedDb } from "../_shared/checked-db.ts";
import { computeBookingSlots } from "../_shared/booking-slots.ts";
import { googleCalendarClient } from "../_shared/google-calendar.ts";
import {
  formatDayMonth,
  formatHour,
  formatScheduleLines,
  nextWeekRange,
  renderAutomation,
  saoPauloParts,
  weeklyIsDue,
} from "../_shared/whatsapp-automations.ts";

/** Lembretes "X antes" são enviados se o momento certo caiu nos últimos 30 min. */
const DUE_WINDOW_MS = 30 * 60_000;
/** Eventos mais antigos que isso não geram aviso (evita enxurrada ao ligar). */
const MAX_EVENT_LOOKBACK_MS = 6 * 3_600_000;
/** Sobreposição entre execuções para não perder eventos na borda. */
const OVERLAP_MS = 10 * 60_000;

const firstName = (person: any) =>
  String(person?.display_name || person?.full_name || "")
    .trim()
    .split(/\s+/)[0] || "";
const fullName = (person: any) =>
  String(person?.display_name || person?.full_name || "").trim() || "Uma mentorada";

function appLink(params: Record<string, string> = {}) {
  const target = new URL("/", gatewayConfig().appBase);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.toString();
}

export async function runAutomations(admin: any, settings: any, now: Date) {
  admin = checkedDb(admin);
  const { data: automations, error } = await admin
    .from("whatsapp_automations")
    .select("*")
    .is("deleted_at", null)
    .eq("enabled", true);
  if (error) {
    throw new Error(error.message);
  }
  const ctx = new Context(admin, settings, now);
  let queued = 0;
  const failures: string[] = [];
  for (const automation of automations ?? []) {
    try {
      queued += await ctx.run(automation);
      await admin
        .from("whatsapp_automations")
        .update({ last_run_at: now.toISOString() })
        .is("deleted_at", null)
        .eq("id", automation.id);
    } catch (runError) {
      console.error(`[automações] ${automation.name} falhou`, runError);
      failures.push(automation.id);
    }
  }
  if (failures.length)
    throw new Error(
      `Falha em ${failures.length} automação(ões); cursores preservados para recuperação.`,
    );
  return queued;
}

class Context {
  private profiles = new Map<string, any>();
  private staffCache: any[] | null = null;

  constructor(
    private admin: any,
    private settings: any,
    private now: Date,
  ) {}

  /** Início da janela de eventos desta automação. */
  private since(a: any) {
    const enabledAt = Date.parse(a.enabled_at ?? a.updated_at ?? a.created_at);
    const lastRun = a.last_run_at ? Date.parse(a.last_run_at) - OVERLAP_MS : enabledAt;
    const floor = a.last_run_at ? enabledAt : this.now.getTime() - MAX_EVENT_LOOKBACK_MS;
    return new Date(Math.max(enabledAt, lastRun, floor)).toISOString();
  }

  async run(a: any): Promise<number> {
    switch (a.trigger) {
      case "weekly_schedule":
        return this.weeklySchedule(a);
      case "group_meeting_before":
        return this.groupMeetingBefore(a);
      case "booking_before":
        return this.bookingBefore(a);
      case "booking_confirmed":
        return this.bookingConfirmed(a);
      case "booking_slots_available":
        return this.bookingSlotsAvailable(a);
      case "questionnaire_submitted":
        return this.questionnaireSubmitted(a);
      case "assessment_completed":
        return this.assessmentCompleted(a);
      case "goal_created":
        return this.goalCreated(a);
      case "stage_completed":
        return this.stageCompleted(a);
      case "account_created":
        return this.accountCreated(a);
      default:
        return 0;
    }
  }

  // ---------- destinatários ----------

  private async profile(id: string | null | undefined) {
    if (!id) return null;
    if (this.profiles.has(id)) return this.profiles.get(id);
    const { data } = await this.admin
      .from("profiles")
      .select("id, display_name, full_name, phone, email")
      .eq("id", id)
      .maybeSingle();
    this.profiles.set(id, data ?? null);
    return data ?? null;
  }

  private async staff() {
    if (this.staffCache) return this.staffCache;
    const { data } = await this.admin
      .from("user_roles")
      .select("role, profile:profiles(id, display_name, full_name, phone, email)")
      .in("role", ["mentor", "admin"]);
    const unique = new Map<string, any>();
    for (const row of data ?? []) if (row.profile?.id) unique.set(row.profile.id, row.profile);
    this.staffCache = [...unique.values()];
    return this.staffCache;
  }

  /** Mentoras responsáveis; se nenhuma for identificada, todas as mentoras. */
  private async mentors(a: any, ids: Array<string | null | undefined>) {
    if (a.audience === "staff") return this.staff();
    const people = [];
    for (const id of new Set(ids.filter(Boolean))) {
      const person = await this.profile(id);
      if (person) people.push(person);
    }
    return people.length ? people : this.staff();
  }

  private async enrollment(id: string) {
    const { data } = await this.admin
      .from("enrollments")
      .select("id, mentee_id, mentor_id, cohort_id, status")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  private async pillarMentorForStep(stepKey: string) {
    const { data } = await this.admin
      .from("journey_steps")
      .select("title, version:journey_versions!inner(pillar:journey_pillars!inner(mentor_id))")
      .eq("stable_key", stepKey)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    return {
      title: data?.title ?? "Etapa da jornada",
      mentorId: data?.version?.pillar?.mentor_id ?? null,
    };
  }

  // ---------- fila ----------

  private async toPerson(
    a: any,
    person: any,
    role: string,
    vars: any,
    ref: [string, string],
    key: string,
  ) {
    if (!person?.phone) return 0;
    const row = await enqueueNotification(this.admin, {
      eventType: "automation",
      automationId: a.id,
      recipientId: person.id,
      recipientRole: role,
      phone: person.phone,
      referenceType: ref[0],
      referenceId: ref[1],
      idempotencyKey: `auto:${a.id}:${key}:${person.id}`,
      targetUrl: vars.link ?? appLink(),
      message: renderAutomation(a.trigger, a.template, { ...vars, nome: firstName(person) }),
    });
    return row ? 1 : 0;
  }

  private async toGroup(a: any, vars: any, ref: [string, string], key: string) {
    const chatId = this.settings?.group_chat_id;
    if (!chatId) {
      console.warn(`[automações] ${a.name}: nenhum grupo escolhido no painel`);
      return 0;
    }
    const row = await enqueueNotification(this.admin, {
      eventType: "automation",
      automationId: a.id,
      recipientId: null,
      recipientRole: "group",
      phone: null,
      groupChatId: chatId,
      referenceType: ref[0],
      referenceId: ref[1],
      idempotencyKey: `auto:${a.id}:${key}:group`,
      targetUrl: vars.link ?? appLink(),
      message: renderAutomation(a.trigger, a.template, { ...vars, nome: "" }),
    });
    return row ? 1 : 0;
  }

  // ---------- gatilhos ----------

  private async weeklySchedule(a: any) {
    if (a.weekday === null || !a.send_time || !weeklyIsDue(this.now, a.weekday, a.send_time))
      return 0;
    const range = nextWeekRange(this.now);
    const { data: meetings } = await this.admin
      .from("meetings")
      .select("title, scheduled_at, mentor_name")
      .is("deleted_at", null)
      .eq("kind", "grupo")
      .eq("audience", "all")
      .gte("scheduled_at", range.start.toISOString())
      .lt("scheduled_at", range.end.toISOString());
    const vars = {
      semana: range.label,
      cronograma: formatScheduleLines(meetings ?? []),
      link: appLink({ view: "agenda" }),
    };
    const key = saoPauloParts(this.now).isoDate;
    return this.toGroup(a, vars, ["week", key], key);
  }

  private dueRange(offsetMinutes: number) {
    const to = this.now.getTime() + offsetMinutes * 60_000;
    return { from: new Date(to - DUE_WINDOW_MS).toISOString(), to: new Date(to).toISOString() };
  }

  private async attendeeEnrollmentIds(meeting: any) {
    if (meeting.enrollment_id) return [meeting.enrollment_id];
    if (meeting.audience === "selected") {
      const { data } = await this.admin
        .from("meeting_attendees")
        .select("enrollment_id")
        .eq("meeting_id", meeting.id);
      return (data ?? []).map((row: any) => row.enrollment_id);
    }
    let query = this.admin.from("enrollments").select("id").eq("status", "ativa");
    if (meeting.audience === "cohort" && meeting.cohort_id)
      query = query.eq("cohort_id", meeting.cohort_id);
    const { data } = await query;
    return (data ?? []).map((row: any) => row.id);
  }

  private async groupMeetingBefore(a: any) {
    const due = this.dueRange(a.offset_minutes);
    const { data: meetings } = await this.admin
      .from("meetings")
      .select(
        "id, title, scheduled_at, join_url, mentor_name, mentor_id, created_by, audience, cohort_id, enrollment_id",
      )
      .is("deleted_at", null)
      .eq("kind", "grupo")
      .gt("scheduled_at", due.from)
      .lte("scheduled_at", due.to);
    let queued = 0;
    for (const meeting of meetings ?? []) {
      const when = new Date(meeting.scheduled_at);
      const vars = {
        encontro: meeting.title,
        data: formatDayMonth(when),
        hora: formatHour(when),
        mentora: meeting.mentor_name || "a equipe RISE",
        link_encontro: meeting.join_url || appLink({ view: "agenda", meeting: meeting.id }),
        link: appLink({ view: "agenda", meeting: meeting.id }),
      };
      const key = `${meeting.id}:${meeting.scheduled_at}`;
      const ref: [string, string] = ["meeting", meeting.id];
      if (a.audience === "group" && meeting.audience === "all")
        queued += await this.toGroup(a, vars, ref, key);
      else if (a.audience === "group") continue;
      else if (a.audience === "mentor") {
        const mentor = await this.profile(meeting.mentor_id ?? meeting.created_by);
        queued += await this.toPerson(a, mentor, "mentor", vars, ref, key);
      } else {
        for (const enrollmentId of await this.attendeeEnrollmentIds(meeting)) {
          const enrollment = await this.enrollment(enrollmentId);
          if (enrollment?.status !== "ativa") continue;
          queued += await this.toPerson(
            a,
            await this.profile(enrollment.mentee_id),
            "mentee",
            vars,
            ref,
            key,
          );
        }
      }
    }
    return queued;
  }

  private async bookingVars(reservation: any) {
    const [enrollment, mentor, offering, meeting] = await Promise.all([
      this.enrollment(reservation.enrollment_id),
      this.profile(reservation.mentor_id),
      this.admin
        .from("booking_offerings")
        .select("title")
        .is("deleted_at", null)
        .eq("id", reservation.offering_id)
        .maybeSingle(),
      reservation.meeting_id
        ? this.admin
            .from("meetings")
            .select("join_url")
            .is("deleted_at", null)
            .eq("id", reservation.meeting_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const mentee = await this.profile(enrollment?.mentee_id);
    const when = new Date(reservation.starts_at);
    return {
      mentee,
      mentor,
      vars: {
        mentorada: fullName(mentee),
        mentora: mentor ? fullName(mentor) : "sua mentora",
        encontro: offering?.data?.title ?? "Mentoria individual",
        data: formatDayMonth(when),
        hora: formatHour(when),
        link_encontro: meeting?.data?.join_url || appLink({ view: "agenda" }),
        link: appLink({ view: "agenda" }),
      },
    };
  }

  private async bookingBefore(a: any) {
    const due = this.dueRange(a.offset_minutes);
    const { data: reservations } = await this.admin
      .from("booking_reservations")
      .select("id, offering_id, mentor_id, enrollment_id, meeting_id, starts_at")
      .eq("status", "confirmed")
      .gt("starts_at", due.from)
      .lte("starts_at", due.to);
    let queued = 0;
    for (const reservation of reservations ?? []) {
      const { mentee, mentor, vars } = await this.bookingVars(reservation);
      const key = `${reservation.id}:${reservation.starts_at}`;
      const ref: [string, string] = ["booking", reservation.id];
      queued +=
        a.audience === "mentor"
          ? await this.toPerson(a, mentor, "mentor", vars, ref, key)
          : await this.toPerson(a, mentee, "mentee", vars, ref, key);
    }
    return queued;
  }

  private async bookingConfirmed(a: any) {
    const { data: reservations } = await this.admin
      .from("booking_reservations")
      .select("id, offering_id, mentor_id, enrollment_id, meeting_id, starts_at")
      .eq("status", "confirmed")
      .gt("updated_at", this.since(a))
      .gt("starts_at", this.now.toISOString());
    let queued = 0;
    for (const reservation of reservations ?? []) {
      const { mentee, mentor, vars } = await this.bookingVars(reservation);
      const key = `${reservation.id}:${reservation.starts_at}`;
      const ref: [string, string] = ["booking", reservation.id];
      queued +=
        a.audience === "mentees"
          ? await this.toPerson(a, mentee, "mentee", vars, ref, key)
          : await this.toPerson(a, mentor, "mentor", vars, ref, key);
    }
    return queued;
  }

  private async bookingSlotsAvailable(a: any) {
    const { data: offerings } = await this.admin
      .from("booking_offerings")
      .select("*, cohorts:booking_offering_cohorts(cohort_id), rules:booking_availability_rules(*)")
      .is("deleted_at", null);
    const { data: enrollments } = await this.admin
      .from("enrollments")
      .select("id, mentee_id, cohort_id")
      .eq("status", "ativa");
    const startsAt = this.now.toISOString();
    const endsAt = new Date(+this.now + 45 * 86400000).toISOString();
    const { googleBusy } = googleCalendarClient(this.admin);
    let queued = 0;
    for (const offering of offerings ?? []) {
      const [{ data: reservations }, { data: exceptions }] = await Promise.all([
        this.admin
          .from("booking_reservations")
          .select("starts_at, ends_at, enrollment_id, mentor_id")
          .in("status", ["pending", "confirmed"])
          .lt("starts_at", endsAt)
          .gt("ends_at", startsAt),
        this.admin
          .from("booking_availability_exceptions")
          .select("starts_at, ends_at, is_available")
          .eq("offering_id", offering.id)
          .lt("starts_at", endsAt)
          .gt("ends_at", startsAt),
      ]);
      const mentorGoogle =
        offering.status === "active"
          ? await googleBusy(offering.mentor_id, startsAt, endsAt)
          : { connected: false, busy: [] };
      // Desconexão não é ausência de vaga: não muda o estado, nem avisa sem confirmar.
      if (offering.status === "active" && !mentorGoogle.connected) continue;
      const mentor = await this.profile(offering.mentor_id);
      const cohorts = new Set((offering.cohorts ?? []).map((row: any) => row.cohort_id));
      const vars = {
        mentora: mentor ? fullName(mentor) : "Sua mentora",
        encontro: offering.title,
        link: appLink({ view: "agenda" }),
      };
      for (const enrollment of enrollments ?? []) {
        const eligible =
          offering.status === "active" &&
          (offering.audience === "all" || cohorts.has(enrollment.cohort_id));
        const busy = [
          ...mentorGoogle.busy,
          ...(reservations ?? [])
            .filter(
              (r: any) => r.mentor_id === offering.mentor_id || r.enrollment_id === enrollment.id,
            )
            .map((r: any) => ({ startsAt: r.starts_at, endsAt: r.ends_at })),
          ...(exceptions ?? [])
            .filter((r: any) => !r.is_available)
            .map((r: any) => ({ startsAt: r.starts_at, endsAt: r.ends_at })),
        ];
        const available =
          eligible && computeBookingSlots(offering, startsAt, endsAt, busy, +this.now).length > 0;
        const { data: revision } = await this.admin.rpc("set_booking_availability", {
          p_automation_id: a.id,
          p_offering_id: offering.id,
          p_enrollment_id: enrollment.id,
          p_available: available,
        });
        if (!revision) continue;
        const added = await this.toPerson(
          a,
          await this.profile(enrollment.mentee_id),
          "mentee",
          vars,
          ["booking_offering", offering.id],
          offering.id + ":" + revision,
        );
        if (!added) {
          const existing = await this.admin
            .from("whatsapp_notifications")
            .select("id")
            .eq(
              "idempotency_key",
              `auto:${a.id}:${offering.id}:${revision}:${enrollment.mentee_id}`,
            )
            .maybeSingle();
          if (!existing.data) continue;
        }
        // A revisão fica idempotente mesmo se a gravação abaixo falhar.
        await this.admin
          .from("whatsapp_booking_availability")
          .update({ notified_revision: revision })
          .eq("automation_id", a.id)
          .eq("offering_id", offering.id)
          .eq("enrollment_id", enrollment.id)
          .eq("revision", revision);
        queued += added;
      }
    }
    return queued;
  }

  private async questionnaireSubmitted(a: any) {
    const { data: responses } = await this.admin
      .from("journey_stage_questionnaire_responses")
      .select("id, content_id, enrollment_id, user_id, submitted_at")
      .not("submitted_at", "is", null)
      .gt("submitted_at", this.since(a));
    let queued = 0;
    for (const response of responses ?? []) {
      const [{ data: content }, enrollment, mentee] = await Promise.all([
        this.admin
          .from("journey_stage_contents")
          .select("title, pillar:journey_pillars(mentor_id)")
          .is("deleted_at", null)
          .eq("id", response.content_id)
          .maybeSingle(),
        this.enrollment(response.enrollment_id),
        this.profile(response.user_id),
      ]);
      const vars = {
        mentorada: fullName(mentee),
        questionario: content?.title ?? "Questionário",
        link: appLink({ view: "gestao-jornada" }),
      };
      for (const mentor of await this.mentors(a, [
        content?.pillar?.mentor_id,
        enrollment?.mentor_id,
      ]))
        queued += await this.toPerson(
          a,
          mentor,
          "mentor",
          vars,
          ["questionnaire", response.id],
          `${response.id}:${response.submitted_at}`,
        );
    }
    return queued;
  }

  private async assessmentCompleted(a: any) {
    const { data: attempts } = await this.admin
      .from("assessment_attempts")
      .select("id, enrollment_id, mentee_id, completed_at")
      .eq("status", "completed")
      .gt("completed_at", this.since(a));
    let queued = 0;
    for (const attempt of attempts ?? []) {
      const [enrollment, mentee] = await Promise.all([
        this.enrollment(attempt.enrollment_id),
        this.profile(attempt.mentee_id),
      ]);
      const vars = { mentorada: fullName(mentee), link: appLink() };
      for (const mentor of await this.mentors(a, [enrollment?.mentor_id]))
        queued += await this.toPerson(
          a,
          mentor,
          "mentor",
          vars,
          ["assessment", attempt.id],
          attempt.id,
        );
    }
    return queued;
  }

  private async goalCreated(a: any) {
    const { data: goals } = await this.admin
      .from("rise90_goals")
      .select("id, enrollment_id, title, created_at")
      .is("deleted_at", null)
      .gt("created_at", this.since(a));
    let queued = 0;
    for (const goal of goals ?? []) {
      const enrollment = await this.enrollment(goal.enrollment_id);
      const mentee = await this.profile(enrollment?.mentee_id);
      const vars = { mentorada: fullName(mentee), meta: goal.title, link: appLink() };
      for (const mentor of await this.mentors(a, [enrollment?.mentor_id]))
        queued += await this.toPerson(a, mentor, "mentor", vars, ["goal", goal.id], goal.id);
    }
    return queued;
  }

  private async stageCompleted(a: any) {
    const { data: rows } = await this.admin
      .from("journey_step_progress")
      .select("enrollment_id, step_key, completed_at")
      .eq("status", "completed")
      .gt("completed_at", this.since(a));
    let queued = 0;
    for (const row of rows ?? []) {
      const [enrollment, step] = await Promise.all([
        this.enrollment(row.enrollment_id),
        this.pillarMentorForStep(row.step_key),
      ]);
      const mentee = await this.profile(enrollment?.mentee_id);
      const key = `${row.enrollment_id}:${row.step_key}`;
      const ref: [string, string] = ["journey_step", row.step_key];
      if (a.audience === "mentees") {
        const vars = {
          mentorada: fullName(mentee),
          etapa: step.title,
          link: appLink({ view: "jornada" }),
        };
        queued += await this.toPerson(a, mentee, "mentee", vars, ref, key);
        continue;
      }
      const vars = {
        mentorada: fullName(mentee),
        etapa: step.title,
        link: appLink({ view: "gestao-jornada" }),
      };
      for (const mentor of await this.mentors(a, [step.mentorId, enrollment?.mentor_id]))
        queued += await this.toPerson(a, mentor, "mentor", vars, ref, key);
    }
    return queued;
  }

  private async accountCreated(a: any) {
    const { data: people } = await this.admin
      .from("profiles")
      .select("id, display_name, full_name, phone, email, staff_type")
      .not("phone", "is", null)
      .gt("created_at", this.since(a));
    let queued = 0;
    for (const person of people ?? []) {
      const vars = { email: person.email, link: appLink() };
      queued += await this.toPerson(
        a,
        person,
        person.staff_type ? "mentor" : "mentee",
        vars,
        ["profile", person.id],
        person.id,
      );
    }
    return queued;
  }
}
