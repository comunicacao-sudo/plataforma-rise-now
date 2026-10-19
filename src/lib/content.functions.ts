/* eslint-disable @typescript-eslint/no-explicit-any -- Migration 0011 is not part of the generated remote types yet. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const videoFormats = [
  "recorded_class",
  "collective_recording",
  "cohort_onboarding",
  "individual_1_1",
] as const;

const contentIdSchema = z.object({ stepKey: z.string().uuid() });

export type JourneyMaterial = {
  id: string;
  title: string;
  url: string | null;
  filePath: string | null;
  fileUrl: string | null;
};

export type JourneyContentItem = {
  stepKey: string;
  title: string;
  resourceType: string | null;
  format:
    | "questionnaire"
    | "form"
    | "recorded_class"
    | "collective_recording"
    | "cohort_onboarding"
    | "live_group"
    | "individual_1_1";
  description: string;
  summary: string;
  responsibleName: string | null;
  durationMinutes: number | null;
  monthNumber: number;
  pillarName: string;
  position: number;
  coverUrl: string | null;
  mediaUrl: string | null;
  questionnaireUrl: string | null;
  scheduledAt: string | null;
  releaseAt: string | null;
  topics: string[];
  materials: JourneyMaterial[];
  accessScope: "general" | "cohort" | "mentee";
  availability: "available" | "coming_soon" | "missing_resource";
  completed: boolean;
  currentSeconds: number;
  durationSeconds: number | null;
};

export type JourneyContentLibrary = {
  enrollmentId: string;
  currentMonth: number;
  items: JourneyContentItem[];
};

async function requireAdmin(supabase: any, userId: string) {
  const [{ data: admin }, { data: mentor }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
  ]);
  if (!admin && !mentor) throw new Error("Acesso restrito à administração RISE NOW.");
}

async function signedUrl(admin: any, path: string | null | undefined) {
  if (!path) return null;
  const { data, error } = await admin.storage
    .from("journey-content")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl as string;
}

function isVideo(format: string): format is (typeof videoFormats)[number] {
  return (videoFormats as readonly string[]).includes(format);
}

async function loadLibrary(userId: string): Promise<JourneyContentLibrary | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: enrollment, error: enrollmentError } = await admin
    .from("enrollments")
    .select("id, program_id, cohort_id, mentee_id, current_month, status, created_at")
    .eq("mentee_id", userId)
    .neq("status", "desativada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (enrollmentError) throw new Error(enrollmentError.message);
  if (!enrollment) return null;

  const [{ data: pillars, error: pillarError }, { data: assignments, error: assignmentError }] =
    await Promise.all([
      admin
        .from("journey_pillars")
        .select("id, name, position, current_published_version_id")
        .eq("program_id", enrollment.program_id)
        .order("position"),
      admin
        .from("enrollment_journey_versions")
        .select("pillar_id, version_id")
        .eq("enrollment_id", enrollment.id),
    ]);
  if (pillarError) throw new Error(pillarError.message);
  if (assignmentError) throw new Error(assignmentError.message);
  const assigned = new Map(
    ((assignments ?? []) as any[]).map((row) => [
      row.pillar_id as string,
      row.version_id as string,
    ]),
  );
  const versions = new Map<string, { name: string; position: number }>();
  for (const pillar of (pillars ?? []) as any[]) {
    const versionId = assigned.get(pillar.id) ?? pillar.current_published_version_id;
    if (versionId) versions.set(versionId, { name: pillar.name, position: pillar.position });
  }
  if (!versions.size)
    return { enrollmentId: enrollment.id, currentMonth: enrollment.current_month, items: [] };

  const [{ data: steps, error: stepError }, { data: progress, error: progressError }] =
    await Promise.all([
      admin
        .from("journey_steps")
        .select(
          "version_id, stable_key, title, format, description, summary, responsible_name, duration_minutes, month_number, position, cover_path, media_path, resource_type, resource_url, scheduled_at, release_at, topics, materials, access_scope, cohort_id, mentee_id",
        )
        .in("version_id", [...versions.keys()])
        .is("archived_at", null)
        .order("position"),
      admin
        .from("journey_content_progress")
        .select("step_key, current_seconds, duration_seconds, completed")
        .eq("enrollment_id", enrollment.id)
        .eq("user_id", userId),
    ]);
  if (stepError) throw new Error(stepError.message);
  if (progressError) throw new Error(progressError.message);
  const progressByStep = new Map(
    ((progress ?? []) as any[]).map((row) => [row.step_key as string, row]),
  );
  const now = Date.now();
  const allowed = ((steps ?? []) as any[]).filter((step) => {
    if (step.access_scope === "cohort" && step.cohort_id !== enrollment.cohort_id) return false;
    if (step.access_scope === "mentee" && step.mentee_id !== userId) return false;
    return (
      step.access_scope === "general" ||
      step.access_scope === "cohort" ||
      step.access_scope === "mentee"
    );
  });

  const items = await Promise.all(
    allowed.map(async (step): Promise<JourneyContentItem> => {
      const pillar = versions.get(step.version_id) ?? { name: "Jornada", position: 999 };
      const locked =
        step.month_number > enrollment.current_month ||
        (!!step.release_at && new Date(step.release_at).getTime() > now);
      const coverUrl = await signedUrl(admin, step.cover_path);
      const storedMedia = locked ? null : await signedUrl(admin, step.media_path);
      const materialRows = Array.isArray(step.materials) ? step.materials : [];
      const materials = locked
        ? []
        : await Promise.all(
            materialRows.map(async (material: any, index: number): Promise<JourneyMaterial> => ({
              id: String(material.id ?? `${step.stable_key}-${index}`),
              title: String(material.title ?? "Material de apoio"),
              url: typeof material.url === "string" ? material.url : null,
              filePath: typeof material.filePath === "string" ? material.filePath : null,
              fileUrl: await signedUrl(admin, material.filePath),
            })),
          );
      const state = progressByStep.get(step.stable_key);
      const resourceUrl = storedMedia ?? step.resource_url ?? null;
      const hasResource = isVideo(step.format)
        ? !!resourceUrl
        : step.format === "questionnaire" || step.format === "form"
          ? step.resource_type === "rise_assessment" || !!step.resource_url
          : true;
      return {
        stepKey: step.stable_key,
        title: step.title,
        resourceType: step.resource_type,
        format: step.format,
        description: step.description ?? "",
        summary: step.summary || step.description || "",
        responsibleName: step.responsible_name,
        durationMinutes: step.duration_minutes,
        monthNumber: step.month_number,
        pillarName: pillar.name,
        position: pillar.position * 1000 + step.position,
        coverUrl,
        mediaUrl: !locked && isVideo(step.format) ? resourceUrl : null,
        questionnaireUrl:
          !locked && (step.format === "questionnaire" || step.format === "form")
            ? step.resource_url
            : null,
        scheduledAt: step.scheduled_at,
        releaseAt: step.release_at,
        topics: Array.isArray(step.topics) ? step.topics : [],
        materials,
        accessScope: step.access_scope,
        availability: locked ? "coming_soon" : hasResource ? "available" : "missing_resource",
        completed: !!state?.completed,
        currentSeconds: state?.current_seconds ?? 0,
        durationSeconds: state?.duration_seconds ?? null,
      };
    }),
  );

  return {
    enrollmentId: enrollment.id,
    currentMonth: enrollment.current_month,
    items: items.sort((a, b) => a.position - b.position),
  };
}

async function requireContent(userId: string, stepKey: string) {
  const library = await loadLibrary(userId);
  const item = library?.items.find((entry) => entry.stepKey === stepKey);
  if (!library || !item || item.availability === "coming_soon")
    throw new Error("Você não tem permissão para acessar este conteúdo.");
  return { library, item };
}

export const getJourneyContentLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadLibrary(context.userId));

export const getJourneyContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => contentIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { library, item } = await requireContent(context.userId, data.stepKey);
    const available = library.items.filter(
      (entry) => isVideo(entry.format) && entry.availability !== "coming_soon",
    );
    const index = available.findIndex((entry) => entry.stepKey === item.stepKey);
    return {
      item,
      enrollmentId: library.enrollmentId,
      previous: index > 0 ? (available[index - 1]?.stepKey ?? null) : null,
      next:
        index >= 0 && index < available.length - 1 ? (available[index + 1]?.stepKey ?? null) : null,
    };
  });

export const getJourneyStudyState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => contentIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { library } = await requireContent(context.userId, data.stepKey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [{ data: note }, { data: markers }, { data: progress }] = await Promise.all([
      admin
        .from("journey_content_notes")
        .select("content, updated_at")
        .eq("user_id", context.userId)
        .eq("step_key", data.stepKey)
        .maybeSingle(),
      admin
        .from("journey_content_markers")
        .select("id, timestamp_seconds, reflection, created_at")
        .eq("user_id", context.userId)
        .eq("step_key", data.stepKey)
        .order("timestamp_seconds"),
      admin
        .from("journey_content_progress")
        .select("current_seconds, duration_seconds, completed")
        .eq("enrollment_id", library.enrollmentId)
        .eq("step_key", data.stepKey)
        .maybeSingle(),
    ]);
    return {
      note: note?.content ?? "",
      markers: markers ?? [],
      currentSeconds: progress?.current_seconds ?? 0,
      durationSeconds: progress?.duration_seconds ?? null,
      completed: !!progress?.completed,
    };
  });

export const saveJourneyContentNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    contentIdSchema.extend({ content: z.string().max(30000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { library } = await requireContent(context.userId, data.stepKey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("journey_content_notes").upsert(
      {
        enrollment_id: library.enrollmentId,
        step_key: data.stepKey,
        user_id: context.userId,
        content: data.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,step_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addJourneyContentMarker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    contentIdSchema
      .extend({
        timestampSeconds: z.number().int().nonnegative(),
        reflection: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { library } = await requireContent(context.userId, data.stepKey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: marker, error } = await (supabaseAdmin as any)
      .from("journey_content_markers")
      .insert({
        enrollment_id: library.enrollmentId,
        step_key: data.stepKey,
        user_id: context.userId,
        timestamp_seconds: data.timestampSeconds,
        reflection: data.reflection,
      })
      .select("id, timestamp_seconds, reflection, created_at")
      .single();
    if (error) throw new Error(error.message);
    return marker;
  });

export const saveJourneyContentProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    contentIdSchema
      .extend({
        currentSeconds: z.number().int().nonnegative(),
        durationSeconds: z.number().int().nonnegative().nullable(),
        ended: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { library } = await requireContent(context.userId, data.stepKey);
    const duration = data.durationSeconds;
    const completed =
      data.ended && duration !== null && duration > 0 && data.currentSeconds >= duration * 0.9;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: existing } = await admin
      .from("journey_content_progress")
      .select("completed")
      .eq("enrollment_id", library.enrollmentId)
      .eq("step_key", data.stepKey)
      .maybeSingle();
    const isComplete = !!existing?.completed || completed;
    const { error } = await admin.from("journey_content_progress").upsert(
      {
        enrollment_id: library.enrollmentId,
        step_key: data.stepKey,
        user_id: context.userId,
        current_seconds: data.currentSeconds,
        duration_seconds: duration,
        completed: isComplete,
        completed_at: isComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,step_key" },
    );
    if (error) throw new Error(error.message);
    if (!existing?.completed && isComplete) {
      try {
        const { notifyStageCompleted } = await import("@/lib/whatsapp.server");
        await notifyStageCompleted({
          enrollmentId: library.enrollmentId,
          menteeId: context.userId,
          stepKey: data.stepKey,
        });
      } catch (notificationError) {
        console.error(
          "[WhatsApp] Stage completion notification did not interrupt progress",
          notificationError,
        );
      }
    }
    return { completed: isComplete };
  });

export const createJourneyUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        kind: z.enum(["cover", "media", "material"]),
        fileName: z.string().trim().min(1).max(180),
        contentType: z.string().trim().min(1).max(120),
        size: z.number().int().positive().max(2_000_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const image = ["image/png", "image/jpeg", "image/webp"].includes(data.contentType);
    if (data.kind === "cover" && (!image || data.size > 12_000_000))
      throw new Error("A capa deve ser PNG, JPG ou WebP e ter no máximo 12 MB.");
    const extension =
      data.fileName
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "bin";
    const folder = data.kind === "cover" ? "covers" : data.kind === "media" ? "media" : "materials";
    const path = `${folder}/${context.userId}/${crypto.randomUUID()}.${extension}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await (supabaseAdmin as any).storage
      .from("journey-content")
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !signed) throw new Error(error?.message ?? "Não foi possível preparar o upload.");
    return { path, token: signed.token };
  });
