-- Restore the missing editable drafts for the official RISE journey.
-- The published journey remains untouched; each draft is an exact working copy
-- of the pillar's current published version.

do $$
declare
  mismatch_count integer;
begin
  insert into public.journey_versions (
    pillar_id,
    status,
    version_number,
    revision,
    created_by
  )
  select
    jp.id,
    'draft',
    0,
    1,
    published.created_by
  from public.journey_pillars jp
  join public.journey_versions published
    on published.id = jp.current_published_version_id
   and published.status = 'published'
  where jp.current_published_version_id is not null
    and not exists (
      select 1
      from public.journey_versions existing
      where existing.pillar_id = jp.id
        and existing.status = 'draft'
    );

  insert into public.journey_steps (
    version_id,
    stable_key,
    title,
    format,
    impact_lead,
    impact_highlight,
    impact_tail,
    description,
    responsible_name,
    duration_minutes,
    resource_type,
    resource_id,
    resource_url,
    scheduled_at,
    release_at,
    completion_rule,
    required,
    position,
    archived_at,
    month_number,
    cover_path,
    media_path,
    summary,
    topics,
    materials,
    access_scope,
    cohort_id,
    mentee_id
  )
  select
    draft.id,
    published_step.stable_key,
    published_step.title,
    published_step.format,
    published_step.impact_lead,
    published_step.impact_highlight,
    published_step.impact_tail,
    published_step.description,
    published_step.responsible_name,
    published_step.duration_minutes,
    published_step.resource_type,
    published_step.resource_id,
    published_step.resource_url,
    published_step.scheduled_at,
    published_step.release_at,
    published_step.completion_rule,
    published_step.required,
    published_step.position,
    null,
    published_step.month_number,
    published_step.cover_path,
    published_step.media_path,
    published_step.summary,
    published_step.topics,
    published_step.materials,
    published_step.access_scope,
    published_step.cohort_id,
    published_step.mentee_id
  from public.journey_versions draft
  join public.journey_pillars jp
    on jp.id = draft.pillar_id
  join public.journey_steps published_step
    on published_step.version_id = jp.current_published_version_id
   and published_step.archived_at is null
  where draft.status = 'draft'
  on conflict (version_id, stable_key) do nothing;

  select count(*)
    into mismatch_count
  from public.journey_pillars jp
  join public.journey_versions draft
    on draft.pillar_id = jp.id
   and draft.status = 'draft'
  where jp.current_published_version_id is not null
    and (
      select count(*)
      from public.journey_steps draft_step
      where draft_step.version_id = draft.id
        and draft_step.archived_at is null
    ) <> (
      select count(*)
      from public.journey_steps published_step
      where published_step.version_id = jp.current_published_version_id
        and published_step.archived_at is null
    );

  if mismatch_count <> 0 then
    raise exception
      'Journey draft restoration aborted: % pillar drafts do not match their published step counts.',
      mismatch_count;
  end if;
end
$$;
