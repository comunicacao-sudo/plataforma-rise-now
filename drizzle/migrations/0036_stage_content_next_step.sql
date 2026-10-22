-- Make the mentee Home / next-step resolver aware of the new stage content hub.
create or replace function public.get_next_journey_step()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with enrollment as (
    select e.*
    from public.enrollments e
    where e.mentee_id = auth.uid()
      and coalesce(e.status,'ativa') <> 'desativada'
    order by e.created_at desc
    limit 1
  ),
  candidates as (
    select
      e.id enrollment_id,
      jp.id pillar_id,
      jp.name pillar_name,
      jp.position pillar_position,
      s.*,
      coalesce(pr.status,'not_started') progress_status,
      m.id meeting_id,
      m.scheduled_at meeting_scheduled_at,
      m.join_url meeting_join_url,
      coalesce(sc.has_video,false) stage_has_video,
      coalesce(sc.has_material,false) stage_has_material,
      coalesce(sc.has_questionnaire,false) stage_has_questionnaire,
      sc.video_duration stage_video_duration
    from enrollment e
    join public.journey_pillars jp on jp.program_id = e.program_id
    left join public.enrollment_journey_versions ejv
      on ejv.enrollment_id = e.id and ejv.pillar_id = jp.id
    join public.journey_versions v
      on v.id = coalesce(ejv.version_id,jp.current_published_version_id)
      and v.status in ('published','archived')
    join public.journey_steps s
      on s.version_id = v.id and s.archived_at is null
    left join public.journey_step_progress pr
      on pr.enrollment_id = e.id and pr.step_key = s.stable_key
    left join lateral (
      select
        bool_or(c.content_type = 'video') as has_video,
        bool_or(c.content_type = 'material') as has_material,
        bool_or(c.content_type = 'questionnaire') as has_questionnaire,
        max(c.duration_minutes) filter (where c.content_type = 'video') as video_duration
      from public.journey_stage_contents c
      where c.pillar_id = jp.id
        and c.step_key = s.stable_key
        and c.active = true
        and (
          c.access_scope = 'general'
          or (c.access_scope = 'cohort' and c.cohort_id = e.cohort_id)
          or (c.access_scope = 'mentee' and c.mentee_id = e.mentee_id)
        )
    ) sc on true
    left join lateral (
      select mt.id, mt.scheduled_at, mt.join_url
      from public.meetings mt
      where mt.enrollment_id = e.id
        and s.format = 'individual_1_1'
        and (mt.id::text = s.resource_id or mt.lesson_id::text = s.resource_id)
      order by mt.scheduled_at desc
      limit 1
    ) m on true
    where s.required
      and coalesce(pr.status,'not_started') <> 'completed'
      and s.month_number <= e.current_month
      and (
        s.access_scope = 'general'
        or (s.access_scope = 'cohort' and s.cohort_id = e.cohort_id)
        or (s.access_scope = 'mentee' and s.mentee_id = e.mentee_id)
      )
    order by jp.position, s.position
    limit 1
  )
  select case
    when not exists (select 1 from enrollment) then
      jsonb_build_object('state','no_enrollment')
    when not exists (select 1 from candidates) then
      jsonb_build_object('state','complete')
    else (
      select jsonb_build_object(
        'state', case
          when release_at is not null and release_at > now() then 'blocked'
          when format = 'individual_1_1' then 'ready'
          when format = 'live_group' and scheduled_at is not null then 'ready'
          when stage_has_video or stage_has_material or stage_has_questionnaire then 'ready'
          when coalesce(resource_url,resource_id,media_path,meeting_id::text) is null then 'waiting_resource'
          else 'ready'
        end,
        'enrollmentId', enrollment_id,
        'pillarId', pillar_id,
        'pillarName', pillar_name,
        'stepKey', stable_key,
        'title', title,
        'format', format,
        'impactLead', impact_lead,
        'impactHighlight', impact_highlight,
        'impactTail', impact_tail,
        'description', description,
        'responsibleName', responsible_name,
        'durationMinutes', coalesce(stage_video_duration,duration_minutes),
        'resourceType', resource_type,
        'resourceId', resource_id,
        'resourceUrl', coalesce(meeting_join_url,resource_url),
        'scheduledAt', coalesce(meeting_scheduled_at,scheduled_at),
        'releaseAt', release_at,
        'progressStatus', progress_status,
        'hasStageContent', stage_has_video or stage_has_material or stage_has_questionnaire,
        'contentTypes', (
          select jsonb_agg(t)
          from (
            select 'video'::text t where stage_has_video
            union all select 'material' where stage_has_material
            union all select 'questionnaire' where stage_has_questionnaire
          ) x
        ),
        'actionLabel', case
          when release_at is not null and release_at > now() then null
          when format = 'live_group' and coalesce(resource_url,meeting_join_url) is not null then 'Entrar no encontro'
          when format = 'live_group' and scheduled_at is not null then 'Ver detalhes do encontro'
          when format = 'individual_1_1' and meeting_id is null
               and coalesce(resource_url,media_path) is null then 'Agendar meu encontro'
          when format = 'individual_1_1' and meeting_join_url is null then 'Ver meu encontro'
          when format = 'individual_1_1' then 'Entrar no encontro'
          when stage_has_video then
            case when progress_status='in_progress' then 'Continuar aula' else 'Assistir à aula' end
          when stage_has_questionnaire then
            case when progress_status='in_progress' then 'Continuar questionário' else 'Responder questionário' end
          when stage_has_material then 'Abrir conteúdo'
          when format = 'questionnaire' then
            case when progress_status='in_progress' then 'Continuar questionário' else 'Responder questionário' end
          when format = 'form' then
            case when progress_status='in_progress' then 'Continuar formulário' else 'Preencher formulário' end
          when format in ('recorded_class','collective_recording','cohort_onboarding') then
            case when progress_status='in_progress' then 'Continuar aula' else 'Assistir à aula' end
          else null
        end
      )
      from candidates
    )
  end
$function$;
