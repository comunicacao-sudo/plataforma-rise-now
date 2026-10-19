import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OFFICIAL_MENTOR_EMAILS = new Set([
  "camilaum@pamarisdigital.com",
  "gabi@pamarisdigital.com",
  "ana@pamarisdigital.com",
  "camila@pamarisdigital.com",
]);

async function roles(supabase: any, userId: string) {
  const [{ data: a }, { data: m }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
  ]);
  return { isAdmin: !!a || !!m };
}

async function requireAdmin(supabase: any, userId: string) {
  const r = await roles(supabase, userId);
  if (!r.isAdmin) throw new Error("Acesso restrito à administração.");
}

async function audit(
  admin: any,
  actor: string,
  action: string,
  target: string,
  payload: unknown = null,
) {
  await admin.from("audit_log").insert({ actor_id: actor, action, target, payload });
}

/** Directory used by scheduling, reviews and member management. Every mentor is an administrator. */
export const getDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await roles(context.supabase, context.userId);
    if (!r.isAdmin) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [mentorRoles, cohorts, phases, specialties] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select(
          "role, profile:profiles(id, full_name, email, title, staff_type, primary_specialty_id)",
        )
        .in("role", ["mentor", "admin"]),
      supabaseAdmin.from("cohorts").select("*").order("created_at"),
      supabaseAdmin
        .from("phases")
        .select("id, month_number, title, pillar, lessons(id, title, kind, position)")
        .order("month_number"),
      supabaseAdmin
        .from("mentor_specialties")
        .select("id, name, category")
        .order("category")
        .order("name"),
    ]);
    const eq = supabaseAdmin
      .from("enrollments")
      .select(
        "id, status, progress_pct, current_month, cohort_id, mentor_id, mentee:profiles!enrollments_mentee_id_fkey(id, display_name, full_name, email, profession, profession_visible)",
      )
      .order("created_at");
    const { data: enrollments } = await eq;
    const specialtyById = new Map<string, string>(
      (specialties.data ?? []).map((item) => [item.id, item.name]),
    );
    const seen = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        isAdmin: boolean;
        staffType: "mentor" | null;
        specialtyId: string | null;
        specialty: string | null;
      }
    >();
    for (const row of (mentorRoles.data ?? []) as any[]) {
      if (!row.profile) continue;
      if (!OFFICIAL_MENTOR_EMAILS.has(String(row.profile.email).toLowerCase())) continue;
      seen.set(row.profile.id, {
        id: row.profile.id,
        name: row.profile.full_name,
        email: row.profile.email,
        isAdmin: true,
        staffType: row.profile.staff_type,
        specialtyId: row.profile.primary_specialty_id,
        specialty: specialtyById.get(row.profile.primary_specialty_id) ?? row.profile.title ?? null,
      });
    }
    return {
      isAdmin: r.isAdmin,
      me: context.userId,
      staff: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)),
      specialties: specialties.data ?? [],
      cohorts: cohorts.data ?? [],
      phases: (phases.data ?? []).map((p: any) => ({
        ...p,
        lessons: [...(p.lessons ?? [])].sort((a: any, b: any) => a.position - b.position),
      })),
      enrollments: ((enrollments ?? []) as any[]).map((e) => {
        const publicName = e.mentee?.display_name || e.mentee?.full_name || "";
        return {
          id: e.id as string,
          status: e.status as string,
          progress: e.progress_pct as number,
          month: e.current_month as number,
          cohortId: e.cohort_id as string | null,
          mentorId: e.mentor_id as string | null,
          menteeId: e.mentee?.id as string,
          name: (r.isAdmin ? e.mentee?.full_name || publicName : publicName) as string,
          email: (r.isAdmin ? (e.mentee?.email ?? "") : "") as string,
          profession: (e.mentee?.profession_visible ? (e.mentee?.profession ?? "") : "") as string,
        };
      }),
    };
  });

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email().max(200),
        phone: z.string().trim().max(40).nullable(),
        memberType: z.enum(["mentee", "mentor"]),
        cohortId: z.string().uuid().nullable(),
        mentorId: z.string().uuid().nullable(),
        specialtyId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.memberType === "mentor" && !OFFICIAL_MENTOR_EMAILS.has(data.email)) {
      return {
        ok: false as const,
        error: "Por enquanto, somente as quatro mentoras oficiais podem receber acesso.",
      };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, claimed")
      .eq("email", data.email)
      .maybeSingle();
    if (existing?.claimed)
      return { ok: false as const, error: "Este email já tem acesso à plataforma." };
    const role = data.memberType === "mentee" ? "mentee" : "admin";
    const { error: invErr } = await supabaseAdmin.from("allowed_emails").upsert(
      {
        email: data.email,
        full_name: data.fullName,
        role,
        status: "approved",
        invited_by: context.userId,
      },
      { onConflict: "email" },
    );
    if (invErr) {
      // allowed_emails may not have a unique constraint on email; fall back to insert
      await supabaseAdmin.from("allowed_emails").insert({
        email: data.email,
        full_name: data.fullName,
        role,
        status: "approved",
        invited_by: context.userId,
      });
    }
    const request = getRequest();
    const url = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;
    const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: new URL("/reset-password", origin).toString(),
      data: {
        full_name: data.fullName,
        phone: data.phone,
        member_type: data.memberType,
        staff_type: data.memberType === "mentee" ? null : data.memberType,
      },
    });
    if (error || !created.user)
      return {
        ok: false as const,
        error: error?.message ?? "Não foi possível enviar o convite.",
      };
    await supabaseAdmin.from("profiles").update({ phone: data.phone }).eq("id", created.user.id);
    if (data.memberType === "mentee") {
      const { data: program } = await supabaseAdmin
        .from("programs")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (program) {
        await supabaseAdmin.from("enrollments").insert({
          mentee_id: created.user.id,
          program_id: program.id,
          cohort_id: data.cohortId,
          mentor_id: data.mentorId,
        });
      }
    } else {
      let specialtyName: string | null = null;
      if (data.specialtyId) {
        const { data: specialty } = await supabaseAdmin
          .from("mentor_specialties")
          .select("name")
          .eq("id", data.specialtyId)
          .maybeSingle();
        specialtyName = specialty?.name ?? null;
      }
      await supabaseAdmin
        .from("profiles")
        .update({
          staff_type: data.memberType,
          primary_specialty_id: data.specialtyId,
          pillar: specialtyName,
          title: specialtyName ? `Mentora de ${specialtyName}` : "Mentora",
        })
        .eq("id", created.user.id);
    }
    await audit(supabaseAdmin, context.userId, "member_invited", data.email, {
      memberType: data.memberType,
      specialtyId: data.specialtyId,
    });
    try {
      const whatsapp = await import("@/lib/whatsapp.server");
      const settings = await whatsapp.getWhatsAppSettings();
      if (settings.accountCreated) {
        const fallbackUrl = new URL("/reset-password", origin).toString();
        if (!data.phone) {
          await whatsapp.notifyAccountCreated({
            userId: created.user.id,
            fullName: data.fullName,
            phone: null,
            role: data.memberType === "mentee" ? "mentee" : "admin",
            secureActionUrl: fallbackUrl,
          });
        } else {
          const { data: recovery, error: recoveryError } =
            await supabaseAdmin.auth.admin.generateLink({
              type: "recovery",
              email: data.email,
              options: { redirectTo: fallbackUrl },
            });
          if (recoveryError || !recovery.properties?.action_link) {
            console.error(
              "[WhatsApp] Could not generate secure account activation link",
              recoveryError?.message,
            );
          } else {
            await whatsapp.notifyAccountCreated({
              userId: created.user.id,
              fullName: data.fullName,
              phone: data.phone,
              role: data.memberType === "mentee" ? "mentee" : "admin",
              secureActionUrl: recovery.properties.action_link,
            });
          }
        }
      }
    } catch (notificationError) {
      console.error(
        "[WhatsApp] Account notification did not interrupt registration",
        notificationError,
      );
    }
    return { ok: true as const };
  });

export const createMentorSpecialty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        category: z.enum(["pillar", "subject"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: specialty, error } = await supabaseAdmin
      .from("mentor_specialties")
      .insert({ ...data, created_by: context.userId })
      .select("id, name, category")
      .single();
    if (error) {
      const duplicate = error.code === "23505";
      return {
        ok: false as const,
        error: duplicate ? "Este pilar ou assunto já está cadastrado." : error.message,
      };
    }
    await audit(supabaseAdmin, context.userId, "mentor_specialty_created", specialty.id, data);
    return { ok: true as const, specialty };
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
    const patch: { cohort_id?: string | null; mentor_id?: string | null; status?: string } = {};
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
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
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
