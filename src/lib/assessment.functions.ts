/* eslint-disable @typescript-eslint/no-explicit-any -- Assessment tables are introduced by migration 0012. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_VERSION,
  PROMPT_VERSION,
  SCORING_VERSION,
  calculateAssessment,
  type CalculatedAssessmentResult,
} from "@/lib/assessment";

const answerSchema = z.object({
  attemptId: z.string().uuid(),
  itemId: z.string().min(2).max(12),
  value: z.number().int().min(1).max(5),
});
const attemptSchema = z.object({
  attemptId: z.string().uuid(),
  stepKey: z.string().uuid().optional(),
});
const enrollmentSchema = z.object({ enrollmentId: z.string().uuid() });
const releaseSchema = enrollmentSchema.extend({ attemptId: z.string().uuid() });
const planSchema = z.object({
  attemptId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  priorityFocus: z.string().trim().min(2).max(240),
  objective: z.string().trim().min(2).max(1000),
  action: z.string().trim().min(2).max(1000),
  progressEvidence: z.string().trim().max(1000),
  dueDate: z.string().date().nullable(),
  reviewDate: z.string().date().nullable(),
  observations: z.string().trim().max(2000),
  status: z.enum(["draft", "agreed", "in_progress", "completed"]),
  responsible: z.string().trim().max(160),
  sharedWithMentee: z.boolean(),
  internalNotes: z.string().trim().max(3000),
});

async function isStaff(supabase: any, userId: string) {
  const [{ data: admin }, { data: mentor }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
  ]);
  return !!admin || !!mentor;
}

async function requireStaff(supabase: any, userId: string) {
  if (!(await isStaff(supabase, userId))) throw new Error("Acesso restrito à mentoria RISE NOW.");
}

async function ownEnrollment(admin: any, userId: string) {
  const { data, error } = await admin
    .from("enrollments")
    .select("id, mentee_id")
    .eq("mentee_id", userId)
    .neq("status", "desativada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sua jornada ainda não possui uma matrícula ativa.");
  return data as { id: string; mentee_id: string };
}

async function requireOwnAttempt(admin: any, userId: string, attemptId: string) {
  const { data, error } = await admin
    .from("assessment_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("mentee_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Aplicação não encontrada.");
  return data as any;
}

function publicResult(result: CalculatedAssessmentResult, full: boolean) {
  if (full) return result;
  return {
    assessmentVersion: result.assessmentVersion,
    scoringVersion: result.scoringVersion,
    calculatedAt: result.calculatedAt,
    responseCount: result.responseCount,
    indicators: result.indicators,
    competencies: result.competencies,
    comparisons: result.comparisons,
    motivations: result.motivations,
    strengths: result.strengths,
    summary: result.summary,
    limitations: result.limitations,
  };
}

async function plansForAttempt(admin: any, attemptId: string, includePrivate: boolean) {
  const { data: plans, error } = await admin
    .from("assessment_development_plans")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("created_at");
  if (error) throw new Error(error.message);
  const visible = includePrivate
    ? (plans ?? [])
    : (plans ?? []).filter((row: any) => row.shared_with_mentee);
  if (!includePrivate || !visible.length) return visible;
  const ids = visible.map((row: any) => row.id);
  const { data: notes } = await admin
    .from("assessment_development_private_notes")
    .select("plan_id, content")
    .in("plan_id", ids);
  const byPlan = new Map((notes ?? []).map((row: any) => [row.plan_id, row.content]));
  return visible.map((row: any) => ({ ...row, internal_notes: byPlan.get(row.id) ?? "" }));
}

export const getMyAssessmentState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const enrollment = await ownEnrollment(admin, context.userId);
    const { data: attempt, error } = await admin
      .from("assessment_attempts")
      .select(
        "id, status, current_index, started_at, completed_at, report_status, assessment_version, scoring_version",
      )
      .eq("enrollment_id", enrollment.id)
      .eq("assessment_version", ASSESSMENT_VERSION)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!attempt) return { attempt: null, answers: [] as Array<{ itemId: string; value: number }> };
    const { data: responses, error: responseError } = await admin
      .from("assessment_responses")
      .select("item_id, value")
      .eq("attempt_id", attempt.id);
    if (responseError) throw new Error(responseError.message);
    return {
      attempt,
      answers: (responses ?? []).map((row: any) => ({ itemId: row.item_id, value: row.value })),
    };
  });

export const startAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const enrollment = await ownEnrollment(admin, context.userId);
    const { data: open } = await admin
      .from("assessment_attempts")
      .select("id, status, current_index")
      .eq("enrollment_id", enrollment.id)
      .eq("assessment_version", ASSESSMENT_VERSION)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open) return open;
    const { data, error } = await admin
      .from("assessment_attempts")
      .insert({
        enrollment_id: enrollment.id,
        mentee_id: context.userId,
        assessment_version: ASSESSMENT_VERSION,
        scoring_version: SCORING_VERSION,
        prompt_version: PROMPT_VERSION,
        status: "in_progress",
        current_index: 0,
        report_status: "full_report_locked",
      })
      .select("id, status, current_index")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveAssessmentAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => answerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const questionIndex = ASSESSMENT_QUESTIONS.findIndex((question) => question.id === data.itemId);
    if (questionIndex < 0) throw new Error("Pergunta inválida para esta versão do instrumento.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const attempt = await requireOwnAttempt(admin, context.userId, data.attemptId);
    if (attempt.status !== "in_progress") throw new Error("Esta aplicação já foi concluída.");
    const question = ASSESSMENT_QUESTIONS[questionIndex]!;
    const { error } = await admin.from("assessment_responses").upsert(
      {
        attempt_id: data.attemptId,
        item_id: data.itemId,
        perspective: question.perspective,
        value: data.value,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,item_id" },
    );
    if (error) throw new Error(error.message);
    const nextIndex = Math.min(questionIndex + 1, ASSESSMENT_QUESTIONS.length - 1);
    await admin
      .from("assessment_attempts")
      .update({ current_index: nextIndex, updated_at: new Date().toISOString() })
      .eq("id", data.attemptId);
    return { ok: true, currentIndex: nextIndex };
  });

export const completeAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => attemptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const attempt = await requireOwnAttempt(admin, context.userId, data.attemptId);
    if (attempt.status === "completed" && attempt.calculated_result)
      return publicResult(
        attempt.calculated_result as CalculatedAssessmentResult,
        attempt.report_status === "full_report_released",
      );
    const { data: responses, error } = await admin
      .from("assessment_responses")
      .select("item_id, value")
      .eq("attempt_id", data.attemptId);
    if (error) throw new Error(error.message);
    const result = calculateAssessment(
      (responses ?? []).map((row: any) => ({ itemId: row.item_id, value: row.value })),
    );
    const completedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("assessment_attempts")
      .update({
        status: "completed",
        current_index: ASSESSMENT_QUESTIONS.length,
        completed_at: completedAt,
        calculated_at: result.calculatedAt,
        calculated_result: result,
        report_status: "summary_available",
        updated_at: completedAt,
      })
      .eq("id", data.attemptId);
    if (updateError) throw new Error(updateError.message);
    if (data.stepKey) {
      await Promise.all([
        admin.from("journey_content_progress").upsert(
          {
            enrollment_id: attempt.enrollment_id,
            user_id: context.userId,
            step_key: data.stepKey,
            current_seconds: 0,
            completed: true,
            completed_at: completedAt,
            updated_at: completedAt,
          },
          { onConflict: "enrollment_id,step_key" },
        ),
        admin.from("journey_step_progress").upsert(
          {
            enrollment_id: attempt.enrollment_id,
            step_key: data.stepKey,
            status: "completed",
            completed_at: completedAt,
            confirmation_source: "assessment_system",
            updated_at: completedAt,
          },
          { onConflict: "enrollment_id,step_key" },
        ),
      ]);
    }
    return publicResult(result, false);
  });

export const getMyAssessmentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const enrollment = await ownEnrollment(admin, context.userId);
    const { data: attempts, error } = await admin
      .from("assessment_attempts")
      .select(
        "id, status, started_at, completed_at, assessment_version, scoring_version, report_status, reviewed_at, released_at, calculated_result",
      )
      .eq("enrollment_id", enrollment.id)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    const mapped = (attempts ?? []).map((attempt: any) => ({
      ...attempt,
      calculated_result: attempt.calculated_result
        ? publicResult(
            attempt.calculated_result as CalculatedAssessmentResult,
            attempt.report_status === "full_report_released",
          )
        : null,
    }));
    const latest = mapped.find((attempt: any) => attempt.status === "completed") ?? null;
    return {
      enrollmentId: enrollment.id,
      latest,
      attempts: mapped.map(({ calculated_result: _result, ...attempt }: any) => attempt),
      plans: latest ? await plansForAttempt(admin, latest.id, false) : [],
    };
  });

export const getMentorAssessmentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => enrollmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: enrollment, error: enrollmentError } = await admin
      .from("enrollments")
      .select(
        "id, mentee:profiles!enrollments_mentee_id_fkey(id, display_name, full_name, email, profession)",
      )
      .eq("id", data.enrollmentId)
      .maybeSingle();
    if (enrollmentError) throw new Error(enrollmentError.message);
    if (!enrollment) throw new Error("Mentorada não encontrada.");
    const { data: attempts, error } = await admin
      .from("assessment_attempts")
      .select("*")
      .eq("enrollment_id", data.enrollmentId)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    const latest = (attempts ?? []).find((attempt: any) => attempt.status === "completed") ?? null;
    return {
      enrollment,
      latest,
      attempts: (attempts ?? []).map(({ calculated_result: _result, ...attempt }: any) => attempt),
      plans: latest ? await plansForAttempt(admin, latest.id, true) : [],
    };
  });

export const releaseAssessmentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => releaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: attempt, error: attemptError } = await admin
      .from("assessment_attempts")
      .select("id, status")
      .eq("id", data.attemptId)
      .eq("enrollment_id", data.enrollmentId)
      .maybeSingle();
    if (attemptError) throw new Error(attemptError.message);
    if (!attempt || attempt.status !== "completed")
      throw new Error("Relatório concluído não encontrado.");
    const now = new Date().toISOString();
    const { error } = await admin
      .from("assessment_attempts")
      .update({
        report_status: "full_report_released",
        reviewed_by: context.userId,
        reviewed_at: now,
        released_by: context.userId,
        released_at: now,
        updated_at: now,
      })
      .eq("id", data.attemptId);
    if (error) throw new Error(error.message);
    await admin.from("audit_log").insert({
      actor_id: context.userId,
      action: "assessment_report_released",
      target: data.attemptId,
      payload: { enrollmentId: data.enrollmentId },
    });
    return { ok: true };
  });

export const saveAssessmentDevelopmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => planSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: attempt } = await admin
      .from("assessment_attempts")
      .select("id")
      .eq("id", data.attemptId)
      .eq("enrollment_id", data.enrollmentId)
      .maybeSingle();
    if (!attempt) throw new Error("Aplicação não encontrada.");
    const { data: plan, error } = await admin
      .from("assessment_development_plans")
      .insert({
        attempt_id: data.attemptId,
        enrollment_id: data.enrollmentId,
        created_by: context.userId,
        priority_focus: data.priorityFocus,
        objective: data.objective,
        action: data.action,
        progress_evidence: data.progressEvidence || null,
        due_date: data.dueDate,
        review_date: data.reviewDate,
        observations: data.observations || null,
        status: data.status,
        responsible: data.responsible || null,
        shared_with_mentee: data.sharedWithMentee,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.internalNotes) {
      const { error: noteError } = await admin.from("assessment_development_private_notes").insert({
        plan_id: plan.id,
        author_id: context.userId,
        content: data.internalNotes,
      });
      if (noteError) throw new Error(noteError.message);
    }
    return { ok: true, id: plan.id as string };
  });
