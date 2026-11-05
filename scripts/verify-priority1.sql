-- Executar após as migrations, em transação; não deixa testes no banco.
BEGIN;
DO $$
DECLARE actor uuid; person uuid; ok boolean; d date; expected int; actual int; n int; step_record record;
BEGIN
  SELECT p.id INTO actor FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
    WHERE lower(p.email)='comunicacao@pamarisdigital.com' AND r.role='admin';
  IF actor IS NULL THEN RAISE EXCEPTION 'Gabriela não foi localizada na equipe'; END IF;
  SELECT e.mentee_id INTO person FROM public.enrollments e WHERE e.status='ativa' LIMIT 1;
  IF person IS NULL THEN RAISE EXCEPTION 'Matrícula de teste não encontrada'; END IF;
  FOR d,expected IN SELECT * FROM (VALUES (DATE '2026-10-15',1),(DATE '2026-10-16',1),
    (DATE '2026-11-15',1),(DATE '2026-11-16',2),(DATE '2027-03-16',6),(DATE '2027-05-16',6)) q(d,e)
  LOOP
    actual := LEAST(6,GREATEST(1,(EXTRACT(YEAR FROM age(d,DATE '2026-10-16'))*12+EXTRACT(MONTH FROM age(d,DATE '2026-10-16')))::int+1));
    IF actual<>expected THEN RAISE EXCEPTION 'Mês incorreto para %: % em vez de %',d,actual,expected; END IF;
  END LOOP;
  IF has_table_privilege('authenticated','public.whatsapp_contact_permissions','UPDATE') OR
    has_table_privilege('anon','public.whatsapp_contact_permissions','SELECT') OR
    has_function_privilege('authenticated','public.record_whatsapp_permission(uuid,text,boolean,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Permissão de consentimento excessiva';
  END IF;
  PERFORM public.record_whatsapp_permission(person,'5511999999999',true,actor);
  SELECT authorized INTO ok FROM public.whatsapp_contact_permissions WHERE user_id=person;
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Autorização não registrada'; END IF;
  PERFORM public.record_whatsapp_permission(person,'5511999999999',false,actor);
  SELECT authorized INTO ok FROM public.whatsapp_contact_permissions WHERE user_id=person;
  IF ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'Revogação não registrada'; END IF;
  IF (SELECT count(*) FROM public.whatsapp_contact_permission_history WHERE user_id=person AND recorded_by=actor)<2 THEN
    RAISE EXCEPTION 'Histórico de consentimento incompleto';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SELECT count(*) INTO n FROM public.public_staff_directory() WHERE id=actor;
  IF n<>1 THEN RAISE EXCEPTION 'Gabriela não aparece na lista'; END IF;
  IF EXISTS (SELECT 1 FROM public.cohorts WHERE name='Turma 1, 2026' AND starts_on<>DATE '2026-10-16') THEN
    RAISE EXCEPTION 'Início da turma incorreto';
  END IF;
  n := 0;
  FOR step_record IN
    SELECT DISTINCT ON (s.completion_rule) e.id AS enrollment_id,e.mentee_id,s.stable_key,s.completion_rule
    FROM public.enrollments e
    JOIN public.journey_pillars jp ON jp.program_id=e.program_id
    LEFT JOIN public.enrollment_journey_versions ejv ON ejv.enrollment_id=e.id AND ejv.pillar_id=jp.id
    JOIN public.journey_steps s ON s.version_id=COALESCE(ejv.version_id,jp.current_published_version_id)
    WHERE e.status='ativa' AND s.archived_at IS NULL
      AND s.completion_rule IN ('player_ended','final_submission','mentor_confirmation')
    ORDER BY s.completion_rule,e.id
  LOOP
    INSERT INTO public.journey_content_progress(enrollment_id,step_key,user_id,current_seconds,completed,completed_at)
    VALUES(step_record.enrollment_id,step_record.stable_key,step_record.mentee_id,0,true,now())
    ON CONFLICT(enrollment_id,step_key) DO UPDATE SET completed=true,completed_at=now();
    INSERT INTO public.journey_step_progress(enrollment_id,step_key,status)
    VALUES(step_record.enrollment_id,step_record.stable_key,'in_progress')
    ON CONFLICT(enrollment_id,step_key) DO UPDATE SET status='in_progress';
    ok := public.complete_automatic_journey_step(step_record.enrollment_id,step_record.stable_key,step_record.completion_rule);
    IF ok IS DISTINCT FROM (step_record.completion_rule<>'mentor_confirmation') THEN
      RAISE EXCEPTION 'Conclusão incorreta para %',step_record.completion_rule;
    END IF;
    IF ok AND public.complete_automatic_journey_step(step_record.enrollment_id,step_record.stable_key,step_record.completion_rule) THEN
      RAISE EXCEPTION 'Conclusão repetida não é idempotente';
    END IF;
    n := n+1;
  END LOOP;
  IF n<>3 THEN RAISE EXCEPTION 'Não foi possível testar as três regras de conclusão'; END IF;
END;
$$;
SELECT 'OK: meses, aceite, revogação, histórico, Gabriela e conclusão automática sem ignorar aprovação da mentora' AS verificacao;
ROLLBACK;
