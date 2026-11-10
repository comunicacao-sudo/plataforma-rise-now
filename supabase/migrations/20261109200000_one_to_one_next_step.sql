-- 1:1 ligado à jornada: um 1:1 agendado sem etapa definida vale para a próxima
-- etapa de 1:1 (format individual_1_1) ainda não concluída de quem agendou.
-- Depois do encontro, complete_finished_meeting_steps conclui a etapa sozinha.

-- Próxima etapa de 1:1 pendente da matrícula, na ordem da jornada. Ignora etapas
-- que já têm um encontro marcado e ainda não terminado (dois 1:1 agendados
-- seguidos ficam com etapas diferentes).
create or replace function private.next_individual_step(p_enrollment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.stable_key
    from public.enrollments e
    join public.journey_pillars jp on jp.program_id = e.program_id
    left join public.enrollment_journey_versions ejv
      on ejv.enrollment_id = e.id and ejv.pillar_id = jp.id
    join public.journey_versions v
      on v.id = coalesce(ejv.version_id, jp.current_published_version_id)
     and v.status in ('published', 'archived')
    join public.journey_steps s
      on s.version_id = v.id
     and s.archived_at is null
     and s.format = 'individual_1_1'
    left join public.journey_step_progress pr
      on pr.enrollment_id = e.id and pr.step_key = s.stable_key
   where e.id = p_enrollment_id
     and coalesce(pr.status, 'not_started') <> 'completed'
     and (
       s.access_scope = 'general'
       or (s.access_scope = 'cohort' and s.cohort_id = e.cohort_id)
       or (s.access_scope = 'mentee' and s.mentee_id = e.mentee_id)
     )
     and not exists (
       select 1
         from public.meetings mt
        where mt.deleted_at is null
          and mt.enrollment_id = e.id
          and mt.journey_step_key = s.stable_key
          and coalesce(mt.ends_at, mt.scheduled_at + make_interval(mins => coalesce(mt.duration_minutes, 60))) > now()
     )
   order by jp.position, s.position
   limit 1
$$;
revoke all on function private.next_individual_step(uuid) from public, anon, authenticated;
-- confirm_booking roda com a chave de serviço (rise-backend).
grant usage on schema private to service_role;
grant execute on function private.next_individual_step(uuid) to service_role;

-- Confirmação da reserva: a etapa fixa do agendamento (se houver) tem prioridade;
-- senão, entra a próxima etapa de 1:1 de quem agendou.
create or replace function public.confirm_booking(p_reservation_id uuid, p_google_event_id text, p_join_url text)
 returns uuid
 language plpgsql
 set search_path to ''
as $function$
declare r public.booking_reservations; o public.booking_offerings; m uuid; mentor_name text;
begin
 select * into strict r from public.booking_reservations where id=p_reservation_id for update;
 if r.status='confirmed' then return r.meeting_id; end if;
 if r.status<>'pending' then raise exception 'Reserva indisponível.'; end if;
 select * into strict o from public.booking_offerings where id=r.offering_id;
 select coalesce(nullif(display_name,''),full_name) into mentor_name from public.profiles where id=r.mentor_id;
 insert into public.meetings(enrollment_id,title,description,kind,scheduled_at,ends_at,duration_minutes,join_url,audience,mentor_id,mentor_name,google_event_id,created_by,journey_step_key)
 values(r.enrollment_id,o.title,o.description,'individual',r.starts_at,r.ends_at,o.duration_minutes,p_join_url,'selected',r.mentor_id,mentor_name,p_google_event_id,r.mentor_id,
        coalesce(o.journey_step_key, private.next_individual_step(r.enrollment_id))) returning id into m;
 update public.booking_reservations set status='confirmed',meeting_id=m where id=r.id;
 return m;
end $function$;

-- Conclusão automática: "Desfazer (faltou)" só bloqueia o encontro que a mentora
-- desfez. Se a pessoa remarcar e o novo encontro acontecer depois, a etapa conclui.
create or replace function public.complete_finished_meeting_steps()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE
  changed integer;
BEGIN
  WITH finished AS (
    SELECT m.id, m.journey_step_key, m.audience, m.cohort_id, m.enrollment_id,
           COALESCE(m.ends_at, m.scheduled_at + make_interval(mins => COALESCE(m.duration_minutes, 60))) AS ended_at
    FROM public.meetings m
    WHERE m.deleted_at IS NULL
      AND m.journey_step_key IS NOT NULL
      AND COALESCE(m.ends_at, m.scheduled_at + make_interval(mins => COALESCE(m.duration_minutes, 60))) <= now()
      AND m.scheduled_at > now() - interval '30 days'
      AND EXISTS (
        SELECT 1 FROM public.journey_steps s
        WHERE s.stable_key = m.journey_step_key
          AND s.archived_at IS NULL
          AND s.completion_rule = 'mentor_confirmation'
      )
  ),
  targets AS (
    SELECT DISTINCT f.journey_step_key AS step_key, e.id AS enrollment_id
    FROM finished f
    JOIN public.enrollments e ON e.status = 'ativa' AND (
      (f.enrollment_id IS NOT NULL AND e.id = f.enrollment_id)
      OR (f.enrollment_id IS NULL AND f.audience = 'all')
      OR (f.enrollment_id IS NULL AND f.audience = 'cohort' AND e.cohort_id = f.cohort_id)
      OR (f.enrollment_id IS NULL AND f.audience = 'selected' AND EXISTS (
        SELECT 1 FROM public.meeting_attendees a WHERE a.meeting_id = f.id AND a.enrollment_id = e.id
      ))
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.journey_step_progress p
      WHERE p.enrollment_id = e.id
        AND p.step_key = f.journey_step_key
        AND p.confirmation_source = 'mentor_reopened'
        AND p.updated_at >= f.ended_at
    )
  )
  INSERT INTO public.journey_step_progress (
    enrollment_id, step_key, status, completed_at, confirmation_source, updated_at
  )
  SELECT t.enrollment_id, t.step_key, 'completed', now(), 'meeting_auto', now()
  FROM targets t
  ON CONFLICT (enrollment_id, step_key) DO UPDATE
  SET status = 'completed',
      completed_at = COALESCE(public.journey_step_progress.completed_at, excluded.completed_at),
      confirmation_source = 'meeting_auto',
      updated_at = now()
  WHERE public.journey_step_progress.status <> 'completed';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$function$;

-- 1:1 já marcados (ainda por acontecer) sem etapa: liga cada um, em ordem de data.
do $$
declare mt record;
begin
  for mt in
    select m.id, m.enrollment_id
      from public.meetings m
      join public.booking_reservations b on b.meeting_id = m.id and b.status = 'confirmed'
     where m.deleted_at is null
       and m.journey_step_key is null
       and m.enrollment_id is not null
       and m.scheduled_at > now()
     order by m.scheduled_at
  loop
    update public.meetings
       set journey_step_key = private.next_individual_step(mt.enrollment_id)
     where id = mt.id;
  end loop;
end $$;
