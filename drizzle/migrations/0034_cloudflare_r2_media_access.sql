-- Secure R2 media lookup for authenticated journey viewers.
-- Returns the stored media path only when the current user may access the step.

create or replace function public.get_journey_media_path(_step_key uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_path text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if public.is_admin() then
    select s.media_path
      into v_path
    from public.journey_steps s
    join public.journey_versions v on v.id = s.version_id
    where s.stable_key = _step_key
      and s.archived_at is null
      and s.media_path is not null
    order by
      case v.status when 'published' then 0 when 'draft' then 1 else 2 end,
      v.updated_at desc
    limit 1;

    return v_path;
  end if;

  select s.media_path
    into v_path
  from public.enrollments e
  join public.journey_pillars p on p.program_id = e.program_id
  left join public.enrollment_journey_versions ejv
    on ejv.enrollment_id = e.id and ejv.pillar_id = p.id
  join public.journey_versions v
    on v.id = coalesce(ejv.version_id, p.current_published_version_id)
    and v.status in ('published', 'archived')
  join public.journey_steps s on s.version_id = v.id
  where e.mentee_id = auth.uid()
    and coalesce(e.status, 'ativa') <> 'desativada'
    and s.stable_key = _step_key
    and s.archived_at is null
    and s.month_number <= e.current_month
    and (s.release_at is null or s.release_at <= now())
    and (
      s.access_scope = 'general'
      or (s.access_scope = 'cohort' and s.cohort_id = e.cohort_id)
      or (s.access_scope = 'mentee' and s.mentee_id = e.mentee_id)
    )
  limit 1;

  return v_path;
end
$function$;

revoke all on function public.get_journey_media_path(uuid) from public;
revoke all on function public.get_journey_media_path(uuid) from anon;
grant execute on function public.get_journey_media_path(uuid) to authenticated;
