begin;
do $$
declare actor uuid:=gen_random_uuid(); member uuid:=gen_random_uuid(); session_id uuid:=gen_random_uuid();
 other_session uuid:=gen_random_uuid(); program uuid:=gen_random_uuid(); pillar uuid:=gen_random_uuid(); v_version uuid:=gen_random_uuid();
 step_key uuid:=gen_random_uuid(); content_id uuid:=gen_random_uuid(); cohort uuid:=gen_random_uuid();
 enrollment uuid:=gen_random_uuid(); goal uuid:=gen_random_uuid(); milestone uuid:=gen_random_uuid();
 access_id uuid; trash_id uuid; restored_id uuid; rejected boolean; result jsonb; revision integer;
 hash text:=repeat('a',64); hash2 text:=repeat('b',64); item_id uuid; loop_index integer;
begin
 insert into public.allowed_emails(email,full_name,role) values('qa-'||actor||'@example.invalid','Teste temporário de administração','admin');
 insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data)
 values(actor,'qa-'||actor||'@example.invalid','authenticated','authenticated','{}','{}');
 insert into public.allowed_emails(email,full_name,role) values('qa-'||member||'@example.invalid','Teste temporário de participante','mentee') returning id into access_id;
 insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data)
 values(member,'qa-'||member||'@example.invalid','authenticated','authenticated','{}','{}');
 insert into auth.sessions(id,user_id) values(session_id,actor),(other_session,actor);
 insert into public.programs(id,name) values(program,'QA temporária - rollback');
 insert into public.cohorts(id,name) values(cohort,'QA temporária - rollback');
 insert into public.enrollments(id,mentee_id,program_id,cohort_id,status) values(enrollment,member,program,cohort,'pausada');
 insert into public.journey_pillars(id,program_id,name,mentor_id) values(pillar,program,'QA temporária',actor);
 insert into public.journey_versions(id,pillar_id,status) values(v_version,pillar,'draft');
 insert into public.journey_steps(version_id,stable_key,title,format,impact_lead,impact_highlight,impact_tail)
 values(v_version,step_key,'Etapa temporária','recorded_class','Frase inicial','Frase de destaque','Frase final');
 insert into public.journey_stage_contents(id,pillar_id,step_key,content_type,title,media_path)
 values(content_id,pillar,step_key,'video','Vídeo temporário','r2:lessons/qa-'||content_id||'.mp4');
 if not public.check_protected_operation(actor,session_id,'content',content_id,'delete') then raise exception 'QA: autorização administrativa'; end if;
 if public.check_protected_operation(member,session_id,'content',content_id,'delete') then raise exception 'QA: usuário cruzado'; end if;
 rejected:=false;
 begin perform public.move_resource_to_trash(actor,session_id,'content',content_id,hash); exception when others then rejected:=true; end;
 if not rejected then raise exception 'QA: exclusão sem prova'; end if;
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash,actor,session_id,'content',content_id,'delete');
 rejected:=false;
 begin perform public.move_resource_to_trash(actor,session_id,'cohort',cohort,hash); exception when others then rejected:=true; end;
 if not rejected or not exists(select 1 from public.protected_operation_proofs where token_hash=hash) then raise exception 'QA: escopo e rollback'; end if;
 rejected:=false;
 begin perform public.move_resource_to_trash(actor,other_session,'content',content_id,hash); exception when others then rejected:=true; end;
 if not rejected then raise exception 'QA: prova vinculada à sessão'; end if;
 update public.protected_operation_proofs set expires_at=now()-interval '1 second' where token_hash=hash;
 rejected:=false;
 begin perform public.move_resource_to_trash(actor,session_id,'content',content_id,hash); exception when others then rejected:=true; end;
 if not rejected then raise exception 'QA: prova vencida'; end if;
 update public.protected_operation_proofs set expires_at=now()+interval '2 minutes' where token_hash=hash;
 trash_id:=public.move_resource_to_trash(actor,session_id,'content',content_id,hash);
 if not exists(select 1 from public.journey_stage_contents where id=content_id and deleted_at is not null and not active)
 or exists(select 1 from public.protected_operation_proofs where token_hash=hash) then raise exception 'QA: exclusão lógica/consumo'; end if;
 if not exists(select 1 from public.admin_trash where id=trash_id and expires_at=deleted_at+interval '30 days') then raise exception 'QA: retenção'; end if;
 rejected:=false;
 begin perform public.move_resource_to_trash(actor,session_id,'content',content_id,hash); exception when others then rejected:=true; end;
 if not rejected then raise exception 'QA: reuso de prova'; end if;
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash,actor,session_id,'trash',trash_id,'restore');
 perform public.restore_trash_resource(actor,session_id,trash_id,hash);
 if not exists(select 1 from public.journey_stage_contents where id=content_id and deleted_at is null and active and source_revision=1)
 or not exists(select 1 from public.admin_trash where id=trash_id and restored_at is not null and snapshot='{}') then raise exception 'QA: restauração'; end if;
 -- O próprio acesso nunca pode ser enviado à lixeira.
 select id into item_id from public.allowed_emails where email='qa-'||actor||'@example.invalid';
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash2,actor,session_id,'access',item_id,'delete');
 rejected:=false;
 begin perform public.move_resource_to_trash(actor,session_id,'access',item_id,hash2); exception when others then rejected:=true; end;
 if not rejected then raise exception 'QA: exclusão do próprio acesso'; end if;
 delete from public.protected_operation_proofs where token_hash=hash2;
 -- Uma turma vinculada não pode perder pessoas/conteúdos acidentalmente.
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash,actor,session_id,'cohort',cohort,'delete');
 rejected:=false;
 begin perform public.move_resource_to_trash(actor,session_id,'cohort',cohort,hash); exception when others then rejected:=true; end;
 if not rejected then raise exception 'QA: turma vinculada'; end if;
 delete from public.protected_operation_proofs where token_hash=hash;
 -- A remoção de etapa exige a mesma prova dentro da RPC de salvamento.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id',session_id)::text,true);
 rejected:=false;
 begin perform public.save_journey_draft(pillar,0,'[]',null); exception when others then rejected:=true; end;
 if not rejected then raise exception 'QA: rascunho sem prova'; end if;
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash,actor,session_id,'draft',pillar,'delete');
 revision:=public.save_journey_draft(pillar,0,'[]',hash);
 select id into trash_id from public.admin_trash where resource_type='draft_step' and resource_id=step_key and restored_at is null;
 if trash_id is null then raise exception 'QA: etapa na lixeira'; end if;
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash,actor,session_id,'trash',trash_id,'restore');
 perform public.restore_trash_resource(actor,session_id,trash_id,hash);
 if not exists(select 1 from public.journey_steps where version_id=v_version and stable_key=step_key
 and impact_lead='Frase inicial' and impact_highlight='Frase de destaque' and impact_tail='Frase final') then raise exception 'QA: preservação de frases'; end if;
 -- Metas só são alteradas pelo participante dono da matrícula.
 insert into auth.sessions(id,user_id) values(gen_random_uuid(),member) returning id into item_id;
 insert into public.rise90_goals(id,enrollment_id,title) values(goal,enrollment,'Meta temporária');
 insert into public.rise90_milestones(id,goal_id,title) values(milestone,goal,'Marco temporário');
 if public.check_protected_operation(actor,session_id,'goal',goal,'delete') then raise exception 'QA: meta de outra pessoa'; end if;
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash,member,item_id,'milestone',milestone,'delete');
 trash_id:=public.move_resource_to_trash(member,item_id,'milestone',milestone,hash);
 if public.check_protected_operation(actor,session_id,'trash',trash_id,'restore') then raise exception 'QA: recuperar meta de outra pessoa'; end if;
 -- Restaurar acesso preserva o estado pausado anterior da matrícula.
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash2,actor,session_id,'access',access_id,'delete');
 restored_id:=public.move_resource_to_trash(actor,session_id,'access',access_id,hash2);
 if exists(select 1 from auth.sessions where user_id=member) or private.has_platform_access(member) then raise exception 'QA: revogação imediata'; end if;
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash2,actor,session_id,'trash',restored_id,'restore');
 perform public.restore_trash_resource(actor,session_id,restored_id,hash2);
 if not exists(select 1 from public.enrollments where id=enrollment and status='pausada') then raise exception 'QA: estado da matrícula'; end if;
 -- Vencimento impede restauração, enquanto a limpeza não toca nos itens novos.
 update public.admin_trash set expires_at=now()-interval '1 second' where id=trash_id;
 if public.check_protected_operation(member,item_id,'trash',trash_id,'restore') then raise exception 'QA: restauração vencida'; end if;
 result:=public.purge_expired_trash('https://example.invalid');
 if exists(select 1 from public.rise90_milestones where id=milestone) then raise exception 'QA: remoção definitiva'; end if;
 if not exists(select 1 from public.journey_stage_contents where id=content_id and active) then raise exception 'QA: item ativo preservado'; end if;
 -- Arquivos compartilhados são preservados; recibo só autoriza seu objeto e lease.
 perform private.enqueue_trash_asset('r2','','lessons/qa-'||content_id||'.mp4');
 result:=public.claim_trash_asset(hash);
 if result->>'shared'<>'true' then raise exception 'QA: arquivo compartilhado'; end if;
 perform private.enqueue_trash_asset('r2','','lessons/qa-expirado-'||actor||'.mp4');
 result:=public.claim_trash_asset(hash);
 if public.authorize_trash_asset_cleanup((result->>'id')::uuid,hash2) is not null then raise exception 'QA: recibo incorreto'; end if;
 if public.authorize_trash_asset_cleanup((result->>'id')::uuid,hash)->>'key'<>'lessons/qa-expirado-'||actor||'.mp4' then raise exception 'QA: alvo autorizado'; end if;
 -- A limpeza de uma conta não apaga as conexões das demais contas.
 insert into public.app_user_connections(user_id,connector_id,connection_key_ciphertext)
 values(actor,'qa-trash','somente-fixture'),(member,'qa-trash','somente-fixture');
 insert into public.protected_operation_proofs(token_hash,user_id,session_id,resource_type,resource_id,operation)
 values(hash2,actor,session_id,'access',access_id,'delete');
 trash_id:=public.move_resource_to_trash(actor,session_id,'access',access_id,hash2);
 update public.admin_trash set expires_at=now()-interval '1 second' where id=trash_id;
 result:=public.purge_expired_trash('https://example.invalid');
 if exists(select 1 from public.audit_log where target in(access_id::text,member::text)
 and payload::text like '%@example.invalid%') then raise exception 'QA: auditoria minimizada após exclusão definitiva'; end if;
 if exists(select 1 from auth.users where id=member) then raise exception 'QA: purge conta: %',result; end if;
 if not exists(select 1 from public.app_user_connections where user_id=actor and connector_id='qa-trash') then raise exception 'QA: conexão de outra conta preservada'; end if;
 if has_table_privilege('authenticated','public.journey_stage_contents','DELETE')
 or has_function_privilege('authenticated','public.move_resource_to_trash(uuid,uuid,text,uuid,text)','EXECUTE')
 or has_table_privilege('authenticated','public.protected_operation_proofs','SELECT') then raise exception 'QA: privilégios diretos'; end if;
 for loop_index in 1..5 loop
 if not public.reserve_protected_attempt(actor,session_id) then raise exception 'QA: reserva de tentativa'; end if;
 end loop;
 if public.reserve_protected_attempt(actor,session_id) then raise exception 'QA: limite de tentativas'; end if;
 delete from auth.sessions where id=session_id;
 if public.check_protected_operation(actor,session_id,'content',content_id,'delete') then raise exception 'QA: sessão revogada'; end if;
end $$;
rollback;
select 'Proteções, recuperação, retenção, arquivos e isolamento validados; fixtures revertidas.' as resultado;
