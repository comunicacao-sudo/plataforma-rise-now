-- Keep the native RISE assessment immediately after “Mapa de Esclarecimento”
-- in every Reflexão journey version. The guard makes this safe to re-run.
do $$
declare
  journey_version record;
  map_position integer;
  assessment_position integer;
begin
  for journey_version in
    select v.id
    from public.journey_versions v
    join public.journey_pillars p on p.id = v.pillar_id
    where lower(p.name) in (lower('Reflexão'), lower('Reflexao'))
  loop
    select s.position into map_position
    from public.journey_steps s
    where s.version_id = journey_version.id
      and s.title ilike '%Mapa de Esclarecimento%'
      and s.archived_at is null
    limit 1;

    select s.position into assessment_position
    from public.journey_steps s
    where s.version_id = journey_version.id
      and s.stable_key = '7d2d3d63-9fc4-4d7a-a1c0-6e32a5c91c50'::uuid
      and s.archived_at is null
    limit 1;

    if map_position is not null
      and assessment_position is not null
      and assessment_position <> map_position + 1 then
      -- Vacate the assessment position before shifting subsequent steps.
      update public.journey_steps
      set position = -100000
      where version_id = journey_version.id
        and stable_key = '7d2d3d63-9fc4-4d7a-a1c0-6e32a5c91c50'::uuid;

      -- Shift in two phases to avoid collisions with the per-version unique key.
      update public.journey_steps
      set position = position + 10000
      where version_id = journey_version.id
        and archived_at is null
        and position >= map_position + 1;

      update public.journey_steps
      set position = position - 9999
      where version_id = journey_version.id
        and archived_at is null
        and position >= map_position + 10001;

      update public.journey_steps
      set position = map_position + 1
      where version_id = journey_version.id
        and stable_key = '7d2d3d63-9fc4-4d7a-a1c0-6e32a5c91c50'::uuid;
    end if;
  end loop;
end $$;
