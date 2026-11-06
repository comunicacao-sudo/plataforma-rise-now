alter table public.journey_content_markers add column content_id uuid references public.journey_stage_contents(id) on delete cascade;
create index journey_markers_video_idx on public.journey_content_markers(user_id,step_key,content_id);

create or replace function public.record_stage_video_progress(p_user_id uuid,p_content_id uuid,p_current integer,p_duration integer,p_ended boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare source jsonb; duration_value integer; position_value integer; ended_value boolean; saved public.journey_video_progress; stage_complete boolean;
begin
 source:=private.authorized_stage_video(p_user_id,p_content_id);
 if source is null or source->>'enrollmentId' is null or public.has_role(p_user_id,'admin') or public.has_role(p_user_id,'mentor') then raise exception 'Acesso restrito ao mentorado deste vídeo.'; end if;
 if p_current is null or p_current<0 or p_current>86400 or(p_duration is not null and(p_duration<=0 or p_duration>86400)) then raise exception 'Progresso inválido.'; end if;
 duration_value:=coalesce((source->>'durationSeconds')::integer,p_duration);
 position_value:=case when duration_value is null then p_current else least(p_current,duration_value) end;
 if position_value=0 then return jsonb_build_object('completed',false); end if;
 ended_value:=coalesce(p_ended,false) and duration_value>0 and position_value>=duration_value*.9;
 perform 1 from public.enrollments where id=(source->>'enrollmentId')::uuid for update;
 insert into public.journey_video_progress(enrollment_id,content_id,source_revision,user_id,current_seconds,max_seconds,duration_seconds,completed,completed_at)
 values((source->>'enrollmentId')::uuid,p_content_id,(source->>'revision')::integer,p_user_id,position_value,position_value,duration_value,coalesce(ended_value,false),case when ended_value then now() end)
 on conflict(enrollment_id,content_id,source_revision) do update set current_seconds=excluded.current_seconds,
 max_seconds=greatest(journey_video_progress.max_seconds,excluded.max_seconds),duration_seconds=coalesce(excluded.duration_seconds,journey_video_progress.duration_seconds),
 completed=journey_video_progress.completed or excluded.completed,
 completed_at=coalesce(journey_video_progress.completed_at,excluded.completed_at),updated_at=now()
 returning * into saved;
 select not exists(
  select 1 from public.journey_stage_contents v
  join public.enrollments e on e.id=saved.enrollment_id
  left join public.journey_video_progress p on p.enrollment_id=e.id and p.content_id=v.id and p.source_revision=v.source_revision
  where v.step_key=(source->>'stepKey')::uuid and v.pillar_id=(select pillar_id from public.journey_stage_contents where id=p_content_id) and v.active=true and v.content_type='video'
  and (v.access_scope='general' or(v.access_scope='cohort' and v.cohort_id=e.cohort_id) or(v.access_scope='mentee' and v.mentee_id=p_user_id))
  and not coalesce(p.completed,false)
 ) into stage_complete;
 insert into public.journey_content_progress(enrollment_id,step_key,user_id,current_seconds,duration_seconds,completed,completed_at,updated_at)
 values(saved.enrollment_id,(source->>'stepKey')::uuid,p_user_id,saved.current_seconds,saved.duration_seconds,stage_complete,case when stage_complete then now() end,now())
 on conflict(enrollment_id,step_key) do update set current_seconds=excluded.current_seconds,
 duration_seconds=coalesce(excluded.duration_seconds,journey_content_progress.duration_seconds),
 completed=excluded.completed,
 completed_at=case when excluded.completed then coalesce(journey_content_progress.completed_at,excluded.completed_at) else null end,updated_at=now();
 return jsonb_build_object('completed',saved.completed,'stepCompleted',stage_complete);
end $$;
revoke all on function public.record_stage_video_progress(uuid,uuid,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.record_stage_video_progress(uuid,uuid,integer,integer,boolean) to service_role;
