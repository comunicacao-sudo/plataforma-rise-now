begin;
do $$
declare v_program uuid:=gen_random_uuid(); v_pillar uuid:=gen_random_uuid(); v_step uuid:=gen_random_uuid();
 v_user uuid:=gen_random_uuid(); v_enrollment uuid:=gen_random_uuid(); v_cohort uuid:=gen_random_uuid();
 first_id uuid; second_id uuid; item record;
begin
 insert into public.allowed_emails(email,full_name,role) values('qa-multiple-'||v_user||'@example.invalid','Teste transacional','mentee');
 insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data)
 values(v_user,'qa-multiple-'||v_user||'@example.invalid','authenticated','authenticated','{}','{}');
 insert into public.programs(id,name) values(v_program,'Teste de questionários - rollback');
 insert into public.cohorts(id,name) values(v_cohort,'Teste de público - rollback');
 insert into public.enrollments(id,mentee_id,program_id,cohort_id) values(v_enrollment,v_user,v_program,v_cohort);
 insert into public.journey_pillars(id,program_id,name) values(v_pillar,v_program,'Teste - rollback');
 for item in select * from(values('general'::text,null::uuid,null::uuid),('cohort',v_cohort,null::uuid),('mentee',null::uuid,v_user)) t(scope,cohort,mentee) loop
  insert into public.journey_stage_contents(pillar_id,step_key,content_type,title,access_scope,cohort_id,mentee_id,questionnaire)
  values(v_pillar,v_step,'questionnaire','Primeiro',item.scope,item.cohort,item.mentee,'{"questions":[{"id":"pergunta","prompt":"Teste","type":"short_text","required":true,"options":[]}]}') returning id into first_id;
  insert into public.journey_stage_contents(pillar_id,step_key,content_type,title,access_scope,cohort_id,mentee_id,questionnaire)
  values(v_pillar,v_step,'questionnaire','Segundo',item.scope,item.cohort,item.mentee,'{"questions":[{"id":"pergunta","prompt":"Teste","type":"short_text","required":true,"options":[]}]}') returning id into second_id;
  if first_id=second_id then raise exception 'Os questionários precisam de identidades distintas.'; end if;
  insert into public.journey_stage_questionnaire_responses(content_id,enrollment_id,user_id,answers,submitted_at)
  values(first_id,v_enrollment,v_user,'{"pergunta":"Primeira resposta"}',now()),(second_id,v_enrollment,v_user,'{"pergunta":"Segunda resposta"}',now());
  if(select count(*) from public.journey_stage_questionnaire_responses where content_id in(first_id,second_id) and enrollment_id=v_enrollment)<>2
  or not exists(select 1 from public.journey_stage_questionnaire_responses where content_id=first_id and answers->>'pergunta'='Primeira resposta')
  or not exists(select 1 from public.journey_stage_questionnaire_responses where content_id=second_id and answers->>'pergunta'='Segunda resposta')
  then raise exception 'As respostas precisam permanecer separadas.'; end if;
 end loop;
end $$;
rollback;
select 'Vários questionários por etapa e público, com respostas independentes; fixtures revertidas.' as resultado;
