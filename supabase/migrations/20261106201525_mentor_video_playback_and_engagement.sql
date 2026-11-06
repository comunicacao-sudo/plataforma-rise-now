alter table public.journey_stage_contents
  add column duration_seconds integer check (duration_seconds > 0 and duration_seconds <= 86400),
  add column source_revision integer not null default 1;

create function private.bump_video_source_revision() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.media_path is distinct from old.media_path or new.external_url is distinct from old.external_url then
    new.source_revision := old.source_revision + 1;
  else new.source_revision := old.source_revision;
  end if;
  return new;
end $$;
create trigger stage_video_source_revision before update on public.journey_stage_contents
for each row execute function private.bump_video_source_revision();
revoke all on function private.bump_video_source_revision() from public,anon,authenticated;

create table public.journey_video_progress (
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  content_id uuid not null references public.journey_stage_contents(id) on delete cascade,
  source_revision integer not null check(source_revision>0),
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_seconds integer not null default 0 check(current_seconds>=0),
  max_seconds integer not null default 0 check(max_seconds>=0),
  duration_seconds integer check(duration_seconds>0 and duration_seconds<=86400),
  completed boolean not null default false,
  first_viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(enrollment_id,content_id,source_revision)
);
create index journey_video_progress_content_idx on public.journey_video_progress(content_id);
create index journey_video_progress_user_idx on public.journey_video_progress(user_id);
alter table public.journey_video_progress enable row level security;
create policy "backend only" on public.journey_video_progress for all to authenticated using(false) with check(false);
revoke all on public.journey_video_progress from public,anon,authenticated;
grant all on public.journey_video_progress to service_role;

create function private.has_platform_access(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.allowed_emails a on lower(a.email)=lower(u.email)
 join public.user_roles r on r.user_id=u.id where u.id=p_user_id and u.deleted_at is null
 and (u.banned_until is null or u.banned_until<=now()) and a.status='approved' and a.archived_at is null
 and r.role in ('admin','mentor','mentee'))
$$;
revoke all on function private.has_platform_access(uuid) from public,anon,authenticated;
grant execute on function private.has_platform_access(uuid) to service_role;

create function private.authorized_stage_video(p_user_id uuid,p_content_id uuid,p_session_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.journey_stage_contents; e public.enrollments;
begin
 if not private.has_platform_access(p_user_id) then return null; end if;
 if p_session_id is not null and not exists(select 1 from auth.sessions s where s.id=p_session_id and s.user_id=p_user_id and (s.not_after is null or s.not_after>now())) then return null; end if;
 select * into c from public.journey_stage_contents where id=p_content_id and active=true and content_type='video';
 if c.id is null then return null; end if;
 if not (public.has_role(p_user_id,'admin') or public.has_role(p_user_id,'mentor')) then
  select * into e from public.enrollments where mentee_id=p_user_id and status<>'desativada' order by created_at desc limit 1;
  if e.id is null then return null; end if;
  if not (c.access_scope='general' or(c.access_scope='cohort' and c.cohort_id=e.cohort_id) or(c.access_scope='mentee' and c.mentee_id=p_user_id)) then return null; end if;
  if not exists(
   select 1 from public.journey_pillars p
   left join public.enrollment_journey_versions a on a.enrollment_id=e.id and a.pillar_id=p.id
   join public.journey_versions v on v.id=coalesce(a.version_id,p.current_published_version_id) and v.status in('published','archived')
   join public.journey_steps s on s.version_id=v.id and s.stable_key=c.step_key and s.archived_at is null
   where p.id=c.pillar_id and p.program_id=e.program_id and s.month_number<=e.current_month
   and (s.release_at is null or s.release_at<=now())
   and (s.access_scope='general' or(s.access_scope='cohort' and s.cohort_id=e.cohort_id) or(s.access_scope='mentee' and s.mentee_id=p_user_id))
  ) then return null; end if;
 end if;
 return jsonb_build_object('id',c.id,'stepKey',c.step_key,'mediaPath',c.media_path,'externalUrl',c.external_url,
 'revision',c.source_revision,'durationSeconds',c.duration_seconds,'durationMinutes',c.duration_minutes,'title',c.title,'enrollmentId',e.id);
end $$;
revoke all on function private.authorized_stage_video(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.authorized_stage_video(uuid,uuid,uuid) to service_role;

create function public.authorize_stage_video(p_user_id uuid,p_content_id uuid,p_session_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.authorized_stage_video(p_user_id,p_content_id,p_session_id)$$;
revoke all on function public.authorize_stage_video(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.authorize_stage_video(uuid,uuid,uuid) to service_role;

create function public.record_stage_video_progress(p_user_id uuid,p_content_id uuid,p_current integer,p_duration integer,p_ended boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare source jsonb; duration_value integer; position_value integer; ended_value boolean; saved public.journey_video_progress;
begin
 source:=private.authorized_stage_video(p_user_id,p_content_id);
 if source is null or source->>'enrollmentId' is null or public.has_role(p_user_id,'admin') or public.has_role(p_user_id,'mentor') then raise exception 'Acesso restrito ao mentorado deste vídeo.'; end if;
 if p_current is null or p_current<0 or p_current>86400 or(p_duration is not null and(p_duration<=0 or p_duration>86400)) then raise exception 'Progresso inválido.'; end if;
 duration_value:=coalesce((source->>'durationSeconds')::integer,p_duration);
 position_value:=case when duration_value is null then p_current else least(p_current,duration_value) end;
 if position_value=0 then return jsonb_build_object('completed',false); end if;
 ended_value:=coalesce(p_ended,false) and duration_value>0 and position_value>=duration_value*.9;
 insert into public.journey_video_progress(enrollment_id,content_id,source_revision,user_id,current_seconds,max_seconds,duration_seconds,completed,completed_at)
 values((source->>'enrollmentId')::uuid,p_content_id,(source->>'revision')::integer,p_user_id,position_value,position_value,duration_value,coalesce(ended_value,false),case when ended_value then now() end)
 on conflict(enrollment_id,content_id,source_revision) do update set current_seconds=excluded.current_seconds,
 max_seconds=greatest(journey_video_progress.max_seconds,excluded.max_seconds),duration_seconds=coalesce(excluded.duration_seconds,journey_video_progress.duration_seconds),
 completed=journey_video_progress.completed or excluded.completed,
 completed_at=coalesce(journey_video_progress.completed_at,excluded.completed_at),updated_at=now()
 returning * into saved;
 insert into public.journey_content_progress(enrollment_id,step_key,user_id,current_seconds,duration_seconds,completed,completed_at,updated_at)
 values(saved.enrollment_id,(source->>'stepKey')::uuid,p_user_id,saved.current_seconds,saved.duration_seconds,saved.completed,saved.completed_at,now())
 on conflict(enrollment_id,step_key) do update set current_seconds=excluded.current_seconds,
 duration_seconds=coalesce(excluded.duration_seconds,journey_content_progress.duration_seconds),
 completed=journey_content_progress.completed or excluded.completed,
 completed_at=coalesce(journey_content_progress.completed_at,excluded.completed_at),updated_at=now();
 return jsonb_build_object('completed',saved.completed);
end $$;
revoke all on function public.record_stage_video_progress(uuid,uuid,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.record_stage_video_progress(uuid,uuid,integer,integer,boolean) to service_role;

create function public.stage_video_engagement(p_content_ids uuid[])
returns table(content_id uuid,enrollment_id uuid,user_id uuid,display_name text,current_seconds integer,max_seconds integer,duration_seconds integer,completed boolean,first_viewed_at timestamptz,completed_at timestamptz,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select c.id,e.id,e.mentee_id,coalesce(nullif(p.display_name,''),p.full_name,'Mentorado'),
 coalesce(g.current_seconds,0),coalesce(g.max_seconds,0),coalesce(c.duration_seconds,g.duration_seconds),coalesce(g.completed,false),g.first_viewed_at,g.completed_at,g.updated_at
 from public.journey_stage_contents c join public.enrollments e on e.status<>'desativada'
 join public.profiles p on p.id=e.mentee_id
 left join public.journey_video_progress g on g.content_id=c.id and g.enrollment_id=e.id and g.source_revision=c.source_revision
 where c.id=any(p_content_ids) and c.content_type='video' and c.active=true
 and public.has_role(e.mentee_id,'mentee') and not(public.has_role(e.mentee_id,'admin') or public.has_role(e.mentee_id,'mentor'))
 and private.authorized_stage_video(e.mentee_id,c.id)->>'enrollmentId'=e.id::text
 order by coalesce(nullif(p.display_name,''),p.full_name,'Mentorado')
$$;
revoke all on function public.stage_video_engagement(uuid[]) from public,anon,authenticated;
grant execute on function public.stage_video_engagement(uuid[]) to service_role;

-- O Worker R2 já consulta esta RPC. Na prévia da equipe, um id de conteúdo
-- identifica exatamente a gravação escolhida, inclusive entre turmas diferentes.
create function private.staff_stage_media_path(p_content_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select c.media_path from public.journey_stage_contents c where c.id=p_content_id and c.content_type='video' and c.active=true
 and private.has_platform_access() and(public.has_role((select auth.uid()),'admin') or public.has_role((select auth.uid()),'mentor'))
$$;
revoke all on function private.staff_stage_media_path(uuid) from public,anon;
grant execute on function private.staff_stage_media_path(uuid) to authenticated,service_role;
create or replace function public.get_journey_media_path(_step_key uuid) returns text
language sql stable security invoker set search_path='' as $$
 select case when private.has_platform_access() then coalesce(private.staff_stage_media_path(_step_key),private.get_journey_media_path(_step_key)) end
$$;
revoke all on function public.get_journey_media_path(uuid) from public,anon;
grant execute on function public.get_journey_media_path(uuid) to authenticated,service_role;
