-- Publishing used to reject valid stages whenever all three optional impact-copy
-- fields were empty. The editor does not mark those fields as required and the
-- existing journey intentionally contains stages without an impact headline.
-- Keep publication validation aligned with the actual required fields.

create or replace function private.publish_journey_draft(
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
      and (coalesce(trim(title), '') = '' or coalesce(trim(description), '') = '')
  ) then
    raise exception 'Preencha título e descrição antes de publicar.';
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

revoke execute on function private.publish_journey_draft(uuid, integer, boolean)
  from public, anon;
grant execute on function private.publish_journey_draft(uuid, integer, boolean)
  to authenticated, service_role;

comment on function private.publish_journey_draft(uuid, integer, boolean) is
  'Publishes a validated journey draft. Impact headline fragments are optional.';
