// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import {
  AI_ASSESSMENT_OUTPUT_JSON_SCHEMA,
  AI_MENTEE_RELEASE_SECTIONS,
  AI_MENTOR_SECTIONS,
  AI_OUTPUT_SCHEMA_VERSION,
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_VERSION,
  PROMPT_VERSION,
  SCORING_VERSION,
  calculateAssessment,
  filterAssessmentResultForAudience,
  parseAIAssessmentInterpretation,
  projectAIAssessmentSections,
} from "../../../src/lib/assessment.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const fail = (message: string, status = 400) => json({ error: message }, status);
const env = (name: string) => Deno.env.get(name)?.trim() || null;

function keyFromJson(name: string) {
  const raw = env(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw).default ?? null;
  } catch {
    return null;
  }
}
const url = env("SUPABASE_URL")!;
const publicKey = keyFromJson("SUPABASE_PUBLISHABLE_KEYS") ?? env("SUPABASE_ANON_KEY")!;
const secretKey = keyFromJson("SUPABASE_SECRET_KEYS") ?? env("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Context = { userId: string; user: any; db: any; admin: any; request: Request };

async function context(request: Request): Promise<Context> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Não autenticado.");
  const db = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  return { userId: data.user.id, user: data.user, db, admin, request };
}

async function isStaff(c: Context) {
  const [{ data: a }, { data: m }] = await Promise.all([
    c.db.rpc("has_role", { _user_id: c.userId, _role: "admin" }),
    c.db.rpc("has_role", { _user_id: c.userId, _role: "mentor" }),
  ]);
  return !!a || !!m;
}
async function requireStaff(c: Context) {
  if (!(await isStaff(c))) throw new Error("Acesso restrito à administração RISE NOW.");
}
async function audit(c: Context, action: string, target: string, payload: unknown = null) {
  await c.admin.from("audit_log").insert({ actor_id: c.userId, action, target, payload });
}
const officialMentors = new Set([
  "camilaum@pamarisdigital.com",
  "gabriela@pamarisdigital.com",
  "ana@pamarisdigital.com",
  "camila@pamarisdigital.com",
]);

async function getDirectory(c: Context) {
  await requireStaff(c);
  const [mentorRoles, cohorts, phases, specialties, enrollments, allowed, authUsers] =
    await Promise.all([
      c.admin
        .from("user_roles")
        .select(
          "role, profile:profiles(id, full_name, email, title, staff_type, primary_specialty_id, avatar_url, phone, contact_email)",
        )
        .in("role", ["mentor", "admin"]),
      c.admin.from("cohorts").select("*").order("created_at"),
      c.admin
        .from("phases")
        .select("id, month_number, title, pillar, lessons(id, title, kind, position)")
        .order("month_number"),
      c.admin
        .from("mentor_specialties")
        .select("id, name, category")
        .order("category")
        .order("name"),
      c.admin
        .from("enrollments")
        .select(
          "id, status, progress_pct, current_month, cohort_id, mentee:profiles!enrollments_mentee_id_fkey(id, display_name, full_name, email, profession, profession_visible, avatar_url, phone, contact_email)",
        )
        .order("created_at"),
      c.admin
        .from("allowed_emails")
        .select("id, email, full_name, role, status, created_at")
        .order("created_at"),
      c.admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
  if (mentorRoles.error) throw new Error(mentorRoles.error.message);
  if (cohorts.error) throw new Error(cohorts.error.message);
  if (phases.error) throw new Error(phases.error.message);
  if (specialties.error) throw new Error(specialties.error.message);
  if (enrollments.error) throw new Error(enrollments.error.message);
  if (allowed.error) throw new Error(allowed.error.message);
  if (authUsers.error) throw new Error(authUsers.error.message);
  const specialtyById = new Map((specialties.data ?? []).map((x: any) => [x.id, x.name]));
  const staff = (mentorRoles.data ?? [])
    .flatMap((row: any) => {
      const p = row.profile;
      if (!p || !officialMentors.has(String(p.email).toLowerCase())) return [];
      return [
        {
          id: p.id,
          name: p.full_name,
          email: p.email,
          isAdmin: true,
          staffType: p.staff_type,
          specialtyId: p.primary_specialty_id,
          specialty: specialtyById.get(p.primary_specialty_id) ?? p.title ?? null,
          avatarUrl: p.avatar_url ?? null,
          phone: p.phone ?? null,
          contactEmail: p.contact_email ?? null,
        },
      ];
    })
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
  return {
    isAdmin: true,
    me: c.userId,
    staff,
    access: (allowed.data ?? []).map((entry: any) => {
      const user = authUsers.data?.users?.find(
        (candidate: any) =>
          String(candidate.email).toLowerCase() === String(entry.email).toLowerCase(),
      );
      return {
        id: entry.id,
        userId: user?.id ?? null,
        name: entry.full_name || String(entry.email).split("@")[0],
        email: entry.email,
        role: entry.role,
        status:
          entry.status !== "approved" || user?.banned_until
            ? "revogado"
            : user?.confirmed_at
              ? "ativo"
              : "aguardando",
        createdAt: entry.created_at,
      };
    }),
    specialties: specialties.data ?? [],
    cohorts: cohorts.data ?? [],
    phases: (phases.data ?? []).map((p: any) => ({
      ...p,
      lessons: [...(p.lessons ?? [])].sort((a, b) => a.position - b.position),
    })),
    enrollments: (enrollments.data ?? []).map((e: any) => ({
      id: e.id,
      status: e.status,
      progress: e.progress_pct,
      month: e.current_month,
      cohortId: e.cohort_id,
      menteeId: e.mentee?.id,
      name: e.mentee?.full_name || e.mentee?.display_name || "",
      email: e.mentee?.email ?? "",
      profession: e.mentee?.profession_visible ? (e.mentee?.profession ?? "") : "",
      avatarUrl: e.mentee?.avatar_url ?? null,
      phone: e.mentee?.phone ?? null,
      contactEmail: e.mentee?.contact_email ?? null,
    })),
  };
}

async function createMember(c: Context, d: any) {
  await requireStaff(c);
  const email = String(d.email ?? "")
    .trim()
    .toLowerCase();
  if (d.memberType === "mentor" && !officialMentors.has(email))
    return {
      ok: false,
      error: "Por enquanto, somente as quatro mentoras oficiais podem receber acesso.",
    };
  const { data: existing } = await c.admin
    .from("profiles")
    .select("id, claimed")
    .eq("email", email)
    .maybeSingle();
  if (existing?.claimed) return { ok: false, error: "Este email já tem acesso à plataforma." };
  const role = d.memberType === "mentee" ? "mentee" : "admin";
  const { error: inviteRowError } = await c.admin.from("allowed_emails").upsert(
    {
      email,
      full_name: String(d.fullName).trim(),
      role,
      status: "approved",
      invited_by: c.userId,
    },
    { onConflict: "email" },
  );
  if (inviteRowError) throw new Error(inviteRowError.message);
  const appBase = env("APP_BASE_URL") ?? "https://board.mentoriarisenow.com.br";
  const { data: created, error } = await c.admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: new URL("/reset-password", appBase).toString(),
    data: {
      full_name: d.fullName,
      phone: d.phone ?? null,
      member_type: d.memberType,
      staff_type: d.memberType === "mentee" ? null : "mentor",
    },
  });
  if (error || !created.user) {
    await c.admin.from("allowed_emails").update({ status: "revoked" }).eq("email", email);
    return { ok: false, error: error?.message ?? "Não foi possível enviar o convite." };
  }
  const { error: profileContactError } = await c.admin
    .from("profiles")
    .update({ phone: d.phone ?? null })
    .eq("id", created.user.id);
  if (profileContactError) throw new Error(profileContactError.message);
  if (d.memberType === "mentee") {
    const { data: program, error: programError } = await c.admin
      .from("programs")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (programError) throw new Error(programError.message);
    if (program) {
      const { error: enrollmentError } = await c.admin.from("enrollments").insert({
        mentee_id: created.user.id,
        program_id: program.id,
        cohort_id: d.cohortId ?? null,
        mentor_id: null,
      });
      if (enrollmentError) throw new Error(enrollmentError.message);
    }
  } else {
    const { data: specialty, error: specialtyError } = d.specialtyId
      ? await c.admin
          .from("mentor_specialties")
          .select("name")
          .eq("id", d.specialtyId)
          .maybeSingle()
      : { data: null, error: null };
    if (specialtyError) throw new Error(specialtyError.message);
    const { error: profileRoleError } = await c.admin
      .from("profiles")
      .update({
        staff_type: "mentor",
        primary_specialty_id: d.specialtyId ?? null,
        pillar: specialty?.name ?? null,
        title: specialty?.name ? `Mentora de ${specialty.name}` : "Mentora",
      })
      .eq("id", created.user.id);
    if (profileRoleError) throw new Error(profileRoleError.message);
  }
  await audit(c, "member_invited", email, {
    memberType: d.memberType,
    specialtyId: d.specialtyId ?? null,
  });
  return { ok: true };
}

async function createMentorSpecialty(c: Context, d: any) {
  await requireStaff(c);
  const { data, error } = await c.admin
    .from("mentor_specialties")
    .insert({ name: String(d.name).trim(), category: d.category, created_by: c.userId })
    .select("id, name, category")
    .single();
  if (error)
    return {
      ok: false,
      error: error.code === "23505" ? "Este pilar ou assunto já está cadastrado." : error.message,
    };
  await audit(c, "mentor_specialty_created", data.id, d);
  return { ok: true, specialty: data };
}

async function updateEnrollment(c: Context, d: any) {
  await requireStaff(c);
  const patch: any = {};
  if (d.cohortId !== undefined) patch.cohort_id = d.cohortId;
  if (d.status) patch.status = d.status;
  const { data, error } = await c.admin
    .from("enrollments")
    .update(patch)
    .eq("id", d.enrollmentId)
    .select("mentee_id")
    .single();
  if (error) throw new Error(error.message);
  if (d.status) {
    const { error: authError } = await c.admin.auth.admin.updateUserById(data.mentee_id, {
      ban_duration: d.status === "ativa" ? "none" : "876000h",
    });
    if (authError) throw new Error(authError.message);
  }
  await audit(c, "enrollment_updated", d.enrollmentId, patch);
  return { ok: true };
}

async function updateAccess(c: Context, d: any) {
  await requireStaff(c);
  const enabled = d.enabled === true;
  const { data: invite, error } = await c.admin
    .from("allowed_emails")
    .update({ status: enabled ? "approved" : "revoked" })
    .eq("id", d.accessId)
    .select("email")
    .single();
  if (error) throw new Error(error.message);
  const { data: users, error: usersError } = await c.admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw new Error(usersError.message);
  const user = users.users.find(
    (candidate: any) =>
      String(candidate.email).toLowerCase() === String(invite.email).toLowerCase(),
  );
  if (user) {
    const { error: authError } = await c.admin.auth.admin.updateUserById(user.id, {
      ban_duration: enabled ? "none" : "876000h",
    });
    if (authError) throw new Error(authError.message);
  }
  await audit(c, enabled ? "access_activated" : "access_revoked", d.accessId);
  return { ok: true };
}

async function resetMemberPassword(c: Context, d: any) {
  await requireStaff(c);
  if (String(d.password ?? "").length < 8)
    throw new Error("A senha precisa ter ao menos 8 caracteres.");
  const { error } = await c.admin.auth.admin.updateUserById(d.userId, {
    password: d.password,
    user_metadata: { must_change_password: true },
  });
  if (error) throw new Error(error.message);
  await audit(c, "password_reset", d.userId);
  return { ok: true };
}

async function notifyStageCompleted(_enrollmentId: string, _menteeId: string, _stepKey: string) {
  // Provider intentionally unavailable. Events remain represented by the existing
  // templates/tables, but no message or pending log is created without a real provider.
}

async function journeyAction(c: Context, action: string, d: any) {
  if (action === "getNextJourneyStep") {
    const { data, error } = await c.db.rpc("get_next_journey_step");
    if (error) throw new Error(error.message);
    return data;
  }
  if (action === "saveJourneyDraft") {
    await requireStaff(c);
    const expectedRevision = Number(d.expectedRevision ?? d.revision);
    if (!Number.isInteger(expectedRevision))
      throw new Error("Revisão do rascunho inválida. Recarregue a página e tente novamente.");
    const { data, error } = await c.db.rpc("save_journey_draft", {
      p_pillar_id: d.pillarId,
      p_expected_revision: expectedRevision,
      p_steps: d.steps,
    });
    if (error) throw new Error(error.message);
    return { ok: true, revision: data };
  }
  if (action === "publishJourneyDraft") {
    await requireStaff(c);
    const expectedRevision = Number(d.expectedRevision ?? d.revision);
    if (!Number.isInteger(expectedRevision))
      throw new Error("Revisão da publicação inválida. Recarregue a página e tente novamente.");
    const { data, error } = await c.db.rpc("publish_journey_draft", {
      p_pillar_id: d.pillarId,
      p_expected_revision: expectedRevision,
      p_apply_active: !!d.applyActive,
    });
    if (error) throw new Error(error.message);
    return { ok: true, versionId: data };
  }
  if (action === "startJourneyStep") {
    const { data: enrollment } = await c.db
      .from("enrollments")
      .select("id")
      .eq("id", d.enrollmentId)
      .eq("mentee_id", c.userId)
      .maybeSingle();
    if (!enrollment) throw new Error("Matrícula não encontrada.");
    const { error } = await c.db.from("journey_step_progress").upsert(
      {
        enrollment_id: d.enrollmentId,
        step_key: d.stepKey,
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,step_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  }
  if (action === "confirmJourneyStep") {
    await requireStaff(c);
    const now = new Date().toISOString();
    const [{ data: previous }, { data: enrollment }] = await Promise.all([
      c.admin
        .from("journey_step_progress")
        .select("status")
        .eq("enrollment_id", d.enrollmentId)
        .eq("step_key", d.stepKey)
        .maybeSingle(),
      c.admin.from("enrollments").select("mentee_id").eq("id", d.enrollmentId).single(),
    ]);
    const { error } = await c.admin.from("journey_step_progress").upsert(
      {
        enrollment_id: d.enrollmentId,
        step_key: d.stepKey,
        status: "completed",
        completed_at: now,
        confirmed_by: c.userId,
        confirmation_source: "mentor",
        updated_at: now,
      },
      { onConflict: "enrollment_id,step_key" },
    );
    if (error) throw new Error(error.message);
    if (previous?.status !== "completed" && enrollment?.mentee_id)
      await notifyStageCompleted(d.enrollmentId, enrollment.mentee_id, d.stepKey);
    return { ok: true };
  }
  if (action !== "getJourneyEditor") throw new Error("Ação de jornada inválida.");
  await requireStaff(c);
  const { data: pillars, error: pe } = await c.admin
    .from("journey_pillars")
    .select(
      "id, program_id, name, position, mentor_id, current_published_version_id, mentor:profiles!journey_pillars_mentor_id_fkey(full_name)",
    )
    .order("position");
  if (pe) throw new Error(pe.message);
  const selected = (pillars ?? []).find((p: any) => p.id === d?.pillarId) ?? pillars?.[0];
  if (!selected)
    return {
      isAdmin: true,
      pillars: [],
      selected: null,
      revision: 0,
      steps: [],
      affectedActive: 0,
      confirmations: [],
    };
  const { data: draft, error: de } = await c.admin
    .from("journey_versions")
    .select("id, revision, updated_at")
    .eq("pillar_id", selected.id)
    .eq("status", "draft")
    .single();
  if (de) throw new Error(de.message);
  const [{ data: steps }, { data: publishedSteps }, { count: affectedActive }] = await Promise.all([
    c.admin
      .from("journey_steps")
      .select("*")
      .eq("version_id", draft.id)
      .is("archived_at", null)
      .order("position"),
    selected.current_published_version_id
      ? c.admin
          .from("journey_steps")
          .select("*")
          .eq("version_id", selected.current_published_version_id)
          .is("archived_at", null)
          .order("position")
      : Promise.resolve({ data: [] }),
    c.admin
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("program_id", selected.program_id)
      .eq("status", "ativa"),
  ]);
  const comparable = (s: any) =>
    JSON.stringify({
      stable_key: s?.stable_key ?? null,
      title: typeof s?.title === "string" ? s.title.trim() : s?.title ?? null,
      format: s?.format ?? null,
      impact_lead: typeof s?.impact_lead === "string" ? s.impact_lead.trim() : s?.impact_lead ?? "",
      impact_highlight:
        typeof s?.impact_highlight === "string" ? s.impact_highlight.trim() : s?.impact_highlight ?? "",
      impact_tail: typeof s?.impact_tail === "string" ? s.impact_tail.trim() : s?.impact_tail ?? "",
      description:
        typeof s?.description === "string" ? s.description.trim() : s?.description ?? "",
      month_number: s?.month_number ?? 1,
      cover_path: s?.cover_path ?? null,
      cover_path_light: s?.cover_path_light ?? null,
      cover_path_dark: s?.cover_path_dark ?? null,
      summary: typeof s?.summary === "string" ? s.summary.trim() : s?.summary ?? "",
      topics: Array.isArray(s?.topics) ? s.topics : [],
    });
  const publishedByKey = new Map(
    (publishedSteps ?? []).map((s: any, index: number) => [
      s.stable_key,
      { signature: comparable(s), order: index },
    ]),
  );
  const publishedStepKeys = (steps ?? [])
    .filter((s: any, index: number) => {
      const published = publishedByKey.get(s.stable_key) as
        | { signature: string; order: number }
        | undefined;
      return !!published && published.order === index && published.signature === comparable(s);
    })
    .map((s: any) => s.stable_key);
  const confirmableKeys = (steps ?? [])
    .filter((s: any) => s.completion_rule === "mentor_confirmation")
    .map((s: any) => s.stable_key);
  let confirmations: any[] = [];
  if (confirmableKeys.length) {
    const { data: pending } = await c.admin
      .from("journey_step_progress")
      .select(
        "enrollment_id, step_key, status, updated_at, enrollment:enrollments!inner(mentee:profiles!enrollments_mentee_id_fkey(full_name))",
      )
      .in("step_key", confirmableKeys)
      .in("status", ["in_progress", "awaiting_confirmation"])
      .order("updated_at");
    const titles = new Map((steps ?? []).map((s: any) => [s.stable_key, s.title]));
    confirmations = (pending ?? []).map((x: any) => ({
      enrollmentId: x.enrollment_id,
      stepKey: x.step_key,
      status: x.status,
      updatedAt: x.updated_at,
      menteeName: x.enrollment?.mentee?.full_name ?? "Mentorada",
      stepTitle: titles.get(x.step_key) ?? "Etapa",
    }));
  }
  const coverUrls = await signedBatch(
    (steps ?? []).flatMap((s: any) => [s.cover_path, s.cover_path_light, s.cover_path_dark]),
  );
  const mapped = (steps ?? []).map((s: any) => ({
    stableKey: s.stable_key,
    title: s.title,
    format: s.format,
    impactLead: s.impact_lead ?? "",
    impactHighlight: s.impact_highlight ?? "",
    impactTail: s.impact_tail ?? "",
    description: s.description ?? "",
    responsibleName: s.responsible_name,
    durationMinutes: s.duration_minutes,
    resourceType: s.resource_type,
    resourceId: s.resource_id,
    resourceUrl: s.resource_url,
    scheduledAt: s.scheduled_at,
    releaseAt: s.release_at,
    completionRule: s.completion_rule,
    required: s.required,
    monthNumber: s.month_number,
    coverPath: s.cover_path,
    coverUrl: typeof s.cover_path === "string" ? (coverUrls.get(s.cover_path) ?? null) : null,
    coverPathLight: s.cover_path_light,
    coverUrlLight:
      typeof s.cover_path_light === "string" ? (coverUrls.get(s.cover_path_light) ?? null) : null,
    coverPathDark: s.cover_path_dark,
    coverUrlDark:
      typeof s.cover_path_dark === "string" ? (coverUrls.get(s.cover_path_dark) ?? null) : null,
    mediaPath: s.media_path,
    summary: s.summary ?? "",
    topics: s.topics ?? [],
    materials: s.materials ?? [],
    accessScope: s.access_scope ?? "general",
    cohortId: s.cohort_id,
    menteeId: s.mentee_id,
  }));
  return {
    isAdmin: true,
    pillars: (pillars ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      mentorName: p.mentor?.full_name ?? "Responsável ainda não vinculada",
    })),
    selected: {
      id: selected.id,
      name: selected.name,
      mentorName: selected.mentor?.full_name ?? "Responsável ainda não vinculada",
      publishedVersionId: selected.current_published_version_id,
    },
    revision: draft.revision,
    updatedAt: draft.updated_at,
    steps: mapped,
    affectedActive: affectedActive ?? 0,
    publishedStepKeys,
    confirmations,
  };
}

const videoFormats = new Set([
  "recorded_class",
  "collective_recording",
  "cohort_onboarding",
  "individual_1_1",
]);
async function signed(path: string | null) {
  if (!path) return null;
  return (
    (await admin.storage.from("journey-content").createSignedUrl(path, 3600)).data?.signedUrl ??
    null
  );
}

async function signedBatch(paths: Array<string | null | undefined>) {
  const unique = [
    ...new Set(paths.filter((path): path is string => typeof path === "string" && path.length > 0)),
  ];
  const urls = new Map<string, string | null>();
  if (!unique.length) return urls;

  const { data, error } = await admin.storage
    .from("journey-content")
    .createSignedUrls(unique, 3600);
  if (error || !data) return urls;

  data.forEach((item: any, index: number) => {
    const path = typeof item.path === "string" ? item.path : unique[index];
    urls.set(path, typeof item.signedUrl === "string" ? item.signedUrl : null);
  });
  return urls;
}
async function loadLibrary(userId: string) {
  const { data: enrollment, error } = await admin
    .from("enrollments")
    .select("id, program_id, cohort_id, mentee_id, current_month, status, created_at")
    .eq("mentee_id", userId)
    .neq("status", "desativada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!enrollment) return null;
  const [{ data: pillars }, { data: assignments }, { data: progress }] = await Promise.all([
    admin
      .from("journey_pillars")
      .select("id, name, position, current_published_version_id")
      .eq("program_id", enrollment.program_id)
      .order("position"),
    admin
      .from("enrollment_journey_versions")
      .select("pillar_id, version_id")
      .eq("enrollment_id", enrollment.id),
    admin
      .from("journey_content_progress")
      .select("step_key, current_seconds, duration_seconds, completed")
      .eq("enrollment_id", enrollment.id)
      .eq("user_id", userId),
  ]);
  const assigned = new Map((assignments ?? []).map((x: any) => [x.pillar_id, x.version_id]));
  const versions = new Map<string, any>();
  for (const p of pillars ?? []) {
    const id = assigned.get(p.id) ?? p.current_published_version_id;
    if (id) versions.set(id, p);
  }
  if (!versions.size)
    return { enrollmentId: enrollment.id, currentMonth: enrollment.current_month, items: [] };
  const { data: steps, error: se } = await admin
    .from("journey_steps")
    .select(
      "version_id, stable_key, title, format, description, summary, responsible_name, duration_minutes, month_number, position, cover_path, cover_path_light, cover_path_dark, media_path, resource_type, resource_url, scheduled_at, release_at, topics, materials, access_scope, cohort_id, mentee_id",
    )
    .in("version_id", [...versions.keys()])
    .is("archived_at", null)
    .order("position");
  if (se) throw new Error(se.message);
  const byStep = new Map((progress ?? []).map((x: any) => [x.step_key, x]));
  const now = Date.now();
  const allowed = (steps ?? []).filter(
    (s: any) =>
      s.access_scope === "general" ||
      (s.access_scope === "cohort" && s.cohort_id === enrollment.cohort_id) ||
      (s.access_scope === "mentee" && s.mentee_id === userId),
  );

  const allowedStepKeys = allowed.map((step: any) => step.stable_key);
  const { data: stageContentRows, error: stageContentError } = allowedStepKeys.length
    ? await admin
        .from("journey_stage_contents")
        .select("*")
        .in("step_key", allowedStepKeys)
        .eq("active", true)
        .order("position")
    : { data: [], error: null };
  if (stageContentError) throw new Error(stageContentError.message);

  const scopedStageRows = (stageContentRows ?? []).filter((row: any) =>
    stageScopeAllowed(row, enrollment, userId),
  );
  const stageByStep = new Map<string, any[]>();
  for (const row of scopedStageRows) {
    const list = stageByStep.get(row.step_key) ?? [];
    list.push(row);
    stageByStep.set(row.step_key, list);
  }
  const chooseStage = (rows: any[], type: string) =>
    rows
      .filter((row: any) => row.content_type === type)
      .sort(
        (a: any, b: any) =>
          stageScopeRank(b) - stageScopeRank(a) ||
          (a.position ?? 0) - (b.position ?? 0) ||
          String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
      )[0] ?? null;

  const assetPaths: string[] = [];
  for (const s of allowed) {
    const stageRows = stageByStep.get(s.stable_key) ?? [];
    const stageVideo = chooseStage(stageRows, "video");
    const stageMaterials = stageRows.filter((row: any) => row.content_type === "material");
    if (typeof s.cover_path === "string" && s.cover_path) assetPaths.push(s.cover_path);
    if (typeof s.cover_path_light === "string" && s.cover_path_light)
      assetPaths.push(s.cover_path_light);
    if (typeof s.cover_path_dark === "string" && s.cover_path_dark)
      assetPaths.push(s.cover_path_dark);
    const locked =
      s.month_number > enrollment.current_month ||
      (!!s.release_at && Date.parse(s.release_at) > now);
    const stageMediaPath =
      typeof stageVideo?.media_path === "string" ? stageVideo.media_path : null;
    if (
      !locked &&
      stageMediaPath &&
      !stageMediaPath.startsWith("r2:")
    )
      assetPaths.push(stageMediaPath);
    else if (
      !locked &&
      typeof s.media_path === "string" &&
      s.media_path &&
      !s.media_path.startsWith("r2:")
    )
      assetPaths.push(s.media_path);
    if (!locked && stageMaterials.length) {
      for (const material of stageMaterials) {
        if (typeof material?.file_path === "string" && material.file_path) {
          assetPaths.push(material.file_path);
        }
      }
    } else if (!locked && Array.isArray(s.materials)) {
      for (const material of s.materials) {
        if (typeof material?.filePath === "string" && material.filePath) {
          assetPaths.push(material.filePath);
        }
      }
    }
  }
  const signedUrls = await signedBatch(assetPaths);

  const items = allowed.map((s: any) => {
    const p = versions.get(s.version_id) ?? { name: "Jornada", position: 999 };
    const locked =
      s.month_number > enrollment.current_month ||
      (!!s.release_at && Date.parse(s.release_at) > now);
    const stageRows = stageByStep.get(s.stable_key) ?? [];
    const stageVideo = chooseStage(stageRows, "video");
    const stageQuestionnaire = chooseStage(stageRows, "questionnaire");
    const stageMaterials = stageRows
      .filter((row: any) => row.content_type === "material")
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    const effectiveMediaPath =
      typeof stageVideo?.media_path === "string" && stageVideo.media_path
        ? stageVideo.media_path
        : s.media_path;
    const effectiveExternalVideo =
      typeof stageVideo?.external_url === "string" && stageVideo.external_url
        ? stageVideo.external_url
        : null;
    const r2Media =
      !locked &&
      typeof effectiveMediaPath === "string" &&
      effectiveMediaPath.startsWith("r2:");
    const mediaUrl =
      locked
        ? null
        : effectiveExternalVideo ??
          (typeof effectiveMediaPath === "string" && effectiveMediaPath && !r2Media
            ? (signedUrls.get(effectiveMediaPath) ?? null)
            : !stageVideo && videoFormats.has(s.format)
              ? s.resource_url
              : null);
    const materials = locked
      ? []
      : stageMaterials.length
        ? stageMaterials.map((m: any) => ({
            id: String(m.id),
            title: String(m.title ?? "Material de apoio"),
            url: typeof m.external_url === "string" ? m.external_url : null,
            filePath: typeof m.file_path === "string" ? m.file_path : null,
            fileUrl:
              typeof m.file_path === "string" ? (signedUrls.get(m.file_path) ?? null) : null,
          }))
        : (Array.isArray(s.materials) ? s.materials : []).map((m: any, i: number) => ({
            id: String(m.id ?? `${s.stable_key}-${i}`),
            title: String(m.title ?? "Material de apoio"),
            url: typeof m.url === "string" ? m.url : null,
            filePath: typeof m.filePath === "string" ? m.filePath : null,
            fileUrl: typeof m.filePath === "string" ? (signedUrls.get(m.filePath) ?? null) : null,
          }));
    const state = byStep.get(s.stable_key);
    const questionnaireUrl =
      !locked && stageQuestionnaire
        ? (stageQuestionnaire.external_url ?? null)
        : !locked && ["questionnaire", "form"].includes(s.format)
          ? s.resource_url
          : null;
    const hasStageContent = !!stageVideo || !!stageQuestionnaire || stageMaterials.length > 0;
    const hasResource = videoFormats.has(s.format)
      ? hasStageContent || r2Media || !!mediaUrl
      : ["questionnaire", "form"].includes(s.format)
        ? !!stageQuestionnaire || s.resource_type === "rise_assessment" || !!s.resource_url
        : hasStageContent || true;
    return {
      stepKey: s.stable_key,
      title: s.title,
      resourceType: stageVideo
        ? r2Media
          ? "r2"
          : "external"
        : s.resource_type,
      format: s.format,
      description: s.description ?? "",
      summary: s.summary || s.description || "",
      responsibleName: s.responsible_name,
      durationMinutes:
        typeof stageVideo?.duration_minutes === "number"
          ? stageVideo.duration_minutes
          : s.duration_minutes,
      monthNumber: s.month_number,
      pillarName: p.name,
      position: p.position * 1000 + s.position,
      coverUrl: typeof s.cover_path === "string" ? (signedUrls.get(s.cover_path) ?? null) : null,
      coverUrlLight:
        typeof s.cover_path_light === "string"
          ? (signedUrls.get(s.cover_path_light) ?? null)
          : typeof s.cover_path === "string"
            ? (signedUrls.get(s.cover_path) ?? null)
            : null,
      coverUrlDark:
        typeof s.cover_path_dark === "string"
          ? (signedUrls.get(s.cover_path_dark) ?? null)
          : typeof s.cover_path === "string"
            ? (signedUrls.get(s.cover_path) ?? null)
            : null,
      mediaUrl: !locked ? mediaUrl : null,
      questionnaireUrl,
      questionnaireId: stageQuestionnaire?.id ?? null,
      questionnaire:
        stageQuestionnaire?.questionnaire && typeof stageQuestionnaire.questionnaire === "object"
          ? stageQuestionnaire.questionnaire
          : null,
      scheduledAt: s.scheduled_at,
      releaseAt: s.release_at,
      topics: Array.isArray(s.topics) ? s.topics : [],
      materials,
      accessScope: s.access_scope,
      availability: locked ? "coming_soon" : hasResource ? "available" : "missing_resource",
      completed: !!state?.completed,
      currentSeconds: state?.current_seconds ?? 0,
      durationSeconds: state?.duration_seconds ?? null,
    };
  });
  return {
    enrollmentId: enrollment.id,
    currentMonth: enrollment.current_month,
    items: items.sort((a, b) => a.position - b.position),
  };
}
async function requireContent(c: Context, stepKey: string) {
  const library = await loadLibrary(c.userId);
  const item = library?.items.find((x: any) => x.stepKey === stepKey);
  if (!library || !item || item.availability === "coming_soon")
    throw new Error("Você não tem permissão para acessar este conteúdo.");
  return { library, item };
}

function stageScopeAllowed(row: any, enrollment: any, userId: string) {
  return (
    row.access_scope === "general" ||
    (row.access_scope === "cohort" && !!enrollment.cohort_id && row.cohort_id === enrollment.cohort_id) ||
    (row.access_scope === "mentee" && row.mentee_id === userId)
  );
}

function stageScopeRank(row: any) {
  return row.access_scope === "mentee" ? 3 : row.access_scope === "cohort" ? 2 : 1;
}

function stageContentShape(row: any) {
  return {
    id: row.id,
    pillarId: row.pillar_id,
    stepKey: row.step_key,
    contentType: row.content_type,
    title: row.title,
    description: row.description ?? "",
    durationMinutes: row.duration_minutes,
    mediaPath: row.media_path,
    filePath: row.file_path,
    externalUrl: row.external_url,
    questionnaire:
      row.questionnaire && typeof row.questionnaire === "object"
        ? row.questionnaire
        : { questions: [] },
    accessScope: row.access_scope,
    cohortId: row.cohort_id,
    menteeId: row.mentee_id,
    position: row.position ?? 0,
    active: row.active !== false,
  };
}

function sanitizeStageQuestions(input: unknown) {
  const source =
    input && typeof input === "object" && Array.isArray((input as any).questions)
      ? (input as any).questions
      : [];
  const questions = source.slice(0, 50).flatMap((question: any, index: number) => {
    const prompt = String(question?.prompt ?? "").trim().slice(0, 1000);
    if (!prompt) return [];
    const type = ["short_text", "long_text", "single_choice"].includes(question?.type)
      ? question.type
      : "short_text";
    const options =
      type === "single_choice" && Array.isArray(question?.options)
        ? question.options
            .map((value: unknown) => String(value).trim().slice(0, 300))
            .filter(Boolean)
            .slice(0, 20)
        : [];
    return [
      {
        id: String(question?.id ?? crypto.randomUUID()),
        prompt,
        type,
        required: question?.required !== false,
        options,
        position: index,
      },
    ];
  });
  return { questions };
}

async function activeJourneyEnrollment(userId: string) {
  const { data, error } = await admin
    .from("enrollments")
    .select("id, program_id, cohort_id, mentee_id, current_month, status, created_at")
    .eq("mentee_id", userId)
    .neq("status", "desativada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function visibleStageContents(c: Context, contentType?: string) {
  const enrollment = await activeJourneyEnrollment(c.userId);
  if (!enrollment) return { enrollment: null, rows: [] as any[] };

  const [{ data: pillars }, { data: assignments }] = await Promise.all([
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
  const assigned = new Map((assignments ?? []).map((x: any) => [x.pillar_id, x.version_id]));
  const versionToPillar = new Map<string, any>();
  for (const pillar of pillars ?? []) {
    const versionId = assigned.get(pillar.id) ?? pillar.current_published_version_id;
    if (versionId) versionToPillar.set(versionId, pillar);
  }
  if (!versionToPillar.size) return { enrollment, rows: [] as any[] };

  const { data: steps, error: stepError } = await admin
    .from("journey_steps")
    .select("version_id, stable_key, title, month_number, release_at, position, access_scope, cohort_id, mentee_id")
    .in("version_id", [...versionToPillar.keys()])
    .is("archived_at", null)
    .order("position");
  if (stepError) throw new Error(stepError.message);

  const now = Date.now();
  const visibleSteps = (steps ?? []).filter(
    (step: any) =>
      step.month_number <= enrollment.current_month &&
      (!step.release_at || Date.parse(step.release_at) <= now) &&
      (step.access_scope === "general" ||
        (step.access_scope === "cohort" && step.cohort_id === enrollment.cohort_id) ||
        (step.access_scope === "mentee" && step.mentee_id === c.userId)),
  );
  if (!visibleSteps.length) return { enrollment, rows: [] as any[] };

  const stepByKey = new Map(visibleSteps.map((step: any) => [step.stable_key, step]));
  const pillarByStepKey = new Map(
    visibleSteps.map((step: any) => [step.stable_key, versionToPillar.get(step.version_id)]),
  );

  let query = admin
    .from("journey_stage_contents")
    .select("*")
    .in(
      "step_key",
      visibleSteps.map((step: any) => step.stable_key),
    )
    .eq("active", true)
    .order("position");
  if (contentType) query = query.eq("content_type", contentType);
  const { data: contents, error: contentError } = await query;
  if (contentError) throw new Error(contentError.message);

  const rows = (contents ?? [])
    .filter((row: any) => stageScopeAllowed(row, enrollment, c.userId))
    .map((row: any) => ({
      ...row,
      step: stepByKey.get(row.step_key),
      pillar: pillarByStepKey.get(row.step_key),
    }));
  return { enrollment, rows };
}

async function contentAction(c: Context, action: string, d: any) {
  if (action === "getJourneyContentLibrary") return loadLibrary(c.userId);

  if (action === "getStageContents") {
    await requireStaff(c);
    const pillarId = String(d.pillarId ?? "");
    const { data, error } = await c.admin
      .from("journey_stage_contents")
      .select("*")
      .eq("pillar_id", pillarId)
      .order("step_key")
      .order("position");
    if (error) throw new Error(error.message);
    return { items: (data ?? []).map(stageContentShape) };
  }

  if (action === "saveStageContent") {
    await requireStaff(c);
    const contentType = String(d.contentType ?? "");
    if (!["video", "material", "questionnaire"].includes(contentType))
      throw new Error("Tipo de conteúdo inválido.");

    const title = String(d.title ?? "").trim().slice(0, 180);
    if (!title) throw new Error("Informe o título do conteúdo.");

    const pillarId = String(d.pillarId ?? "");
    const stepKey = String(d.stepKey ?? "");
    const { data: draftVersion, error: versionError } = await c.admin
      .from("journey_versions")
      .select("id")
      .eq("pillar_id", pillarId)
      .eq("status", "draft")
      .maybeSingle();
    if (versionError || !draftVersion) throw new Error("Pilar inválido.");
    const { data: validStep, error: stepError } = await c.admin
      .from("journey_steps")
      .select("stable_key")
      .eq("version_id", draftVersion.id)
      .eq("stable_key", stepKey)
      .is("archived_at", null)
      .maybeSingle();
    if (stepError || !validStep) throw new Error("Etapa inválida para este pilar.");

    const accessScope = ["general", "cohort", "mentee"].includes(d.accessScope)
      ? d.accessScope
      : "general";
    const cohortId = accessScope === "cohort" ? String(d.cohortId ?? "") || null : null;
    const menteeId = accessScope === "mentee" ? String(d.menteeId ?? "") || null : null;
    if (accessScope === "cohort" && !cohortId) throw new Error("Selecione a turma.");
    if (accessScope === "mentee" && !menteeId) throw new Error("Selecione o mentorado.");

    const payload = {
      pillar_id: pillarId,
      step_key: stepKey,
      content_type: contentType,
      title,
      description: String(d.description ?? "").trim().slice(0, 5000),
      duration_minutes:
        contentType === "video" &&
        d.durationMinutes !== null &&
        d.durationMinutes !== undefined &&
        String(d.durationMinutes).trim() !== "" &&
        Number.isFinite(Number(d.durationMinutes))
          ? Math.max(1, Math.min(1440, Number(d.durationMinutes)))
          : null,
      media_path: contentType === "video" ? String(d.mediaPath ?? "") || null : null,
      file_path: contentType === "material" ? String(d.filePath ?? "") || null : null,
      external_url:
        ["video", "material"].includes(contentType) ? String(d.externalUrl ?? "") || null : null,
      questionnaire:
        contentType === "questionnaire"
          ? sanitizeStageQuestions(d.questionnaire)
          : { questions: [] },
      access_scope: accessScope,
      cohort_id: cohortId,
      mentee_id: menteeId,
      position: Number.isFinite(Number(d.position)) ? Math.max(0, Number(d.position)) : 0,
      active: d.active !== false,
      created_by: c.userId,
      updated_at: new Date().toISOString(),
    };

    const id = String(d.id ?? "").trim();

    if (!id && ["video", "questionnaire"].includes(contentType)) {
      let duplicateQuery = c.admin
        .from("journey_stage_contents")
        .select("id")
        .eq("pillar_id", pillarId)
        .eq("step_key", stepKey)
        .eq("content_type", contentType)
        .eq("access_scope", accessScope)
        .eq("active", true);

      if (accessScope === "cohort") duplicateQuery = duplicateQuery.eq("cohort_id", cohortId);
      else duplicateQuery = duplicateQuery.is("cohort_id", null);

      if (accessScope === "mentee") duplicateQuery = duplicateQuery.eq("mentee_id", menteeId);
      else duplicateQuery = duplicateQuery.is("mentee_id", null);

      const { data: duplicate, error: duplicateError } = await duplicateQuery.limit(1).maybeSingle();
      if (duplicateError) throw new Error(duplicateError.message);
      if (duplicate) {
        throw new Error(
          contentType === "video"
            ? "Já existe uma aula para esse público nesta etapa. Edite a aula existente."
            : "Já existe um questionário para esse público nesta etapa. Edite o questionário existente.",
        );
      }
    }

    const query = id
      ? c.admin
          .from("journey_stage_contents")
          .update(payload)
          .eq("id", id)
          .select("*")
          .single()
      : c.admin.from("journey_stage_contents").insert(payload).select("*").single();
    const { data, error } = await query;
    if (error || !data) throw new Error(error?.message ?? "Não foi possível salvar o conteúdo.");
    return { item: stageContentShape(data) };
  }

  if (action === "deleteStageContent") {
    await requireStaff(c);
    const id = String(d.id ?? "");
    const { data: existing, error: loadError } = await c.admin
      .from("journey_stage_contents")
      .select("file_path")
      .eq("id", id)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message);

    if (existing?.file_path) {
      const { error: storageError } = await c.admin.storage
        .from("journey-content")
        .remove([existing.file_path]);
      if (storageError) throw new Error(storageError.message);
    }

    const { error } = await c.admin.from("journey_stage_contents").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  if (action === "getMyAgendaMaterials") {
    const { rows } = await visibleStageContents(c, "material");
    const paths = rows
      .map((row: any) => row.file_path)
      .filter((value: unknown): value is string => typeof value === "string" && !!value);
    const signed = await signedBatch(paths);
    return {
      items: rows
        .sort(
          (a: any, b: any) =>
            (a.step?.month_number ?? 0) - (b.step?.month_number ?? 0) ||
            (a.pillar?.position ?? 0) - (b.pillar?.position ?? 0) ||
            (a.position ?? 0) - (b.position ?? 0),
        )
        .map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description ?? "",
          fileUrl:
            typeof row.file_path === "string" ? (signed.get(row.file_path) ?? null) : null,
          externalUrl: row.external_url ?? null,
          stepTitle: row.step?.title ?? "Etapa",
          pillarName: row.pillar?.name ?? "Jornada",
          monthNumber: row.step?.month_number ?? 1,
        })),
    };
  }

  if (action === "getStageQuestionnaireResponse") {
    const contentId = String(d.contentId ?? "");
    const visible = await visibleStageContents(c, "questionnaire");
    const row = visible.rows.find((item: any) => item.id === contentId);
    if (!row || !visible.enrollment) throw new Error("Questionário indisponível.");
    const { data, error } = await c.admin
      .from("journey_stage_questionnaire_responses")
      .select("answers, submitted_at")
      .eq("content_id", contentId)
      .eq("enrollment_id", visible.enrollment.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data
      ? { answers: data.answers ?? {}, submitted: !!data.submitted_at }
      : { answers: {}, submitted: false };
  }

  if (action === "submitStageQuestionnaire") {
    const contentId = String(d.contentId ?? "");
    const visible = await visibleStageContents(c, "questionnaire");
    const row = visible.rows.find((item: any) => item.id === contentId);
    if (!row || !visible.enrollment) throw new Error("Questionário indisponível.");

    const questionnaire =
      row.questionnaire && typeof row.questionnaire === "object"
        ? row.questionnaire
        : { questions: [] };
    const questions = Array.isArray(questionnaire.questions) ? questionnaire.questions : [];
    const rawAnswers =
      d.answers && typeof d.answers === "object" && !Array.isArray(d.answers) ? d.answers : {};
    const answers: Record<string, string> = {};

    for (const question of questions) {
      const id = String(question?.id ?? "");
      if (!id) continue;
      const value = String((rawAnswers as any)[id] ?? "").trim().slice(0, 10000);
      if (question?.required !== false && !value)
        throw new Error("Responda todas as perguntas obrigatórias.");
      if (
        question?.type === "single_choice" &&
        value &&
        Array.isArray(question?.options) &&
        !question.options.includes(value)
      )
        throw new Error("Uma das respostas selecionadas é inválida.");
      answers[id] = value;
    }

    const { error } = await c.admin.from("journey_stage_questionnaire_responses").upsert(
      {
        content_id: contentId,
        enrollment_id: visible.enrollment.id,
        user_id: c.userId,
        answers,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "content_id,enrollment_id" },
    );
    if (error) throw new Error(error.message);

    await c.admin.from("journey_content_progress").upsert(
      {
        enrollment_id: visible.enrollment.id,
        step_key: row.step_key,
        user_id: c.userId,
        current_seconds: 0,
        duration_seconds: null,
        completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,step_key" },
    );

    return { ok: true, submitted: true };
  }

  if (action === "createJourneyUpload") {
    await requireStaff(c);
    const image = ["image/png", "image/jpeg", "image/webp"].includes(d.contentType);
    const video = ["video/mp4", "video/webm", "video/quicktime"].includes(d.contentType);
    if (d.kind === "cover" && (!image || d.size > 12_000_000))
      throw new Error("A capa deve ser PNG, JPG ou WebP e ter no máximo 12 MB.");
    if (d.kind === "media" && !video)
      throw new Error("A gravação deve ser MP4, WebM ou MOV.");
    const ext =
      String(d.fileName)
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "bin";
    const folder = d.kind === "cover" ? "covers" : d.kind === "media" ? "media" : "materials";
    const path = `${folder}/${c.userId}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await c.admin.storage
      .from("journey-content")
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw new Error(error?.message ?? "Não foi possível preparar o upload.");
    return { path, token: data.token };
  }
  const { library, item } = await requireContent(c, d.stepKey);
  if (action === "getJourneyContent") {
    const available = library.items.filter(
      (x: any) => videoFormats.has(x.format) && x.availability !== "coming_soon",
    );
    const i = available.findIndex((x: any) => x.stepKey === item.stepKey);
    return {
      item,
      enrollmentId: library.enrollmentId,
      previous: i > 0 ? available[i - 1].stepKey : null,
      next: i >= 0 && i < available.length - 1 ? available[i + 1].stepKey : null,
    };
  }
  if (action === "getJourneyStudyState") {
    const [{ data: note }, { data: markers }, { data: progress }] = await Promise.all([
      c.admin
        .from("journey_content_notes")
        .select("content, updated_at")
        .eq("user_id", c.userId)
        .eq("step_key", d.stepKey)
        .maybeSingle(),
      c.admin
        .from("journey_content_markers")
        .select("id, timestamp_seconds, reflection, created_at")
        .eq("user_id", c.userId)
        .eq("step_key", d.stepKey)
        .order("timestamp_seconds"),
      c.admin
        .from("journey_content_progress")
        .select("current_seconds, duration_seconds, completed")
        .eq("enrollment_id", library.enrollmentId)
        .eq("step_key", d.stepKey)
        .maybeSingle(),
    ]);
    return {
      note: note?.content ?? "",
      markers: markers ?? [],
      currentSeconds: progress?.current_seconds ?? 0,
      durationSeconds: progress?.duration_seconds ?? null,
      completed: !!progress?.completed,
    };
  }
  if (action === "saveJourneyContentNote") {
    const { error } = await c.admin.from("journey_content_notes").upsert(
      {
        enrollment_id: library.enrollmentId,
        step_key: d.stepKey,
        user_id: c.userId,
        content: String(d.content ?? "").slice(0, 30000),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,step_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  }
  if (action === "addJourneyContentMarker") {
    const { data, error } = await c.admin
      .from("journey_content_markers")
      .insert({
        enrollment_id: library.enrollmentId,
        step_key: d.stepKey,
        user_id: c.userId,
        timestamp_seconds: d.timestampSeconds,
        reflection: d.reflection,
      })
      .select("id, timestamp_seconds, reflection, created_at")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  if (action === "saveJourneyContentProgress") {
    const { data: old } = await c.admin
      .from("journey_content_progress")
      .select("completed")
      .eq("enrollment_id", library.enrollmentId)
      .eq("step_key", d.stepKey)
      .maybeSingle();
    const completed =
      !!old?.completed ||
      (!!d.ended && d.durationSeconds > 0 && d.currentSeconds >= d.durationSeconds * 0.9);
    const { error } = await c.admin.from("journey_content_progress").upsert(
      {
        enrollment_id: library.enrollmentId,
        step_key: d.stepKey,
        user_id: c.userId,
        current_seconds: d.currentSeconds,
        duration_seconds: d.durationSeconds ?? null,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,step_key" },
    );
    if (error) throw new Error(error.message);
    if (!old?.completed && completed)
      await notifyStageCompleted(library.enrollmentId, c.userId, d.stepKey);
    return { completed };
  }
  throw new Error("Ação de conteúdo inválida.");
}

async function ownEnrollment(c: Context) {
  const { data, error } = await c.admin
    .from("enrollments")
    .select("id, mentee_id")
    .eq("mentee_id", c.userId)
    .neq("status", "desativada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sua jornada ainda não possui uma matrícula ativa.");
  return data;
}
async function ownAttempt(c: Context, id: string) {
  const { data, error } = await c.admin
    .from("assessment_attempts")
    .select("*")
    .eq("id", id)
    .eq("mentee_id", c.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Aplicação não encontrada.");
  return data;
}
const publicAssessment = (result: any, full: boolean) =>
  filterAssessmentResultForAudience(result, full ? "mentee_full" : "mentee_summary");
async function plans(c: Context, attemptId: string, includePrivate: boolean) {
  const { data, error } = await c.admin
    .from("assessment_development_plans")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("created_at");
  if (error) throw new Error(error.message);
  const visible = includePrivate
    ? (data ?? [])
    : (data ?? []).filter((x: any) => x.shared_with_mentee);
  if (!includePrivate || !visible.length) return visible;
  const { data: notes } = await c.admin
    .from("assessment_development_private_notes")
    .select("plan_id, content")
    .in(
      "plan_id",
      visible.map((x: any) => x.id),
    );
  const byId = new Map((notes ?? []).map((x: any) => [x.plan_id, x.content]));
  return visible.map((x: any) => ({ ...x, internal_notes: byId.get(x.id) ?? "" }));
}

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const AI_AUDIENCE = "mentor_full";
const AI_RESPONSE_FORMAT_NAME = "rise_assessment_interpretation";
const AI_INSTRUCTIONS = `Você interpreta resultados já calculados do Mapeamento de Desenvolvimento RISE.
O cálculo é definitivo e foi feito pelo algoritmo RISE. Nunca recalcule, corrija, estime, normalize ou invente pontuações.
Use somente os resultados fornecidos. Não faça diagnóstico clínico, não rotule a pessoa e não trate tendências como verdades absolutas.
Escreva em português brasileiro, com linguagem respeitosa, objetiva e útil para desenvolvimento profissional.
Cada afirmação deve ser compatível com os scores e evidências recebidos. Em evidence_notes, cite somente evidence_ids presentes na entrada.
summary_for_mentee deve ser um resumo seguro e acolhedor. mentor_guidance e evidence_notes são exclusivos da equipe até revisão.
Retorne exclusivamente o JSON definido pelo schema.`;

function assessmentEvidenceIds(result: any) {
  const ids = new Set<string>();
  for (const collection of [
    result.indicators,
    result.competencies,
    result.comparisons,
    result.motivations,
    result.leadership,
    result.strengths,
    result.development,
  ]) {
    for (const item of collection ?? []) {
      for (const id of item.evidence ?? item.itemIds ?? []) if (typeof id === "string") ids.add(id);
    }
  }
  return [...ids].sort();
}

function assessmentAIInput(result: any) {
  return {
    methodology: {
      assessment_version: result.assessmentVersion,
      scoring_version: result.scoringVersion,
      scale: "Scores determinísticos de 1 a 5. Diferenças são Adaptado menos Natural.",
      constraints: [
        "Os scores não podem ser alterados.",
        "A interpretação é exploratória e não diagnóstica.",
        "Natural e Adaptado são perspectivas de autorrelato.",
      ],
    },
    calculated_result: {
      indicators: result.indicators,
      competencies: result.competencies,
      comparisons: result.comparisons,
      motivations: result.motivations,
      leadership: result.leadership,
      strengths: result.strengths,
      development: result.development,
      summary: result.summary,
      limitations: result.limitations,
    },
    allowed_evidence_ids: assessmentEvidenceIds(result),
  };
}

function responseOutputText(payload: any) {
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "refusal") throw new Error("A OpenAI recusou esta interpretação.");
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("A OpenAI não retornou a interpretação estruturada.");
}

async function requestAssessmentInterpretation(result: any) {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const model = Deno.env.get("OPENAI_MODEL")?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no backend.");
  if (!model) throw new Error("OPENAI_MODEL não configurado no backend.");

  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 6000,
      instructions: AI_INSTRUCTIONS,
      input: JSON.stringify(assessmentAIInput(result)),
      text: {
        format: {
          type: "json_schema",
          name: AI_RESPONSE_FORMAT_NAME,
          strict: true,
          schema: AI_ASSESSMENT_OUTPUT_JSON_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok)
    throw new Error(`A OpenAI retornou HTTP ${response.status} para a geração da interpretação.`);
  const payload = await response.json();
  if (payload?.status !== "completed")
    throw new Error(
      `A OpenAI encerrou a geração com status ${String(payload?.status ?? "desconhecido")}.`,
    );
  const interpretation = parseAIAssessmentInterpretation(JSON.parse(responseOutputText(payload)));
  return {
    ...interpretation,
    _meta: {
      model,
      prompt_version: PROMPT_VERSION,
      schema_version: AI_OUTPUT_SCHEMA_VERSION,
      response_id: String(payload.id ?? ""),
    },
  };
}

async function runAssessmentAIGeneration(rowId: string, attemptId: string, result: any) {
  try {
    const output = await requestAssessmentInterpretation(result);
    const { error } = await admin
      .from("assessment_ai_outputs")
      .update({ status: "generated", output, generated_at: new Date().toISOString() })
      .eq("id", rowId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    console.info("assessment_ai_generated", { attemptId, promptVersion: PROMPT_VERSION });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha não identificada.";
    console.error("assessment_ai_failed", { attemptId, promptVersion: PROMPT_VERSION, message });
    await admin
      .from("assessment_ai_outputs")
      .update({ status: "failed", output: null, generated_at: null })
      .eq("id", rowId)
      .eq("status", "pending");
  }
}

async function findAssessmentAIOutput(attemptId: string, promptVersion?: string) {
  let query = admin
    .from("assessment_ai_outputs")
    .select("*")
    .eq("attempt_id", attemptId)
    .eq("audience", AI_AUDIENCE);
  if (promptVersion) query = query.eq("prompt_version", promptVersion);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function createAssessmentAIOutput(attemptId: string, result: any) {
  const evidenceIds = assessmentEvidenceIds(result);
  const { data, error } = await admin
    .from("assessment_ai_outputs")
    .insert({
      attempt_id: attemptId,
      audience: AI_AUDIENCE,
      prompt_version: PROMPT_VERSION,
      status: "pending",
      authorized_sections: [...AI_MENTEE_RELEASE_SECTIONS],
      evidence_ids: evidenceIds,
      output: null,
      generated_at: null,
    })
    .select("*")
    .single();
  if (!error) return { row: data, shouldGenerate: true };
  if (error.code !== "23505") throw new Error(error.message);
  const existing = await findAssessmentAIOutput(attemptId, PROMPT_VERSION);
  return { row: existing, shouldGenerate: false };
}

async function queueAssessmentAI(attemptId: string, result: any) {
  const { row, shouldGenerate } = await createAssessmentAIOutput(attemptId, result);
  if (!row || !shouldGenerate) return row;
  const task = runAssessmentAIGeneration(row.id, attemptId, result);
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else await task;
  return row;
}

async function queueAssessmentAISafely(attemptId: string, result: any) {
  try {
    return await queueAssessmentAI(attemptId, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha não identificada.";
    console.error("assessment_ai_queue_failed", {
      attemptId,
      promptVersion: PROMPT_VERSION,
      message,
    });
    return null;
  }
}

async function assessmentAIView(attemptId: string, options: { staff: boolean; released: boolean }) {
  const row = await findAssessmentAIOutput(attemptId);
  if (!row)
    return {
      status: "unavailable",
      promptVersion: PROMPT_VERSION,
      generatedAt: null,
      authorizedSections: [],
      output: null,
      canRetry: true,
    };
  let output = null;
  if (row.status === "generated" && row.output) {
    if (options.staff) output = row.output;
    else if (options.released)
      output = projectAIAssessmentSections(row.output, row.authorized_sections ?? []);
    else output = projectAIAssessmentSections(row.output, ["summary_for_mentee"]);
  }
  return {
    status: row.status,
    promptVersion: row.prompt_version,
    generatedAt: row.generated_at,
    authorizedSections: options.staff
      ? [...AI_MENTOR_SECTIONS]
      : options.released
        ? (row.authorized_sections ?? [])
        : ["summary_for_mentee"],
    output,
    canRetry: row.status === "failed" || (options.staff && row.status === "generated"),
  };
}

async function generateAssessmentAIExplicitly(c: Context, d: any) {
  const staff = await isStaff(c);
  const attempt = staff
    ? (await c.admin.from("assessment_attempts").select("*").eq("id", d.attemptId).maybeSingle())
        .data
    : await ownAttempt(c, d.attemptId);
  if (!attempt || attempt.status !== "completed" || !attempt.calculated_result)
    throw new Error("O mapeamento precisa estar concluído antes da interpretação.");
  if (d.force && !staff)
    throw new Error("A regeneração de uma interpretação concluída é restrita à equipe RISE NOW.");

  let row = await findAssessmentAIOutput(attempt.id, PROMPT_VERSION);
  if (!row) {
    const created = await createAssessmentAIOutput(attempt.id, attempt.calculated_result);
    row = created.row;
    if (created.shouldGenerate && row)
      await runAssessmentAIGeneration(row.id, attempt.id, attempt.calculated_result);
  } else if (row.status === "failed" || (row.status === "generated" && d.force)) {
    const { data, error } = await c.admin
      .from("assessment_ai_outputs")
      .update({ status: "pending", output: null, generated_at: null })
      .eq("id", row.id)
      .neq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      row = data;
      await runAssessmentAIGeneration(row.id, attempt.id, attempt.calculated_result);
    }
  }
  await audit(c, d.force ? "assessment_ai_regenerated" : "assessment_ai_retried", attempt.id, {
    promptVersion: PROMPT_VERSION,
  });
  return assessmentAIView(attempt.id, {
    staff,
    released: attempt.report_status === "full_report_released",
  });
}

async function assessmentAction(c: Context, action: string, d: any) {
  if (action === "getMyAssessmentState") {
    const enrollment = await ownEnrollment(c);
    const { data: attempt, error } = await c.admin
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
    if (!attempt) return { attempt: null, answers: [] };
    const { data: responses } = await c.admin
      .from("assessment_responses")
      .select("item_id, value")
      .eq("attempt_id", attempt.id);
    return {
      attempt,
      answers: (responses ?? []).map((x: any) => ({ itemId: x.item_id, value: x.value })),
    };
  }
  if (action === "startAssessment") {
    const enrollment = await ownEnrollment(c);
    const { data: open } = await c.admin
      .from("assessment_attempts")
      .select("id, status, current_index")
      .eq("enrollment_id", enrollment.id)
      .eq("assessment_version", ASSESSMENT_VERSION)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open) return open;
    const { data, error } = await c.admin
      .from("assessment_attempts")
      .insert({
        enrollment_id: enrollment.id,
        mentee_id: c.userId,
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
  }
  if (action === "saveAssessmentAnswer") {
    const index = ASSESSMENT_QUESTIONS.findIndex((q: any) => q.id === d.itemId);
    if (index < 0 || !Number.isInteger(d.value) || d.value < 1 || d.value > 5)
      throw new Error("Resposta inválida.");
    const attempt = await ownAttempt(c, d.attemptId);
    if (attempt.status !== "in_progress") throw new Error("Esta aplicação já foi concluída.");
    const q = ASSESSMENT_QUESTIONS[index];
    const { error } = await c.admin.from("assessment_responses").upsert(
      {
        attempt_id: d.attemptId,
        item_id: d.itemId,
        perspective: q.perspective,
        value: d.value,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,item_id" },
    );
    if (error) throw new Error(error.message);
    const currentIndex = Math.min(index + 1, ASSESSMENT_QUESTIONS.length - 1);
    await c.admin
      .from("assessment_attempts")
      .update({ current_index: currentIndex, updated_at: new Date().toISOString() })
      .eq("id", d.attemptId);
    return { ok: true, currentIndex };
  }
  if (action === "completeAssessment") {
    const attempt = await ownAttempt(c, d.attemptId);
    if (attempt.status === "completed" && attempt.calculated_result) {
      await queueAssessmentAISafely(attempt.id, attempt.calculated_result);
      return publicAssessment(
        attempt.calculated_result,
        attempt.report_status === "full_report_released",
      );
    }
    const { data: responses, error } = await c.admin
      .from("assessment_responses")
      .select("item_id, value")
      .eq("attempt_id", d.attemptId);
    if (error) throw new Error(error.message);
    const result = calculateAssessment(
      (responses ?? []).map((x: any) => ({ itemId: x.item_id, value: x.value })),
    );
    const now = new Date().toISOString();
    const { error: ue } = await c.admin
      .from("assessment_attempts")
      .update({
        status: "completed",
        current_index: ASSESSMENT_QUESTIONS.length,
        completed_at: now,
        calculated_at: result.calculatedAt,
        calculated_result: result,
        report_status: "summary_available",
        updated_at: now,
      })
      .eq("id", d.attemptId);
    if (ue) throw new Error(ue.message);
    if (d.stepKey) {
      await Promise.all([
        c.admin.from("journey_content_progress").upsert(
          {
            enrollment_id: attempt.enrollment_id,
            user_id: c.userId,
            step_key: d.stepKey,
            current_seconds: 0,
            completed: true,
            completed_at: now,
            updated_at: now,
          },
          { onConflict: "enrollment_id,step_key" },
        ),
        c.admin.from("journey_step_progress").upsert(
          {
            enrollment_id: attempt.enrollment_id,
            step_key: d.stepKey,
            status: "completed",
            completed_at: now,
            confirmation_source: "assessment_system",
            updated_at: now,
          },
          { onConflict: "enrollment_id,step_key" },
        ),
      ]);
      await notifyStageCompleted(attempt.enrollment_id, c.userId, d.stepKey);
    }
    await queueAssessmentAISafely(attempt.id, result);
    return publicAssessment(result, false);
  }
  if (action === "getMyAssessmentProfile") {
    const enrollment = await ownEnrollment(c);
    const { data: attempts, error } = await c.admin
      .from("assessment_attempts")
      .select(
        "id, status, started_at, completed_at, assessment_version, scoring_version, report_status, reviewed_at, released_at, calculated_result",
      )
      .eq("enrollment_id", enrollment.id)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    const mapped = (attempts ?? []).map((x: any) => ({
      ...x,
      calculated_result: x.calculated_result
        ? publicAssessment(x.calculated_result, x.report_status === "full_report_released")
        : null,
    }));
    const latest = mapped.find((x: any) => x.status === "completed") ?? null;
    return {
      enrollmentId: enrollment.id,
      latest,
      attempts: mapped.map(({ calculated_result: _r, ...x }: any) => x),
      plans: latest ? await plans(c, latest.id, false) : [],
      aiAnalysis: latest
        ? await assessmentAIView(latest.id, {
            staff: false,
            released: latest.report_status === "full_report_released",
          })
        : null,
    };
  }
  if (action === "generateAssessmentInterpretation") return generateAssessmentAIExplicitly(c, d);
  await requireStaff(c);
  if (action === "getMentorAssessmentProfile") {
    const { data: enrollment, error: ee } = await c.admin
      .from("enrollments")
      .select(
        "id, mentee:profiles!enrollments_mentee_id_fkey(id, display_name, full_name, email, profession)",
      )
      .eq("id", d.enrollmentId)
      .maybeSingle();
    if (ee || !enrollment) throw new Error(ee?.message ?? "Mentorada não encontrada.");
    const { data: attempts, error } = await c.admin
      .from("assessment_attempts")
      .select("*")
      .eq("enrollment_id", d.enrollmentId)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    const latest = (attempts ?? []).find((x: any) => x.status === "completed") ?? null;
    return {
      enrollment,
      latest,
      attempts: (attempts ?? []).map(({ calculated_result: _r, ...x }: any) => x),
      plans: latest ? await plans(c, latest.id, true) : [],
      aiAnalysis: latest
        ? await assessmentAIView(latest.id, { staff: true, released: true })
        : null,
    };
  }
  if (action === "releaseAssessmentReport") {
    const { data: attempt } = await c.admin
      .from("assessment_attempts")
      .select("id, status")
      .eq("id", d.attemptId)
      .eq("enrollment_id", d.enrollmentId)
      .maybeSingle();
    if (!attempt || attempt.status !== "completed")
      throw new Error("Relatório concluído não encontrado.");
    const now = new Date().toISOString();
    const { error } = await c.admin
      .from("assessment_attempts")
      .update({
        report_status: "full_report_released",
        reviewed_by: c.userId,
        reviewed_at: now,
        released_by: c.userId,
        released_at: now,
        updated_at: now,
      })
      .eq("id", d.attemptId);
    if (error) throw new Error(error.message);
    await audit(c, "assessment_report_released", d.attemptId, { enrollmentId: d.enrollmentId });
    return { ok: true };
  }
  if (action === "saveAssessmentDevelopmentPlan") {
    const { data: attempt } = await c.admin
      .from("assessment_attempts")
      .select("id")
      .eq("id", d.attemptId)
      .eq("enrollment_id", d.enrollmentId)
      .maybeSingle();
    if (!attempt) throw new Error("Aplicação não encontrada.");
    const { data: plan, error } = await c.admin
      .from("assessment_development_plans")
      .insert({
        attempt_id: d.attemptId,
        enrollment_id: d.enrollmentId,
        created_by: c.userId,
        priority_focus: d.priorityFocus,
        objective: d.objective,
        action: d.action,
        progress_evidence: d.progressEvidence || null,
        due_date: d.dueDate ?? null,
        review_date: d.reviewDate ?? null,
        observations: d.observations || null,
        status: d.status,
        responsible: d.responsible || null,
        shared_with_mentee: !!d.sharedWithMentee,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (d.internalNotes) {
      const { error: ne } = await c.admin
        .from("assessment_development_private_notes")
        .insert({ plan_id: plan.id, author_id: c.userId, content: d.internalNotes });
      if (ne) throw new Error(ne.message);
    }
    return { ok: true, id: plan.id };
  }
  throw new Error("Ação de avaliação inválida.");
}

const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
];
const bytes = (value: string) => new TextEncoder().encode(value);
const b64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const unb64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const unb64url = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return unb64(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
};
async function hmac(value: string) {
  const secret = env("GOOGLE_OAUTH_STATE_SECRET");
  if (!secret) throw new Error("Segredo OAuth do Google não configurado.");
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes(value))))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
async function encryptionKey() {
  const raw = env("APP_USER_CONNECTION_KEY_SECRET");
  if (!raw) throw new Error("Segredo de conexão Google não configurado.");
  const data = unb64(raw);
  if (data.length !== 32)
    throw new Error("APP_USER_CONNECTION_KEY_SECRET precisa ter 32 bytes em Base64.");
  return crypto.subtle.importKey("raw", data, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await encryptionKey(),
      bytes(JSON.stringify(value)),
    ),
  );
  return `${b64(iv)}.${b64(encrypted)}`;
}
async function decrypt(value: string) {
  const [iv, ciphertext] = value.split(".");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    await encryptionKey(),
    unb64(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
async function saveGoogle(userId: string, tokens: any) {
  const { error } = await admin.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: "google_calendar",
      connection_key_ciphertext: await encrypt(tokens),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw new Error(error.message);
}
async function googleTokens(userId: string) {
  const { data, error } = await admin
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", "google_calendar")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return decrypt(data.connection_key_ciphertext);
}
async function googleAccess(userId: string) {
  const tokens = await googleTokens(userId);
  if (!tokens) return null;
  if (tokens.access_token && Number(tokens.expires_at ?? 0) > Date.now() + 60_000)
    return tokens.access_token;
  if (!tokens.refresh_token) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID")!,
      client_secret: env("GOOGLE_CLIENT_SECRET")!,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });
  if (!response.ok) return null;
  const next = await response.json();
  const merged = {
    ...tokens,
    ...next,
    expires_at: Date.now() + Number(next.expires_in ?? 3600) * 1000,
  };
  await saveGoogle(userId, merged);
  return merged.access_token;
}
async function googleFetch(userId: string, path: string, init: RequestInit = {}) {
  const token = await googleAccess(userId);
  if (!token) return new Response("Reconnect required", { status: 401 });
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(`https://www.googleapis.com${path}`, { ...init, headers });
}
async function googleAction(c: Context, action: string, d: any) {
  if (action === "startGoogleConnect") {
    const clientId = env("GOOGLE_CLIENT_ID");
    const appBase = env("APP_BASE_URL");
    if (!clientId || !appBase) throw new Error("Conexão com o Google ainda não configurada.");
    const payload = b64(
      bytes(JSON.stringify({ userId: c.userId, expires: Date.now() + 10 * 60_000 })),
    )
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    const state = `${payload}.${await hmac(payload)}`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: new URL("/oauth/google/return", appBase).toString(),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: googleScopes.join(" "),
      state,
      include_granted_scopes: "true",
    });
    return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }
  if (action === "completeGoogleConnect") {
    const [payload, signature] = String(d.state ?? "").split(".");
    if (!payload || signature !== (await hmac(payload))) throw new Error("Estado OAuth inválido.");
    const state = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    if (state.userId !== c.userId || state.expires < Date.now())
      throw new Error("Autorização OAuth expirada.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: d.code,
        client_id: env("GOOGLE_CLIENT_ID")!,
        client_secret: env("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: new URL("/oauth/google/return", env("APP_BASE_URL")!).toString(),
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) throw new Error("O Google não concluiu a conexão.");
    const tokens = await response.json();
    await saveGoogle(c.userId, {
      ...tokens,
      expires_at: Date.now() + Number(tokens.expires_in ?? 3600) * 1000,
    });
    return { ok: true };
  }
  if (action === "googleStatus") {
    const token = await googleAccess(c.userId);
    if (!token)
      return { connected: false, reconnectRequired: !!(await googleTokens(c.userId)), email: null };
    const response = await googleFetch(c.userId, "/oauth2/v2/userinfo");
    const profile = response.ok ? await response.json() : null;
    return { connected: true, reconnectRequired: false, email: profile?.email ?? null };
  }
  if (action === "disconnectGoogle") {
    const token = await googleAccess(c.userId);
    if (token)
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }).catch(() => null);
    await c.admin
      .from("app_user_connections")
      .delete()
      .eq("user_id", c.userId)
      .eq("connector_id", "google_calendar");
    return { ok: true };
  }
  await requireStaff(c);
  if (action === "updateMeeting") {
    const { error } = await c.db
      .from("meetings")
      .update({ recording_url: d.recordingUrl ?? null, join_url: d.joinUrl ?? null })
      .eq("id", d.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
  if (action === "cancelMeeting") {
    const { data: meeting } = await c.db
      .from("meetings")
      .select("google_event_id, created_by")
      .eq("id", d.id)
      .maybeSingle();
    if (!meeting) throw new Error("Encontro não encontrado");
    let googleWarning = false;
    if (meeting.google_event_id && meeting.created_by) {
      const res = await googleFetch(
        meeting.created_by,
        `/calendar/v3/calendars/primary/events/${encodeURIComponent(meeting.google_event_id)}?sendUpdates=all`,
        { method: "DELETE" },
      );
      googleWarning = !res.ok && ![404, 410].includes(res.status);
    }
    const { error } = await c.db.from("meetings").delete().eq("id", d.id);
    if (error) throw new Error(error.message);
    return { ok: true, googleWarning };
  }
  if (action !== "createMeeting") throw new Error("Ação Google inválida.");
  let query = c.admin
    .from("enrollments")
    .select("id, mentee:profiles!enrollments_mentee_id_fkey(email)")
    .eq("status", "ativa");
  if (d.audience === "cohort") query = query.eq("cohort_id", d.cohortId);
  if (d.audience === "selected")
    query = query.in(
      "id",
      d.enrollmentIds?.length ? d.enrollmentIds : ["00000000-0000-0000-0000-000000000000"],
    );
  const { data: invitees } = await query;
  const emails = (invitees ?? []).map((x: any) => x.mentee?.email).filter(Boolean);
  let mentorName = null;
  if (d.mentorId) {
    const { data: p } = await c.admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", d.mentorId)
      .maybeSingle();
    mentorName = p?.full_name ?? null;
    if (p?.email) emails.push(p.email);
  }
  let joinUrl = d.joinUrl ?? null;
  let googleEventId = null;
  if (d.createMeet) {
    const res = await googleFetch(
      c.userId,
      "/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `RISE NOW · ${d.title}`,
          description: d.description ?? "",
          start: { dateTime: d.startsAt, timeZone: "America/Sao_Paulo" },
          end: { dateTime: d.endsAt, timeZone: "America/Sao_Paulo" },
          attendees: [...new Set(emails)].map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );
    if (res.status === 401)
      return {
        ok: false,
        error: "Sua conexão com o Google precisa ser renovada. Clique em Reconectar.",
      };
    if (!res.ok)
      return { ok: false, error: `O Google recusou a criação do evento (${res.status}).` };
    const event = await res.json();
    googleEventId = event.id;
    joinUrl = event.hangoutLink ?? joinUrl;
  }
  const minutes = Math.max(15, Math.round((Date.parse(d.endsAt) - Date.parse(d.startsAt)) / 60000));
  const { data: meeting, error } = await c.db
    .from("meetings")
    .insert({
      title: d.title,
      description: d.description || null,
      kind: d.kind,
      scheduled_at: d.startsAt,
      ends_at: d.endsAt,
      duration_minutes: minutes,
      join_url: joinUrl,
      audience: d.audience,
      cohort_id: d.audience === "cohort" ? d.cohortId : null,
      mentor_id: d.mentorId,
      mentor_name: mentorName,
      phase_id: d.phaseId,
      lesson_id: d.lessonId,
      google_event_id: googleEventId,
      created_by: c.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (d.audience === "selected" && d.enrollmentIds?.length) {
    const { error: ae } = await c.db
      .from("meeting_attendees")
      .insert(
        d.enrollmentIds.map((enrollment_id: string) => ({ meeting_id: meeting.id, enrollment_id })),
      );
    if (ae) throw new Error(ae.message);
  }
  return { ok: true, joinUrl };
}

async function whatsappAction(c: Context, action: string, d: any) {
  await requireStaff(c);
  if (action === "saveWhatsAppSettings") {
    const { error } = await c.admin
      .from("whatsapp_settings")
      .update({
        enabled_account_created: false,
        enabled_meeting_reminder: false,
        enabled_stage_released: false,
        enabled_stage_completed_mentee: false,
        enabled_stage_completed_mentor: false,
        meeting_reminder_hours: Math.max(1, Math.min(168, Number(d.meetingReminderHours))),
        updated_by: c.userId,
      })
      .eq("id", "primary");
    if (error) throw new Error(error.message);
    return { ok: true, providerConfigured: false };
  }
  if (action === "getWhatsAppAdminState") {
    const { data: s } = await c.admin
      .from("whatsapp_settings")
      .select("*")
      .eq("id", "primary")
      .maybeSingle();
    return {
      configured: false,
      provider: null,
      settings: {
        accountCreated: false,
        meetingReminder: false,
        stageReleased: false,
        stageCompletedMentee: false,
        stageCompletedMentor: false,
        meetingReminderHours: s?.meeting_reminder_hours ?? 24,
      },
    };
  }
  throw new Error("Ação WhatsApp inválida.");
}

const groups = {
  admin: new Set([
    "getDirectory",
    "createMember",
    "createMentorSpecialty",
    "updateEnrollment",
    "updateAccess",
    "resetMemberPassword",
  ]),
  journey: new Set([
    "getJourneyEditor",
    "saveJourneyDraft",
    "publishJourneyDraft",
    "getNextJourneyStep",
    "startJourneyStep",
    "confirmJourneyStep",
  ]),
  content: new Set([
    "getJourneyContentLibrary",
    "getJourneyContent",
    "getJourneyStudyState",
    "saveJourneyContentNote",
    "addJourneyContentMarker",
    "saveJourneyContentProgress",
    "createJourneyUpload",
    "getStageContents",
    "saveStageContent",
    "deleteStageContent",
    "getMyAgendaMaterials",
    "getStageQuestionnaireResponse",
    "submitStageQuestionnaire",
  ]),
  assessment: new Set([
    "getMyAssessmentState",
    "startAssessment",
    "saveAssessmentAnswer",
    "completeAssessment",
    "generateAssessmentInterpretation",
    "getMyAssessmentProfile",
    "getMentorAssessmentProfile",
    "releaseAssessmentReport",
    "saveAssessmentDevelopmentPlan",
  ]),
  google: new Set([
    "googleStatus",
    "startGoogleConnect",
    "completeGoogleConnect",
    "disconnectGoogle",
    "createMeeting",
    "updateMeeting",
    "cancelMeeting",
  ]),
  whatsapp: new Set(["getWhatsAppAdminState", "saveWhatsAppSettings"]),
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return fail("Método não permitido.", 405);
  try {
    const c = await context(request);
    const body = await request.json();
    const action = String(body?.action ?? "");
    const d = body?.data ?? {};
    let result: unknown;
    if (groups.admin.has(action))
      result =
        action === "getDirectory"
          ? await getDirectory(c)
          : action === "createMember"
            ? await createMember(c, d)
            : action === "createMentorSpecialty"
              ? await createMentorSpecialty(c, d)
              : action === "updateEnrollment"
                ? await updateEnrollment(c, d)
                : action === "updateAccess"
                  ? await updateAccess(c, d)
                  : await resetMemberPassword(c, d);
    else if (groups.journey.has(action)) result = await journeyAction(c, action, d);
    else if (groups.content.has(action)) result = await contentAction(c, action, d);
    else if (groups.assessment.has(action)) result = await assessmentAction(c, action, d);
    else if (groups.google.has(action)) result = await googleAction(c, action, d);
    else if (groups.whatsapp.has(action)) result = await whatsappAction(c, action, d);
    else return fail("Ação de backend desconhecida.", 404);
    return json(result);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Falha interna.";
    return fail(
      message,
      /autentic|sessão/i.test(message) ? 401 : /acesso restrito/i.test(message) ? 403 : 400,
    );
  }
});
