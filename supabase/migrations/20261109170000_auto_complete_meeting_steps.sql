-- Etapas que são encontros (regra mentor_confirmation) passam a ser concluídas
-- automaticamente quando o encontro vinculado à etapa termina, para quem foi convidada.
-- A mentora pode desfazer para quem faltou (confirmation_source = 'mentor_reopened'),
-- e a automação não conclui de novo essa pessoa naquela etapa.
-- O rise-cron chama public.complete_finished_meeting_steps() a cada execução.

CREATE OR REPLACE FUNCTION public.complete_finished_meeting_steps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
BEGIN
  WITH finished AS (
    SELECT m.id, m.journey_step_key, m.audience, m.cohort_id, m.enrollment_id
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
  WHERE public.journey_step_progress.status <> 'completed'
    AND COALESCE(public.journey_step_progress.confirmation_source, '') <> 'mentor_reopened';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_finished_meeting_steps() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_finished_meeting_steps() TO service_role;

-- Onboarding RISE de 16/10/2026 (não foi cadastrado como encontro): concluído para
-- todas as mentoradas ativas, conforme confirmado pela equipe em 09/11/2026.
INSERT INTO public.journey_step_progress (
  enrollment_id, step_key, status, completed_at, confirmation_source, updated_at
)
SELECT DISTINCT e.id, s.stable_key, 'completed', TIMESTAMPTZ '2026-10-16 10:00:00-03', 'onboarding_backfill', now()
FROM public.enrollments e
JOIN public.journey_pillars jp ON jp.program_id = e.program_id
JOIN public.journey_steps s
  ON s.version_id = jp.current_published_version_id
 AND s.archived_at IS NULL
 AND s.title = 'Onboarding RISE'
 AND s.month_number = 1
WHERE e.status = 'ativa'
ON CONFLICT (enrollment_id, step_key) DO UPDATE
SET status = 'completed',
    completed_at = COALESCE(public.journey_step_progress.completed_at, excluded.completed_at),
    confirmation_source = COALESCE(public.journey_step_progress.confirmation_source, excluded.confirmation_source),
    updated_at = now()
WHERE public.journey_step_progress.status <> 'completed';
