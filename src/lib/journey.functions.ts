/* eslint-disable @typescript-eslint/no-explicit-any -- The generated Supabase types cannot include migration 0008 until it is applied remotely. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const journeyFormats = [
  "questionnaire",
  "form",
  "recorded_class",
  "collective_recording",
  "cohort_onboarding",
  "live_group",
  "individual_1_1",
] as const;

export const completionRules = [
  "final_submission",
  "player_ended",
  "mentor_confirmation",
  "verified_external",
] as const;

const stepSchema = z.object({
  stableKey: z.string().uuid(),
  title: z.string().trim().max(160),
  format: z.enum(journeyFormats),
  impactLead: z.string().trim().max(180),
  impactHighlight: z.string().trim().max(180),
  impactTail: z.string().trim().max(180),
  description: z.string().trim().max(1200),
  responsibleName: z.string().trim().max(120).nullable(),
  durationMinutes: z.number().int().positive().max(1440).nullable(),
  resourceType: z.string().trim().max(60).nullable(),
  resourceId: z.string().trim().max(240).nullable(),
  resourceUrl: z.string().trim().url().max(2000).nullable(),
  scheduledAt: z.string().datetime().nullable(),
  releaseAt: z.string().datetime().nullable(),
  completionRule: z.enum(completionRules),
  required: z.boolean(),
  monthNumber: z.number().int().min(1).max(6),
  coverPath: z.string().trim().max(500).nullable(),
  coverUrl: z.string().trim().url().max(2000).nullable().optional(),
  mediaPath: z.string().trim().max(500).nullable(),
  summary: z.string().trim().max(4000),
  topics: z.array(z.string().trim().min(1).max(160)).max(20),
  materials: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        title: z.string().trim().min(1).max(180),
        url: z.string().trim().url().max(2000).nullable(),
        filePath: z.string().trim().max(500).nullable(),
      }),
    )
    .max(30),
  accessScope: z.enum(["general", "cohort", "mentee"]),
  cohortId: z.string().uuid().nullable(),
  menteeId: z.string().uuid().nullable(),
});

export type JourneyDraftStep = z.infer<typeof stepSchema>;

export type NextJourneyStep = {
  state: "ready" | "blocked" | "waiting_resource" | "complete" | "no_enrollment" | "error";
  enrollmentId?: string;
  pillarId?: string;
  pillarName?: string;
  stepKey?: string;
  title?: string;
  format?: (typeof journeyFormats)[number];
  impactLead?: string;
  impactHighlight?: string;
  impactTail?: string;
  description?: string;
  responsibleName?: string | null;
  durationMinutes?: number | null;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceUrl?: string | null;
  scheduledAt?: string | null;
  releaseAt?: string | null;
  progressStatus?: "not_started" | "in_progress" | "awaiting_confirmation" | "completed";
  actionLabel?: string | null;
};

const journeyStepSelect =
  "stable_key, title, format, impact_lead, impact_highlight, impact_tail, description, responsible_name, duration_minutes, resource_type, resource_id, resource_url, scheduled_at, release_at, completion_rule, required, position, month_number, cover_path, media_path, summary, topics, materials, access_scope, cohort_id, mentee_id";

function journeyStepSignature(step: any) {
  return JSON.stringify({
    stable_key: step.stable_key,
    title: step.title,
    format: step.format,
    impact_lead: step.impact_lead,
    impact_highlight: step.impact_highlight,
    impact_tail: step.impact_tail,
    description: step.description,
    responsible_name: step.responsible_name,
    duration_minutes: step.duration_minutes,
    resource_type: step.resource_type,
    resource_id: step.resource_id,
    resource_url: step.resource_url,
    scheduled_at: step.scheduled_at,
    release_at: step.release_at,
    completion_rule: step.completion_rule,
    required: step.required,
    position: step.position,
    month_number: step.month_number,
    cover_path: step.cover_path,
    media_path: step.media_path,
    summary: step.summary ?? "",
    topics: step.topics ?? [],
    materials: step.materials ?? [],
    access_scope: step.access_scope ?? "general",
    cohort_id: step.cohort_id,
    mentee_id: step.mentee_id,
  });
}

async function staffRoles(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isMentor }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
  ]);
  if (!isAdmin && !isMentor) throw new Error("Acesso restrito à administração RISE NOW.");
  return { isAdmin: !!isAdmin || !!isMentor };
}

export const getJourneyEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ pillarId: z.string().uuid().optional() }).optional().parse(input),
  )
  .handler(async ({ data, context }) => {
    const role = await staffRoles(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    let pillarQuery = admin
      .from("journey_pillars")
      .select(
        "id, program_id, name, position, mentor_id, current_published_version_id, mentor:profiles!journey_pillars_mentor_id_fkey(full_name)",
      )
      .order("position");
    if (!role.isAdmin) pillarQuery = pillarQuery.eq("mentor_id", context.userId);
    const { data: pillars, error: pillarError } = await pillarQuery;
    if (pillarError) throw new Error(pillarError.message);
    const available = (pillars ?? []) as Array<{
      id: string;
      program_id: string;
      name: string;
      position: number;
      mentor_id: string | null;
      current_published_version_id: string | null;
      mentor: { full_name: string } | null;
    }>;
    const selected = available.find((pillar) => pillar.id === data?.pillarId) ?? available[0];
    if (!selected) {
      return {
        isAdmin: role.isAdmin,
        pillars: [],
        selected: null,
        revision: 0,
        steps: [],
        affectedActive: 0,
        confirmations: [],
      };
    }
    const { data: draft, error: draftError } = await admin
      .from("journey_versions")
      .select("id, revision, updated_at")
      .eq("pillar_id", selected.id)
      .eq("status", "draft")
      .single();
    if (draftError) throw new Error(draftError.message);
    const [
      { data: steps, error: stepsError },
      { data: publishedSteps, error: publishedStepsError },
      { count: affectedActive },
    ] = await Promise.all([
      admin
        .from("journey_steps")
        .select(journeyStepSelect)
        .eq("version_id", draft.id)
        .order("position"),
      selected.current_published_version_id
        ? admin
            .from("journey_steps")
            .select(journeyStepSelect)
            .eq("version_id", selected.current_published_version_id)
            .order("position")
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("program_id", selected.program_id)
        .eq("status", "ativa"),
    ]);
    if (stepsError) throw new Error(stepsError.message);
    if (publishedStepsError) throw new Error(publishedStepsError.message);
    const stepRows = (steps ?? []) as any[];
    const publishedByKey = new Map(
      ((publishedSteps ?? []) as any[]).map((step) => [
        step.stable_key as string,
        journeyStepSignature(step),
      ]),
    );
    const publishedStepKeys = stepRows
      .filter(
        (step) => publishedByKey.get(step.stable_key as string) === journeyStepSignature(step),
      )
      .map((step) => step.stable_key as string);
    const confirmableKeys = stepRows
      .filter((step) => step.completion_rule === "mentor_confirmation")
      .map((step) => step.stable_key as string);
    let confirmations: Array<{
      enrollmentId: string;
      stepKey: string;
      status: "in_progress" | "awaiting_confirmation";
      updatedAt: string;
      menteeName: string;
      stepTitle: string;
    }> = [];
    if (confirmableKeys.length) {
      const { data: pending, error: pendingError } = await admin
        .from("journey_step_progress")
        .select(
          "enrollment_id, step_key, status, updated_at, enrollment:enrollments!inner(mentee:profiles!enrollments_mentee_id_fkey(full_name))",
        )
        .in("step_key", confirmableKeys)
        .in("status", ["in_progress", "awaiting_confirmation"])
        .order("updated_at", { ascending: true });
      if (pendingError) throw new Error(pendingError.message);
      const titles = new Map(
        stepRows.map((step) => [step.stable_key as string, step.title as string]),
      );
      confirmations = ((pending ?? []) as any[]).map((item) => ({
        enrollmentId: item.enrollment_id,
        stepKey: item.step_key,
        status: item.status,
        updatedAt: item.updated_at,
        menteeName: item.enrollment?.mentee?.full_name ?? "Mentorada",
        stepTitle: titles.get(item.step_key) ?? "Etapa",
      }));
    }
    const coverPaths = stepRows
      .map((step) => step.cover_path as string | null)
      .filter((path): path is string => !!path);
    const coverUrls = new Map<string, string>();
    await Promise.all(
      coverPaths.map(async (path) => {
        const { data: signed } = await admin.storage
          .from("journey-content")
          .createSignedUrl(path, 60 * 60);
        if (signed?.signedUrl) coverUrls.set(path, signed.signedUrl);
      }),
    );
    return {
      isAdmin: role.isAdmin,
      pillars: available.map((pillar) => ({
        id: pillar.id,
        name: pillar.name,
        mentorName: pillar.mentor?.full_name ?? "Responsável ainda não vinculada",
      })),
      selected: {
        id: selected.id,
        name: selected.name,
        mentorName: selected.mentor?.full_name ?? "Responsável ainda não vinculada",
        publishedVersionId: selected.current_published_version_id,
      },
      revision: draft.revision as number,
      updatedAt: draft.updated_at as string,
      affectedActive: affectedActive ?? 0,
      publishedStepKeys,
      confirmations,
      steps: stepRows.map((step) => ({
        stableKey: step.stable_key,
        title: step.title,
        format: step.format,
        impactLead: step.impact_lead,
        impactHighlight: step.impact_highlight,
        impactTail: step.impact_tail,
        description: step.description,
        responsibleName: step.responsible_name,
        durationMinutes: step.duration_minutes,
        resourceType: step.resource_type,
        resourceId: step.resource_id,
        resourceUrl: step.resource_url,
        scheduledAt: step.scheduled_at,
        releaseAt: step.release_at,
        completionRule: step.completion_rule,
        required: step.required,
        monthNumber: step.month_number ?? 1,
        coverPath: step.cover_path,
        coverUrl: step.cover_path ? (coverUrls.get(step.cover_path) ?? null) : null,
        mediaPath: step.media_path,
        summary: step.summary ?? "",
        topics: step.topics ?? [],
        materials: Array.isArray(step.materials) ? step.materials : [],
        accessScope: step.access_scope ?? "general",
        cohortId: step.cohort_id,
        menteeId: step.mentee_id,
      })) as JourneyDraftStep[],
    };
  });

export const saveJourneyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        pillarId: z.string().uuid(),
        expectedRevision: z.number().int().nonnegative(),
        steps: z.array(stepSchema).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await staffRoles(context.supabase, context.userId);
    const { data: revision, error } = await (context.supabase as any).rpc("save_journey_draft", {
      p_pillar_id: data.pillarId,
      p_expected_revision: data.expectedRevision,
      p_steps: data.steps,
    });
    if (error) throw new Error(error.message);
    return { revision: revision as number };
  });

export const publishJourneyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        pillarId: z.string().uuid(),
        expectedRevision: z.number().int().nonnegative(),
        applyActive: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await staffRoles(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: previousPillar } = await (supabaseAdmin as any)
      .from("journey_pillars")
      .select("current_published_version_id")
      .eq("id", data.pillarId)
      .maybeSingle();
    const { data: versionId, error } = await (context.supabase as any).rpc(
      "publish_journey_draft",
      {
        p_pillar_id: data.pillarId,
        p_expected_revision: data.expectedRevision,
        p_apply_active: data.applyActive,
      },
    );
    if (error) throw new Error(error.message);
    try {
      const { notifyNewlyReleasedSteps } = await import("@/lib/whatsapp.server");
      await notifyNewlyReleasedSteps({
        previousVersionId: previousPillar?.current_published_version_id ?? null,
        newVersionId: versionId as string,
        pillarId: data.pillarId,
        applyActive: data.applyActive,
      });
    } catch (notificationError) {
      console.error(
        "[WhatsApp] Stage release notifications did not interrupt publication",
        notificationError,
      );
    }
    return { versionId: versionId as string };
  });

export const getNextJourneyStep = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("get_next_journey_step");
    if (error) throw new Error(error.message);
    return data as NextJourneyStep;
  });

export const startJourneyStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ enrollmentId: z.string().uuid(), stepKey: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: enrollment } = await context.supabase
      .from("enrollments")
      .select("mentee_id")
      .eq("id", data.enrollmentId)
      .single();
    if (enrollment?.mentee_id !== context.userId)
      throw new Error("Esta etapa não pertence à sua matrícula.");
    const { error } = await (context.supabase as any).from("journey_step_progress").upsert(
      {
        enrollment_id: data.enrollmentId,
        step_key: data.stepKey,
        status: "in_progress",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,step_key", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmJourneyStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ enrollmentId: z.string().uuid(), stepKey: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const role = await staffRoles(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: step } = await admin
      .from("journey_steps")
      .select("version:journey_versions!inner(pillar:journey_pillars!inner(mentor_id))")
      .eq("stable_key", data.stepKey)
      .limit(1)
      .maybeSingle();
    const mentorId = step?.version?.pillar?.mentor_id;
    if (!role.isAdmin && mentorId !== context.userId)
      throw new Error("Você não pode confirmar esta etapa.");
    const [{ data: previousProgress }, { data: enrollment }] = await Promise.all([
      admin
        .from("journey_step_progress")
        .select("status")
        .eq("enrollment_id", data.enrollmentId)
        .eq("step_key", data.stepKey)
        .maybeSingle(),
      admin.from("enrollments").select("mentee_id").eq("id", data.enrollmentId).single(),
    ]);
    const { error } = await admin.from("journey_step_progress").upsert(
      {
        enrollment_id: data.enrollmentId,
        step_key: data.stepKey,
        status: "completed",
        completed_at: new Date().toISOString(),
        confirmed_by: context.userId,
        confirmation_source: "mentor",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,step_key" },
    );
    if (error) throw new Error(error.message);
    await admin.from("audit_log").insert({
      actor_id: context.userId,
      action: "journey_step_confirmed",
      target: data.enrollmentId,
      payload: { stepKey: data.stepKey },
    });
    if (previousProgress?.status !== "completed" && enrollment?.mentee_id) {
      try {
        const { notifyStageCompleted } = await import("@/lib/whatsapp.server");
        await notifyStageCompleted({
          enrollmentId: data.enrollmentId,
          menteeId: enrollment.mentee_id,
          stepKey: data.stepKey,
        });
      } catch (notificationError) {
        console.error(
          "[WhatsApp] Stage completion notification did not interrupt confirmation",
          notificationError,
        );
      }
    }
    return { ok: true };
  });
