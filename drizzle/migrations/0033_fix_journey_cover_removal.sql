-- Preserve explicit removal of light/dark journey covers.
-- The theme-specific fields must stay NULL when the admin removes a cover,
-- instead of being silently repopulated from the legacy cover_path fallback.

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
      case
        when v_step ? 'coverPathLight'
          then nullif(v_step->>'coverPathLight', '')
        else coalesce(
          nullif(v_step->>'coverPathLight', ''),
          nullif(v_step->>'coverPath', ''),
          nullif(v_step->>'coverPathDark', '')
        )
      end,
      case
        when v_step ? 'coverPathDark'
          then nullif(v_step->>'coverPathDark', '')
        else coalesce(
          nullif(v_step->>'coverPathDark', ''),
          nullif(v_step->>'coverPath', ''),
          nullif(v_step->>'coverPathLight', '')
        )
      end,
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
