-- Plano e observações privadas pertencem à mesma transação.
create or replace function public.create_assessment_development_plan(p_actor uuid, p_input jsonb)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare plan_id uuid;
begin
  if not (public.has_role(p_actor, 'admin') or public.has_role(p_actor, 'mentor')) then
    raise exception 'Acesso restrito à equipe RISE.';
  end if;
  if not exists (select 1 from public.assessment_attempts a where a.id = (p_input->>'attemptId')::uuid and a.enrollment_id = (p_input->>'enrollmentId')::uuid) then
    raise exception 'Aplicação não encontrada para esta matrícula.';
  end if;
  if nullif(btrim(p_input->>'priorityFocus'),'') is null or nullif(btrim(p_input->>'objective'),'') is null or nullif(btrim(p_input->>'action'),'') is null then
    raise exception 'Preencha o foco, o objetivo e a ação do plano.';
  end if;
  insert into public.assessment_development_plans
    (attempt_id, enrollment_id, created_by, priority_focus, objective, action,
     progress_evidence, due_date, review_date, observations, status, responsible, shared_with_mentee)
  values (
    (p_input->>'attemptId')::uuid, (p_input->>'enrollmentId')::uuid, p_actor,
    p_input->>'priorityFocus', p_input->>'objective', p_input->>'action',
    nullif(p_input->>'progressEvidence',''), nullif(p_input->>'dueDate','')::date,
    nullif(p_input->>'reviewDate','')::date, nullif(p_input->>'observations',''),
    coalesce(p_input->>'status','draft'), nullif(p_input->>'responsible',''),
    coalesce((p_input->>'sharedWithMentee')::boolean,false)
  ) returning id into plan_id;
  if nullif(btrim(p_input->>'internalNotes'),'') is not null then
    insert into public.assessment_development_private_notes(plan_id,author_id,content)
    values(plan_id,p_actor,p_input->>'internalNotes');
  end if;
  return plan_id;
end;
$$;
revoke all on function public.create_assessment_development_plan(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_assessment_development_plan(uuid,jsonb) to service_role;
