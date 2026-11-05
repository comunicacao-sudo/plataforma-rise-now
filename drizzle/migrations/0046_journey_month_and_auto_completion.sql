-- 1) O mês da jornada (enrollments.current_month) passa a avançar sozinho
--    pela data de início: da matrícula (journey_starts_on), senão da turma
--    (cohorts.starts_on), senão do cadastro. Mês 1 nos primeiros 30 dias de
--    calendário a partir do aniversário mensal do início, até o mês 6. O rise-cron chama
--    public.refresh_journey_months() a cada execução.
-- 2) Etapas com conclusão automática (vídeo assistido / questionário enviado)
--    que ficaram sem registro em journey_step_progress são concluídas agora.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS journey_starts_on date;

COMMENT ON COLUMN public.enrollments.journey_starts_on IS
  'Início da jornada desta mentorada, quando diferente do início da turma.';

-- A Turma 1, 2026 começou no onboarding de 16/10/2026.
UPDATE public.cohorts
SET starts_on = DATE '2026-10-16'
WHERE name = 'Turma 1, 2026' AND starts_on = DATE '2026-10-01';

CREATE OR REPLACE FUNCTION public.refresh_journey_months()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  WITH computed AS (
    SELECT
      e.id,
      LEAST(6, GREATEST(1, (
        EXTRACT(YEAR FROM age(today, s.start)) * 12 + EXTRACT(MONTH FROM age(today, s.start))
      )::int + 1)) AS month
    FROM public.enrollments e
    LEFT JOIN public.cohorts c ON c.id = e.cohort_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        e.journey_starts_on,
        c.starts_on,
        (e.started_at AT TIME ZONE 'America/Sao_Paulo')::date
      ) AS start
    ) s
    WHERE e.status IN ('ativa', 'pausada')
  )
  UPDATE public.enrollments e
  SET current_month = computed.month
  FROM computed
  WHERE computed.id = e.id
    AND e.current_month IS DISTINCT FROM computed.month;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_journey_months() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_journey_months() TO service_role;

SELECT public.refresh_journey_months();

INSERT INTO public.journey_step_progress (
  enrollment_id, step_key, status, completed_at, confirmation_source, updated_at
)
SELECT DISTINCT ON (p.enrollment_id, p.step_key)
  p.enrollment_id, p.step_key, 'completed', COALESCE(p.completed_at, now()), 'backfill_0046', now()
FROM public.journey_content_progress p
JOIN public.enrollments e ON e.id=p.enrollment_id
JOIN public.journey_pillars jp ON jp.program_id=e.program_id
LEFT JOIN public.enrollment_journey_versions ejv ON ejv.enrollment_id=e.id AND ejv.pillar_id=jp.id
JOIN public.journey_steps s
  ON s.stable_key::text = p.step_key::text
 AND s.version_id=COALESCE(ejv.version_id,jp.current_published_version_id)
 AND s.archived_at IS NULL
 AND s.completion_rule IN ('player_ended', 'final_submission')
WHERE p.completed
ON CONFLICT (enrollment_id, step_key) DO UPDATE
SET status = 'completed',
    completed_at = COALESCE(public.journey_step_progress.completed_at, excluded.completed_at),
    confirmation_source = COALESCE(public.journey_step_progress.confirmation_source, excluded.confirmation_source),
    updated_at = now()
WHERE public.journey_step_progress.status <> 'completed';

CREATE OR REPLACE FUNCTION public.complete_automatic_journey_step(
  p_enrollment_id uuid, p_step_key uuid, p_rule text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
  IF p_rule NOT IN ('player_ended','final_submission') THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.journey_pillars jp ON jp.program_id=e.program_id
    LEFT JOIN public.enrollment_journey_versions ejv ON ejv.enrollment_id=e.id AND ejv.pillar_id=jp.id
    JOIN public.journey_steps s ON s.version_id=COALESCE(ejv.version_id,jp.current_published_version_id)
    JOIN public.journey_content_progress progress ON progress.enrollment_id=e.id AND progress.step_key=s.stable_key
    WHERE e.id=p_enrollment_id AND e.status='ativa' AND s.stable_key=p_step_key
      AND s.archived_at IS NULL AND s.completion_rule=p_rule AND progress.completed
  ) THEN RETURN false; END IF;
  INSERT INTO public.journey_step_progress(enrollment_id,step_key,status,completed_at,confirmation_source)
  VALUES(p_enrollment_id,p_step_key,'completed',now(),p_rule)
  ON CONFLICT(enrollment_id,step_key) DO UPDATE SET status='completed',
    completed_at=COALESCE(public.journey_step_progress.completed_at,excluded.completed_at),
    confirmation_source=excluded.confirmation_source,updated_at=now()
  WHERE public.journey_step_progress.status <> 'completed';
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_automatic_journey_step(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_automatic_journey_step(uuid,uuid,text) TO service_role;
