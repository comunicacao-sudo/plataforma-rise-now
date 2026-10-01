import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function roles(supabase: any, userId: string) {
  const [{ data: a }, { data: m }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
  ]);
  return { isAdmin: !!a, isMentor: !!m };
}

async function requireAdmin(supabase: any, userId: string) {
  const r = await roles(supabase, userId);
  if (!r.isAdmin) throw new Error("Apenas administradoras podem fazer isso.");
}

async function audit(admin: any, actor: string, action: string, target: string, payload: unknown = null) {
  await admin.from("audit_log").insert({ actor_id: actor, action, target, payload });
}

/** Directory used by scheduling, reviews and member management. Mentors only see their own mentees. */
export const getDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await roles(context.supabase, context.userId);
    if (!r.isAdmin && !r.isMentor) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [mentorRoles, cohorts, phases] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role, profile:profiles(id, full_name, email)").in("role", ["mentor", "admin"]),
      supabaseAdmin.from("cohorts").select("*").order("created_at"),
      supabaseAdmin.from("phases").select("id, month_number, title, pillar, lessons(id, title, kind, position)").order("month_number"),
    ]);
    let eq = supabaseAdmin
      .from("enrollments")
      .select(
        "id, status, progress_pct, current_month, cohort_id, mentor_id, mentee:profiles!enrollments_mentee_id_fkey(id, full_name, email)",
      )
      .order("created_at");
    if (!r.isAdmin) eq = eq.eq("mentor_id", context.userId);
    const { data: enrollments } = await eq;
    const seen = new Map<string, { id: string; name: string; email: string; isAdmin: boolean }>();
    for (const row of (mentorRoles.data ?? []) as any[]) {
      if (!row.profile) continue;
      const cur = seen.get(row.profile.id);
      seen.set(row.profile.id, {
        id: row.profile.id,
        name: row.profile.full_name,
        email: row.profile.email,
        isAdmin: (cur?.isAdmin ?? false) || row.role === "admin",
      });
    }
    return {
      isAdmin: r.isAdmin,
      me: context.userId,
      staff: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)),
      cohorts: cohorts.data ?? [],
      phases: (phases.data ?? []).map((p: any) => ({
        ...p,
        lessons: [...(p.lessons ?? [])].sort((a: any, b: any) => a.position - b.position),
      })),
      enrollments: ((enrollments ?? []) as any[]).map((e) => ({
        id: e.id as string,
        status: e.status as string,
        progress: e.progress_pct as number,
        month: e.current_month as number,
        cohortId: e.cohort_id as string | null,
        mentorId: e.mentor_id as string | null,
        menteeId: e.mentee?.id as string,
        name: (e.mentee?.full_name ?? "") as string,
        email: (e.mentee?.email ?? "") as string,
      })),
    };
  });

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email().max(200),
        role: z.enum(["mentee", "mentor", "admin"]),
        cohortId: z.string().uuid().nullable(),
        mentorId: z.string().uuid().nullable(),
        password: z.string().min(8).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (existing) return { ok: false as const, error: "Este e-mail já tem acesso à plataforma." };
    const { error: invErr } = await supabaseAdmin
      .from("allowed_emails")
      .upsert({ email: data.email, full_name: data.fullName, role: data.role, status: "approved", invited_by: context.userId }, { onConflict: "email" });
    if (invErr) {
      // allowed_emails may not have a unique constraint on email; fall back to insert
      await supabaseAdmin.from("allowed_emails").insert({ email: data.email, full_name: data.fullName, role: data.role, status: "approved", invited_by: context.userId });
    }
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, must_change_password: true },
    });
    if (error || !created.user) return { ok: false as const, error: error?.message ?? "Não foi possível criar o acesso." };
    if (data.role === "mentee") {
      const { data: program } = await supabaseAdmin.from("programs").select("id").limit(1).maybeSingle();
      if (program) {
        await supabaseAdmin.from("enrollments").insert({
          mentee_id: created.user.id,
          program_id: program.id,
          cohort_id: data.cohortId,
          mentor_id: data.mentorId,
        });
      }
    }
    await audit(supabaseAdmin, context.userId, "member_created", data.email, { role: data.role });
    return { ok: true as const };
  });

export const updateEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enrollmentId: z.string().uuid(),
        cohortId: z.string().uuid().nullable().optional(),
        mentorId: z.string().uuid().nullable().optional(),
        status: z.enum(["ativa", "pausada", "desativada"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.cohortId !== undefined) patch.cohort_id = data.cohortId;
    if (data.mentorId !== undefined) patch.mentor_id = data.mentorId;
    if (data.status) patch.status = data.status;
    const { data: row, error } = await supabaseAdmin
      .from("enrollments")
      .update(patch)
      .eq("id", data.enrollmentId)
      .select("mentee_id")
      .single();
    if (error) throw new Error(error.message);
    if (data.status) {
      await supabaseAdmin.auth.admin.updateUserById(row.mentee_id, {
        ban_duration: data.status === "ativa" ? "none" : "876000h",
      });
    }
    await audit(supabaseAdmin, context.userId, "enrollment_updated", data.enrollmentId, patch);
    return { ok: true };
  });

export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      user_metadata: { must_change_password: true },
    });
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, context.userId, "password_reset", data.userId);
    return { ok: true };
  });
