create table public.protected_operation_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 1,
  window_started timestamptz not null default now()
);
create table public.protected_operation_proofs (
  token_hash text primary key check(length(token_hash)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  operation text not null check(operation in ('delete','restore')),
  expires_at timestamptz not null default now()+interval '2 minutes'
);
create index protected_proofs_user_idx on public.protected_operation_proofs(user_id);
create index protected_proofs_session_idx on public.protected_operation_proofs(session_id);
create index protected_proofs_expiry_idx on public.protected_operation_proofs(expires_at);
create table public.admin_trash (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check(resource_type in
    ('access','cohort','content','material','automation','meeting','offering','goal','milestone','draft_step')),
  resource_id uuid not null,
  label text not null,
  snapshot jsonb not null default '{}',
  owner_id uuid references public.profiles(id) on delete set null,
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',
  purge_error text,
  purge_attempted_at timestamptz,
  restored_at timestamptz
);
create unique index admin_trash_open_resource_idx on public.admin_trash(resource_type,resource_id)
  where restored_at is null;
create index admin_trash_owner_idx on public.admin_trash(owner_id);
create index admin_trash_deleted_by_idx on public.admin_trash(deleted_by);
create index admin_trash_date_idx on public.admin_trash(deleted_at desc) where restored_at is null;
do $$ declare item text; begin
  foreach item in array array['protected_operation_attempts','protected_operation_proofs','admin_trash'] loop
    execute format('alter table public.%I enable row level security',item);
    execute format('revoke all on public.%I from public,anon,authenticated',item);
    execute format('grant select,insert,update,delete on public.%I to service_role',item);
  end loop;
  foreach item in array array['cohorts','journey_stage_contents','lesson_materials','meetings',
    'booking_offerings','whatsapp_automations','rise90_goals','rise90_milestones'] loop
    execute format('alter table public.%I add column deleted_at timestamptz',item);
    execute format('create index %I on public.%I(deleted_at) where deleted_at is not null',item||'_trash_idx',item);
    execute format('create policy "hide trashed rows" on public.%I as restrictive for all to authenticated using(deleted_at is null) with check(deleted_at is null)',item);
    execute format('revoke delete on public.%I from authenticated,anon',item);
  end loop;
end $$;
revoke delete on public.allowed_emails from authenticated,anon;
revoke insert,update,delete on public.journey_steps from authenticated,anon;
create policy "managed files use protected trash" on storage.objects as restrictive
for delete to authenticated using(bucket_id not in ('journey-content','materials','avatars','rise-private'));

create function public.directory_auth_metadata() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,
 'confirmed_at',u.confirmed_at,'banned_until',u.banned_until)),'[]')
 from auth.users u where exists(select 1 from public.allowed_emails a where lower(a.email)=lower(u.email))
$$;
revoke all on function public.directory_auth_metadata() from public,anon,authenticated;
grant execute on function public.directory_auth_metadata() to service_role;

create function private.protected_session(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_platform_access(p_user) and exists(select 1 from auth.sessions s
 where s.id=p_session and s.user_id=p_user and (s.not_after is null or s.not_after>now()))
$$;
create function private.trash_table(p_type text) returns text
language sql immutable set search_path='' as $$
 select case p_type when 'access' then 'allowed_emails' when 'cohort' then 'cohorts'
 when 'content' then 'journey_stage_contents' when 'material' then 'lesson_materials'
 when 'automation' then 'whatsapp_automations' when 'meeting' then 'meetings'
 when 'offering' then 'booking_offerings' when 'goal' then 'rise90_goals'
 when 'milestone' then 'rise90_milestones' end
$$;
create function private.protected_allowed(p_user uuid,p_type text,p_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare item jsonb; staff boolean; administrator boolean; target_table text;
begin
 if not private.has_platform_access(p_user) then return false; end if;
 staff:=public.has_role(p_user,'admin') or public.has_role(p_user,'mentor');
 administrator:=public.has_role(p_user,'admin');
 if p_type='draft' then return administrator or exists(select 1 from public.journey_pillars where id=p_id and mentor_id=p_user); end if;
 target_table:=private.trash_table(p_type);
 if target_table is null then return false; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',target_table) into item using p_id;
 if item is null then return false; end if;
 if p_type='goal' then
   return exists(select 1 from public.enrollments where id=(item->>'enrollment_id')::uuid and mentee_id=p_user);
 elsif p_type='milestone' then
   return exists(select 1 from public.rise90_goals g join public.enrollments e on e.id=g.enrollment_id
     where g.id=(item->>'goal_id')::uuid and e.mentee_id=p_user);
 elsif p_type='cohort' then return administrator;
 elsif p_type='meeting' then return staff and (administrator or (item->>'created_by')::uuid=p_user);
 else return staff; end if;
end $$;
create function public.check_protected_operation(p_user uuid,p_session uuid,p_type text,p_id uuid,p_operation text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare item public.admin_trash;
begin
 if not private.protected_session(p_user,p_session) then return false; end if;
 if p_type='trash' and p_operation='restore' then
  select * into item from public.admin_trash where id=p_id and restored_at is null and expires_at>now();
  if item.id is null then return false; end if;
  if item.resource_type='draft_step' then
    return private.protected_allowed(p_user,'draft',(item.snapshot->>'pillarId')::uuid);
  end if;
  return private.protected_allowed(p_user,item.resource_type,item.resource_id);
 end if;
 if p_operation<>'delete' then return false; end if;
 return private.protected_allowed(p_user,p_type,p_id);
end $$;
create function public.reserve_protected_attempt(p_user uuid,p_session uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare attempt_count integer;
begin
 if not private.protected_session(p_user,p_session) then return false; end if;
 insert into public.protected_operation_attempts(user_id) values(p_user)
 on conflict(user_id) do update set
 attempts=case when protected_operation_attempts.window_started<now()-interval '15 minutes' then 1 else protected_operation_attempts.attempts+1 end,
 window_started=case when protected_operation_attempts.window_started<now()-interval '15 minutes' then now() else protected_operation_attempts.window_started end
 returning attempts into attempt_count;
 return attempt_count<=5;
end $$;
create function private.consume_protected_proof(p_user uuid,p_session uuid,p_type text,p_id uuid,p_operation text,p_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare consumed text;
begin
 if not public.check_protected_operation(p_user,p_session,p_type,p_id,p_operation) then
   raise exception 'Sua sessão expirou ou você não pode alterar este registro.'; end if;
 delete from public.protected_operation_proofs where token_hash=p_hash and user_id=p_user
 and session_id=p_session and resource_type=p_type and resource_id=p_id and operation=p_operation and expires_at>now()
 returning token_hash into consumed;
 if consumed is null then raise exception 'Confirme seu e-mail e senha novamente. A confirmação expirou ou já foi usada.'; end if;
end $$;
create function private.guard_trash_fields() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user not in ('service_role','postgres','supabase_admin') then
  if tg_op='DELETE' or
    (tg_table_name='allowed_emails' and to_jsonb(new)->'archived_at' is distinct from to_jsonb(old)->'archived_at') or
    (tg_table_name<>'allowed_emails' and to_jsonb(new)->'deleted_at' is distinct from to_jsonb(old)->'deleted_at') or
    (tg_table_name='journey_stage_contents' and to_jsonb(new)->'active' is distinct from to_jsonb(old)->'active') or
    (tg_table_name='booking_offerings' and to_jsonb(new)->>'status'='archived' and to_jsonb(old)->'status' is distinct from to_jsonb(new)->'status')
  then raise exception 'Use a exclusão protegida da plataforma.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
do $$ declare item text; begin
 foreach item in array array['allowed_emails','cohorts','journey_stage_contents','lesson_materials',
  'meetings','booking_offerings','whatsapp_automations','rise90_goals','rise90_milestones'] loop
 execute format('create trigger guard_protected_trash before update or delete on public.%I for each row execute function private.guard_trash_fields()',item);
 end loop;
end $$;

create function public.move_resource_to_trash(p_user uuid,p_session uuid,p_type text,p_id uuid,p_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare source jsonb; target_table text; trash_id uuid; owner uuid; auth_id uuid; snapshot jsonb; row_ids jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('rise-protected-trash'));
 perform private.consume_protected_proof(p_user,p_session,p_type,p_id,'delete',p_hash);
 target_table:=private.trash_table(p_type);
 if target_table is null then raise exception 'Tipo de registro inválido.'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',target_table) into source using p_id;
 if source is null then raise exception 'Registro não encontrado.'; end if;
 if exists(select 1 from public.admin_trash where resource_type=p_type and resource_id=p_id and restored_at is null)
 then raise exception 'Este registro já está na lixeira.'; end if;
 snapshot:=jsonb_build_object('row',source);
 if p_type='cohort' and (
   exists(select 1 from public.enrollments where cohort_id=p_id)
   or exists(select 1 from public.meetings where cohort_id=p_id)
   or exists(select 1 from public.journey_steps where cohort_id=p_id)
   or exists(select 1 from public.journey_stage_contents where cohort_id=p_id)
   or exists(select 1 from public.booking_offering_cohorts where cohort_id=p_id)
 ) then raise exception 'Esta turma possui pessoas, aulas ou encontros vinculados. Reorganize os vínculos antes de excluir a turma.'; end if;
 if p_type='access' then
   select id into auth_id from auth.users where lower(email)=lower(source->>'email');
   if auth_id=p_user or exists(select 1 from auth.users where id=p_user and lower(email)=lower(source->>'email'))
   then raise exception 'Você não pode excluir o próprio acesso.'; end if;
   if source->>'role' in ('admin','mentor') and source->>'status'='approved'
    and (select count(*) from public.allowed_emails where status='approved' and archived_at is null and role in ('admin','mentor'))<=1
   then raise exception 'Mantenha pelo menos um acesso administrativo ativo.'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status)),'[]') into row_ids from public.enrollments where mentee_id=auth_id;
   snapshot:=snapshot||jsonb_build_object('enrollments',row_ids,'accessStatus',source->>'status','userId',auth_id);
   update public.allowed_emails set status='revoked',archived_at=now(),archived_by=p_user,archive_snapshot=snapshot where id=p_id;
   update public.enrollments set status='desativada' where mentee_id=auth_id;
   delete from auth.sessions where user_id=auth_id;
 elsif p_type='content' then
   update public.journey_stage_contents set deleted_at=now(),active=false where id=p_id;
 elsif p_type='automation' then
   update public.whatsapp_automations set deleted_at=now(),enabled=false where id=p_id;
 elsif p_type='offering' then
   update public.booking_offerings set deleted_at=now(),status='archived' where id=p_id;
 else
   execute format('update public.%I set deleted_at=now() where id=$1',target_table) using p_id;
 end if;
 if p_type='goal' then select mentee_id into owner from public.enrollments where id=(source->>'enrollment_id')::uuid;
 elsif p_type='milestone' then select e.mentee_id into owner from public.rise90_goals g join public.enrollments e on e.id=g.enrollment_id where g.id=(source->>'goal_id')::uuid;
 end if;
 insert into public.admin_trash(resource_type,resource_id,label,snapshot,owner_id,deleted_by)
 values(p_type,p_id,left(coalesce(source->>'title',source->>'name',source->>'full_name',source->>'email','Registro'),200),snapshot,owner,p_user)
 returning id into trash_id;
 if p_type='meeting' and nullif(source->>'google_event_id','') is not null and nullif(source->>'created_by','') is not null then
   insert into public.google_event_cancellations(google_event_id,google_user_id)
   values(source->>'google_event_id',(source->>'created_by')::uuid) on conflict do nothing;
 end if;
 insert into public.audit_log(actor_id,action,target,payload) values(p_user,'resource_trashed',p_id::text,jsonb_build_object('type',p_type,'trashId',trash_id));
 return trash_id;
end $$;

create function public.restore_trash_resource(p_user uuid,p_session uuid,p_id uuid,p_hash text)
returns text language plpgsql security definer set search_path='' as $$
declare item public.admin_trash; target_table text; source jsonb; enrollment jsonb; v_version uuid;
begin
 perform pg_advisory_xact_lock(hashtext('rise-protected-trash'));
 perform private.consume_protected_proof(p_user,p_session,'trash',p_id,'restore',p_hash);
 select * into item from public.admin_trash where id=p_id and restored_at is null and expires_at>now() for update;
 if item.id is null then raise exception 'Este item já foi recuperado.'; end if;
 source:=item.snapshot->'row';
 target_table:=private.trash_table(item.resource_type);
 if item.resource_type='access' then
   update public.allowed_emails set status=(jsonb_populate_record(null::public.allowed_emails,jsonb_build_object('status',coalesce(item.snapshot->>'accessStatus','approved')))).status,
     archived_at=null,archived_by=null,archive_snapshot='{}' where id=item.resource_id;
   for enrollment in select * from jsonb_array_elements(coalesce(item.snapshot->'enrollments','[]')) loop
     update public.enrollments set status=enrollment->>'status' where id=(enrollment->>'id')::uuid and status='desativada';
   end loop;
 elsif item.resource_type='content' then
   if source->>'cohort_id' is not null and exists(select 1 from public.cohorts where id=(source->>'cohort_id')::uuid and deleted_at is not null)
   then raise exception 'Recupere primeiro a turma deste conteúdo.'; end if;
   update public.journey_stage_contents set deleted_at=null,active=coalesce((source->>'active')::boolean,true) where id=item.resource_id;
 elsif item.resource_type='automation' then
   update public.whatsapp_automations set deleted_at=null,enabled=false where id=item.resource_id;
 elsif item.resource_type='offering' then
   if not exists(select 1 from public.booking_offerings where id=item.resource_id and mentor_id is not null)
   then raise exception 'A mentora desta disponibilidade não está mais cadastrada. Crie uma nova disponibilidade.'; end if;
   update public.booking_offerings set deleted_at=null,status=coalesce(source->>'status','paused') where id=item.resource_id;
 elsif item.resource_type='meeting' then
   update public.meetings set deleted_at=null,google_event_id=null where id=item.resource_id;
 elsif item.resource_type='milestone' then
   if exists(select 1 from public.rise90_goals where id=(source->>'goal_id')::uuid and deleted_at is not null)
   then raise exception 'Recupere primeiro a meta deste marco.'; end if;
   update public.rise90_milestones set deleted_at=null where id=item.resource_id;
 elsif item.resource_type='material' then
   if source->>'meeting_id' is not null and exists(select 1 from public.meetings where id=(source->>'meeting_id')::uuid and deleted_at is not null)
   then raise exception 'Recupere primeiro o encontro deste material.'; end if;
   update public.lesson_materials set deleted_at=null where id=item.resource_id;
 elsif item.resource_type='draft_step' then
   select id into v_version from public.journey_versions where pillar_id=(item.snapshot->>'pillarId')::uuid and status='draft' for update;
   if v_version is null then raise exception 'Abra um rascunho deste pilar antes de recuperar a etapa.'; end if;
   if exists(select 1 from public.journey_steps where version_id=v_version and stable_key=item.resource_id) then
     raise exception 'Esta etapa já existe no rascunho. Confira o conteúdo antes de recuperar.'; end if;
   source:=source||jsonb_build_object('id',gen_random_uuid(),'version_id',v_version,'archived_at',null,
     'position',coalesce((select max(position)+1 from public.journey_steps where version_id=v_version),0));
   insert into public.journey_steps select (jsonb_populate_record(null::public.journey_steps,source)).*;
   update public.journey_versions set revision=revision+1,updated_at=now() where id=v_version;
 else
   execute format('update public.%I set deleted_at=null where id=$1',target_table) using item.resource_id;
 end if;
 update public.admin_trash set restored_at=now(),snapshot='{}' where id=p_id;
 insert into public.audit_log(actor_id,action,target,payload) values(p_user,'resource_restored',item.resource_id::text,jsonb_build_object('type',item.resource_type,'trashId',p_id));
 return case item.resource_type when 'automation' then 'Automação recuperada desativada. Ative-a quando quiser retomar os avisos.'
 when 'meeting' then 'Encontro recuperado na RISE. Confira o Google Agenda antes de reenviar o convite.'
 when 'draft_step' then 'Etapa recuperada no rascunho. Revise e publique quando estiver pronta.'
 else 'Registro recuperado.' end;
end $$;

-- Os acessos anteriormente arquivados também aparecem na lixeira.
insert into public.admin_trash(resource_type,resource_id,label,snapshot,deleted_by,deleted_at,expires_at)
select 'access',id,coalesce(full_name,email),
 jsonb_build_object('row',to_jsonb(a),'legacyBan',true,'userId',(select id from auth.users where lower(email)=lower(a.email)))||archive_snapshot,archived_by,archived_at,archived_at+interval '30 days'
from public.allowed_emails a where archived_at is not null;

-- A sessão de origem é validada novamente no consumo, e as RPCs são exclusivas do servidor.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in ('protected_session','trash_table','protected_allowed','consume_protected_proof','guard_trash_fields'))
 or (n.nspname='public' and p.proname in ('check_protected_operation','reserve_protected_attempt','move_resource_to_trash','restore_trash_resource'))
 loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

-- A remoção lógica de etapas é detectada dentro da mesma transação do salvamento.
-- O endpoint antigo continua aceitando salvamentos sem exclusão, mas não pode contornar a senha.
alter function private.save_journey_draft(uuid,integer,jsonb) rename to apply_journey_draft;
revoke all on function private.apply_journey_draft(uuid,integer,jsonb) from public,anon,authenticated;
drop function public.save_journey_draft(uuid,integer,jsonb);
create function private.save_protected_journey_draft(p_pillar_id uuid,p_expected_revision integer,p_steps jsonb,p_proof_hash text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_version_id uuid; removed public.journey_steps; has_removed boolean; session_id uuid;
begin
 if not public.can_manage_journey_pillar(p_pillar_id) then raise exception 'Acesso restrito ao pilar.'; end if;
 select id into v_version_id from public.journey_versions where pillar_id=p_pillar_id and status='draft' for update;
 if v_version_id is null then raise exception 'Rascunho não encontrado.'; end if;
 select exists(select 1 from public.journey_steps s where s.version_id=v_version_id
   and not exists(select 1 from jsonb_array_elements(coalesce(p_steps,'[]')) x where x->>'stableKey'=s.stable_key::text))
 into has_removed;
 if has_removed then
   session_id:=(auth.jwt()->>'session_id')::uuid;
   perform private.consume_protected_proof(auth.uid(),session_id,'draft',p_pillar_id,'delete',p_proof_hash);
   for removed in select * from public.journey_steps s where s.version_id=v_version_id
    and not exists(select 1 from jsonb_array_elements(coalesce(p_steps,'[]')) x where x->>'stableKey'=s.stable_key::text)
   loop
     insert into public.admin_trash(resource_type,resource_id,label,snapshot,deleted_by)
     values('draft_step',removed.stable_key,removed.title,
       jsonb_build_object('row',to_jsonb(removed),'pillarId',p_pillar_id),auth.uid());
   end loop;
 end if;
 return private.apply_journey_draft(p_pillar_id,p_expected_revision,p_steps);
end $$;
create function public.save_journey_draft(p_pillar_id uuid,p_expected_revision integer,p_steps jsonb,p_proof_hash text default null)
returns integer language sql security invoker set search_path='' as $$
 select private.save_protected_journey_draft(p_pillar_id,p_expected_revision,p_steps,p_proof_hash)
$$;

create function public.list_protected_trash(p_user uuid,p_session uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; total integer; staff boolean;
begin
 if not private.protected_session(p_user,p_session) then raise exception 'Entre novamente para continuar.'; end if;
 staff:=public.has_role(p_user,'admin') or public.has_role(p_user,'mentor');
 select count(*) into total from public.admin_trash t where restored_at is null
 and(t.owner_id=p_user or(t.owner_id is null and staff));
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'type',t.resource_type,'resourceId',t.resource_id,
   'label',t.label,'deletedAt',t.deleted_at,'expiresAt',t.expires_at,'purgePending',t.expires_at<=now(),'deletedBy',coalesce(p.full_name,'Equipe RISE'),
   'canRestore',t.expires_at>now() and case when t.resource_type='draft_step' then private.protected_allowed(p_user,'draft',(t.snapshot->>'pillarId')::uuid)
   else private.protected_allowed(p_user,t.resource_type,t.resource_id) end) order by t.deleted_at desc),'[]')
 into result from (select * from public.admin_trash t where restored_at is null
 and(t.owner_id=p_user or(t.owner_id is null and staff))
 order by deleted_at desc,id limit 50 offset greatest(0,p_offset)) t
 left join public.profiles p on p.id=t.deleted_by;
 return jsonb_build_object('items',result,'total',total);
end $$;
revoke all on function public.list_protected_trash(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.list_protected_trash(uuid,uuid,integer) to service_role;
revoke all on function private.save_protected_journey_draft(uuid,integer,jsonb,text) from public,anon;
revoke all on function public.save_journey_draft(uuid,integer,jsonb,text) from public,anon;
grant execute on function private.save_protected_journey_draft(uuid,integer,jsonb,text) to authenticated,service_role;
grant execute on function public.save_journey_draft(uuid,integer,jsonb,text) to authenticated,service_role;

create or replace function private.can_see_meeting(_meeting_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.meetings m where m.id=_meeting_id and m.deleted_at is null and (
 public.is_staff() or m.audience='all'
 or(m.audience='cohort' and exists(select 1 from public.enrollments e where e.cohort_id=m.cohort_id and e.mentee_id=auth.uid() and e.status='ativa'))
 or(m.enrollment_id is not null and public.can_access_enrollment(m.enrollment_id))
 or exists(select 1 from public.meeting_attendees a join public.enrollments e on e.id=a.enrollment_id where a.meeting_id=m.id and e.mentee_id=auth.uid())))
$$;

-- Cancelar uma reserva continua sendo uma ação de agenda; o encontro fica no histórico.
do $$ declare definition text; begin
 select pg_get_functiondef('public.cancel_booking_atomic(uuid,uuid,text,uuid)'::regprocedure) into definition;
 if position('delete from public.meetings where id=r.meeting_id' in definition)=0 then
   raise exception 'A função de cancelamento mudou; revise a migração.'; end if;
 execute replace(definition,'delete from public.meetings where id=r.meeting_id',
   'update public.meetings set deleted_at=now() where id=r.meeting_id');
 select pg_get_functiondef('private.get_next_journey_step()'::regprocedure) into definition;
 if position('where mt.enrollment_id = e.id' in definition)=0 then
   raise exception 'A função da próxima etapa mudou; revise a migração.'; end if;
 execute replace(definition,'where mt.enrollment_id = e.id','where mt.deleted_at is null and mt.enrollment_id = e.id');
end $$;
