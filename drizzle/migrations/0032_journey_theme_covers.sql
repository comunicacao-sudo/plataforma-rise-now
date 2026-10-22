-- Theme-aware journey card covers.
-- Keeps the legacy cover_path as a compatibility fallback while allowing
-- independent artwork for light and dark platform themes.

alter table public.journey_steps
  add column if not exists cover_path_light text,
  add column if not exists cover_path_dark text;

update public.journey_steps
set
  cover_path_light = coalesce(cover_path_light, cover_path),
  cover_path_dark = coalesce(cover_path_dark, cover_path)
where cover_path is not null
  and (cover_path_light is null or cover_path_dark is null);

create or replace function public.save_journey_draft(
  p_pillar_id uuid,
  p_expected_revision integer,
  p_steps jsonb
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_version public.journey_versions%rowtype;
  v_step jsonb;
  v_position integer := 0;
begin
  if not public.can_manage_journey_pillar(p_pillar_id) then
    raise exception 'Acesso restrito ao pilar.';
  end if;

  select * into v_version
  from public.journey_versions
  where pillar_id = p_pillar_id and status = 'draft'
  for update;

  if v_version.id is null then
    raise exception 'Rascunho não encontrado.';
  end if;

  if v_version.revision <> p_expected_revision then
    raise exception 'Este rascunho foi alterado em outra sessão. Recarregue antes de salvar.';
  end if;

  delete from public.journey_steps where version_id = v_version.id;

  for v_step in
    select * from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb))
  loop
    insert into public.journey_steps (
      version_id, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
      description, responsible_name, duration_minutes, resource_type, resource_id,
      resource_url, scheduled_at, release_at, completion_rule, required, position,
      month_number, cover_path, cover_path_light, cover_path_dark, media_path, summary,
      topics, materials, access_scope, cohort_id, mentee_id
    ) values (
      v_version.id,
      coalesce((v_step->>'stableKey')::uuid, gen_random_uuid()),
      left(trim(coalesce(v_step->>'title', '')), 160),
      v_step->>'format',
      left(trim(coalesce(v_step->>'impactLead', '')), 180),
      left(trim(coalesce(v_step->>'impactHighlight', '')), 180),
      left(trim(coalesce(v_step->>'impactTail', '')), 180),
      left(trim(coalesce(v_step->>'description', '')), 1200),
      nullif(left(trim(coalesce(v_step->>'responsibleName', '')), 120), ''),
      nullif(v_step->>'durationMinutes', '')::integer,
      nullif(v_step->>'resourceType', ''),
      nullif(v_step->>'resourceId', ''),
      nullif(v_step->>'resourceUrl', ''),
      nullif(v_step->>'scheduledAt', '')::timestamptz,
      nullif(v_step->>'releaseAt', '')::timestamptz,
      coalesce(nullif(v_step->>'completionRule', ''), 'mentor_confirmation'),
      coalesce((v_step->>'required')::boolean, true),
      v_position,
      coalesce((v_step->>'monthNumber')::integer, 1),
      coalesce(
        nullif(v_step->>'coverPath', ''),
        nullif(v_step->>'coverPathDark', ''),
        nullif(v_step->>'coverPathLight', '')
      ),
      coalesce(
        nullif(v_step->>'coverPathLight', ''),
        nullif(v_step->>'coverPath', ''),
        nullif(v_step->>'coverPathDark', '')
      ),
      coalesce(
        nullif(v_step->>'coverPathDark', ''),
        nullif(v_step->>'coverPath', ''),
        nullif(v_step->>'coverPathLight', '')
      ),
      nullif(v_step->>'mediaPath', ''),
      left(trim(coalesce(v_step->>'summary', '')), 4000),
      array(select jsonb_array_elements_text(coalesce(v_step->'topics', '[]'::jsonb))),
      coalesce(v_step->'materials', '[]'::jsonb),
      coalesce(nullif(v_step->>'accessScope', ''), 'general'),
      nullif(v_step->>'cohortId', '')::uuid,
      nullif(v_step->>'menteeId', '')::uuid
    );

    v_position := v_position + 1;
  end loop;

  update public.journey_versions
  set revision = revision + 1, updated_at = now()
  where id = v_version.id
  returning revision into p_expected_revision;

  insert into public.audit_log(actor_id, action, target, payload)
  values (
    auth.uid(),
    'journey_draft_saved',
    p_pillar_id::text,
    jsonb_build_object('steps', v_position)
  );

  return p_expected_revision;
end
$function$;

create or replace function public.publish_journey_draft(
  p_pillar_id uuid,
  p_expected_revision integer,
  p_apply_active boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_draft public.journey_versions%rowtype;
  v_new_draft uuid;
  v_number integer;
  v_program uuid;
begin
  if not public.can_manage_journey_pillar(p_pillar_id) then
    raise exception 'Acesso restrito ao pilar.';
  end if;

  select * into v_draft
  from public.journey_versions
  where pillar_id = p_pillar_id and status = 'draft'
  for update;

  if v_draft.id is null or v_draft.revision <> p_expected_revision then
    raise exception 'O rascunho mudou. Recarregue antes de publicar.';
  end if;

  if exists (
    select 1
    from public.journey_steps
    where version_id = v_draft.id
      and (
        title = ''
        or (impact_lead = '' and impact_highlight = '' and impact_tail = '')
        or description = ''
      )
  ) then
    raise exception 'Preencha título, frase de impacto e descrição antes de publicar.';
  end if;

  if exists (
    select 1
    from public.journey_steps
    where version_id = v_draft.id
      and (
        (access_scope = 'cohort' and cohort_id is null)
        or (access_scope = 'mentee' and mentee_id is null)
      )
  ) then
    raise exception 'Defina o público de todos os conteúdos restritos.';
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_number
  from public.journey_versions
  where pillar_id = p_pillar_id
    and status in ('published', 'archived');

  update public.journey_versions
  set status = 'archived'
  where pillar_id = p_pillar_id
    and status = 'published';

  update public.journey_versions
  set
    status = 'published',
    version_number = v_number,
    published_at = now(),
    updated_at = now()
  where id = v_draft.id;

  update public.journey_pillars
  set current_published_version_id = v_draft.id, updated_at = now()
  where id = p_pillar_id
  returning program_id into v_program;

  if p_apply_active then
    insert into public.enrollment_journey_versions(enrollment_id, pillar_id, version_id)
    select e.id, p_pillar_id, v_draft.id
    from public.enrollments e
    where e.program_id = v_program
      and coalesce(e.status, 'ativa') = 'ativa'
    on conflict (enrollment_id, pillar_id) do update
      set version_id = excluded.version_id, assigned_at = now();
  end if;

  insert into public.journey_versions(pillar_id, status, version_number, revision, created_by)
  values (p_pillar_id, 'draft', 0, 1, auth.uid())
  returning id into v_new_draft;

  insert into public.journey_steps (
    version_id, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
    description, responsible_name, duration_minutes, resource_type, resource_id,
    resource_url, scheduled_at, release_at, completion_rule, required, position,
    month_number, cover_path, cover_path_light, cover_path_dark, media_path, summary,
    topics, materials, access_scope, cohort_id, mentee_id
  )
  select
    v_new_draft, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
    description, responsible_name, duration_minutes, resource_type, resource_id,
    resource_url, scheduled_at, release_at, completion_rule, required, position,
    month_number, cover_path, cover_path_light, cover_path_dark, media_path, summary,
    topics, materials, access_scope, cohort_id, mentee_id
  from public.journey_steps
  where version_id = v_draft.id
  order by position;

  insert into public.audit_log(actor_id, action, target, payload)
  values (
    auth.uid(),
    'journey_published',
    p_pillar_id::text,
    jsonb_build_object('version', v_number, 'applyActive', p_apply_active)
  );

  return v_draft.id;
end
$function$;
