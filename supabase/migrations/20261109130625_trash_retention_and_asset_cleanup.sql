create table public.trash_asset_cleanup (
 id uuid primary key default gen_random_uuid(),
 provider text not null check(provider in ('storage','r2')),
 bucket text not null default '',
 path text not null check(length(path) between 1 and 2048),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 lease_until timestamptz,
 token_hash text,
 attempts integer not null default 0,
 last_error text,
 unique(provider,bucket,path)
);
alter table public.trash_asset_cleanup enable row level security;
revoke all on public.trash_asset_cleanup from public,anon,authenticated;
grant select,insert,update,delete on public.trash_asset_cleanup to service_role;
create index trash_cleanup_pending_idx on public.trash_asset_cleanup(lease_until,created_at) where completed_at is null;
create index admin_trash_expiry_idx on public.admin_trash(expires_at) where restored_at is null;

-- Uma foto recém-enviada, ainda sem vínculo, pode ser descartada se o salvamento falhar.
create function private.unreferenced_avatar(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.profiles where
 right(split_part(avatar_url,'?',1),length('/avatars/'||p_path))='/avatars/'||p_path)
$$;
revoke all on function private.unreferenced_avatar(text) from public,anon;
grant execute on function private.unreferenced_avatar(text) to authenticated,service_role;
drop policy "managed files use protected trash" on storage.objects;
create policy "managed files use protected trash" on storage.objects as restrictive
for delete to authenticated using(bucket_id not in ('journey-content','materials','rise-private')
 and(bucket_id<>'avatars' or private.unreferenced_avatar(name)));

-- A autoria de registros compartilhados é preservada mesmo após apagar uma conta.
do $$ declare relation record; begin
 for relation in select c.conname,c.conrelid::regclass as table_name,a.attname as column_name
 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
 where c.contype='f' and c.confrelid='public.profiles'::regclass and
 (c.conrelid='public.assessment_development_plans'::regclass and a.attname='created_by'
 or c.conrelid='public.booking_offerings'::regclass and a.attname in ('created_by','mentor_id')
 or c.conrelid='public.booking_reservations'::regclass and a.attname in ('booked_by','mentor_id'))
 loop
  execute format('alter table %s alter column %I drop not null',relation.table_name,relation.column_name);
  execute format('alter table %s drop constraint %I',relation.table_name,relation.conname);
  execute format('alter table %s add constraint %I foreign key(%I) references public.profiles(id) on update cascade on delete set null',
    relation.table_name,relation.conname,relation.column_name);
 end loop;
end $$;

create function private.enqueue_trash_asset(p_provider text,p_bucket text,p_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_path is null or p_path='' or length(p_path)>2048 then return; end if;
 insert into public.trash_asset_cleanup(provider,bucket,path) values(p_provider,p_bucket,p_path)
 on conflict(provider,bucket,path) do update set completed_at=null,lease_until=null,token_hash=null,last_error=null;
end $$;
create function private.queue_trash_assets(p_data jsonb,p_bucket text) returns void
language plpgsql security definer set search_path='' as $$
declare field text; value jsonb; path text;
begin
 foreach field in array array['file_path','media_path','cover_path','cover_path_light','cover_path_dark','filePath','mediaPath','coverPath','path','anexo_path'] loop
  for value in select * from jsonb_path_query(p_data,('$.'||'**.'||field)::jsonpath) loop
   if jsonb_typeof(value)<>'string' then continue; end if;
   path:=value#>>'{}';
   if left(path,3)='r2:' then perform private.enqueue_trash_asset('r2','',substring(path from 4));
   elsif path!~'^https?://' then perform private.enqueue_trash_asset('storage',p_bucket,path);
   end if;
  end loop;
 end loop;
end $$;
create function private.trash_asset_referenced(p_provider text,p_bucket text,p_path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare full_path text;
begin
 full_path:=case when p_provider='r2' then 'r2:'||p_path else p_path end;
 if p_provider='r2' or p_bucket='journey-content' then
  if exists(select 1 from public.journey_steps s where full_path=any(array[s.media_path,s.cover_path,s.cover_path_light,s.cover_path_dark])
    or jsonb_path_exists(s.materials,'$.** ? (@ == $path)',jsonb_build_object('path',full_path)))
  or exists(select 1 from public.journey_stage_contents c where full_path=c.media_path or full_path=c.file_path)
  then return true; end if;
 end if;
 if p_provider='storage' then
  if p_bucket='materials' and exists(select 1 from public.lesson_materials where file_path=p_path) then return true; end if;
  if p_bucket='rise-private' and exists(select 1 from public.submissions where file_path=p_path) then return true; end if;
  if p_bucket='avatars' and exists(select 1 from public.profiles where
   right(split_part(avatar_url,'?',1),length('/avatars/'||p_path))='/avatars/'||p_path) then return true; end if;
  if exists(select 1 from public.rise_producao_aulas where anexo_path=p_path) then return true; end if;
 end if;
 return exists(select 1 from public.admin_trash t where restored_at is null and expires_at>now()
   and jsonb_path_exists(t.snapshot,'$.** ? (@ == $path)',jsonb_build_object('path',full_path)));
end $$;

create function public.purge_expired_trash(p_storage_origin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.admin_trash; source jsonb; target_table text; asset record; v_user_id uuid; avatar text;
 prefix text; purged integer:=0; failed integer:=0;
begin
 if not pg_try_advisory_xact_lock(hashtext('rise-protected-trash')) then
  return jsonb_build_object('purged',0,'failed',0,'busy',true); end if;
 for item in select t.* from public.admin_trash t where t.restored_at is null and t.expires_at<=now()
  and(t.purge_attempted_at is null or t.purge_attempted_at<now()-interval '15 minutes')
  and not exists(select 1 from public.admin_trash dependency where dependency.id<>t.id
   and dependency.restored_at is null and dependency.expires_at>now()
   and jsonb_path_exists(dependency.snapshot,'$.** ? (@ == $id)',jsonb_build_object('id',t.resource_id::text)))
  order by t.purge_error is not null,t.expires_at limit 10 for update skip locked
 loop
  begin
   source:=item.snapshot->'row';
   target_table:=private.trash_table(item.resource_type);
   if item.resource_type in ('content','draft_step') then
    perform private.queue_trash_assets(item.snapshot,'journey-content');
   elsif item.resource_type='material' then perform private.queue_trash_assets(item.snapshot,'materials');
   elsif item.resource_type='meeting' then
    for asset in select to_jsonb(lm) as data from public.lesson_materials lm where meeting_id=item.resource_id loop
     perform private.queue_trash_assets(asset.data,'materials');
    end loop;
   elsif item.resource_type='cohort' then
    for asset in select to_jsonb(c) as data from public.journey_stage_contents c where cohort_id=item.resource_id loop
     perform private.queue_trash_assets(asset.data,'journey-content');
    end loop;
   elsif item.resource_type='access' then
    select id into v_user_id from auth.users where lower(email)=lower(source->>'email');
    if v_user_id is not null then
     select avatar_url into avatar from public.profiles where id=v_user_id;
     prefix:=rtrim(p_storage_origin,'/')||'/storage/v1/object/public/avatars/';
     if left(avatar,length(prefix))=prefix then
       perform private.enqueue_trash_asset('storage','avatars',substring(split_part(avatar,'?',1) from length(prefix)+1)); end if;
     for asset in select bucket_id,name from storage.objects where owner=v_user_id or owner_id=v_user_id::text loop
      perform private.enqueue_trash_asset('storage',asset.bucket_id,asset.name);
     end loop;
     for asset in select to_jsonb(c) as data from public.journey_stage_contents c where mentee_id=v_user_id
      union all select to_jsonb(s) from public.journey_steps s where mentee_id=v_user_id loop
      perform private.queue_trash_assets(asset.data,'journey-content');
     end loop;
     for asset in select to_jsonb(s) as data from public.submissions s join public.enrollments e on e.id=s.enrollment_id where e.mentee_id=v_user_id loop
      perform private.queue_trash_assets(asset.data,'rise-private');
     end loop;
     for asset in select to_jsonb(lm) as data from public.lesson_materials lm join public.meetings m on m.id=lm.meeting_id
      join public.enrollments e on e.id=m.enrollment_id where e.mentee_id=v_user_id loop
      perform private.queue_trash_assets(asset.data,'materials');
     end loop;
     -- Somente a propriedade do metadado muda; a exclusão física usa a API de Storage.
     update storage.objects set owner=null,owner_id=null where owner=v_user_id or owner_id=v_user_id::text;
     update public.allowed_emails set invited_by=null where invited_by=v_user_id;
     update public.audit_log set actor_id=null where actor_id=v_user_id;
     update public.booking_offerings set status='archived' where mentor_id=v_user_id;
     delete from public.app_user_connections where user_id=v_user_id;
     delete from public.google_event_cancellations where google_user_id=v_user_id;
     delete from auth.users where id=v_user_id;
    end if;
   end if;
   if target_table is not null then
    execute format('delete from public.%I where id=$1',target_table) using item.resource_id;
   end if;
   delete from public.admin_trash where id=item.id;
   insert into public.audit_log(actor_id,action,target,payload)
    values(null,'trash_purged',item.resource_id::text,jsonb_build_object('type',item.resource_type));
   purged:=purged+1;
  exception when others then
   update public.admin_trash set purge_error='Não foi possível concluir a limpeza. Uma nova tentativa será feita automaticamente.',
    purge_attempted_at=now() where id=item.id;
   failed:=failed+1;
  end;
 end loop;
 delete from public.protected_operation_proofs where expires_at<=now();
 delete from public.protected_operation_attempts where window_started<now()-interval '1 day';
 delete from public.admin_trash where restored_at<now()-interval '30 days';
 return jsonb_build_object('purged',purged,'failed',failed);
end $$;

create function public.claim_trash_asset(p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.trash_asset_cleanup;
begin
 if p_token_hash!~'^[a-f0-9]{64}$' then raise exception 'Recibo inválido.'; end if;
 select * into item from public.trash_asset_cleanup where completed_at is null and
  (lease_until is null or lease_until<now()) order by last_error is not null,created_at
  limit 1 for update skip locked;
 if item.id is null then return null; end if;
 if private.trash_asset_referenced(item.provider,item.bucket,item.path) then
  update public.trash_asset_cleanup set completed_at=now(),token_hash=null where id=item.id;
  return jsonb_build_object('shared',true);
 end if;
 update public.trash_asset_cleanup set token_hash=p_token_hash,lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=item.id;
 return jsonb_build_object('id',item.id,'provider',item.provider,'bucket',item.bucket,'path',item.path);
end $$;
create function public.authorize_trash_asset_cleanup(p_job_id uuid,p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.trash_asset_cleanup;
begin
 select * into item from public.trash_asset_cleanup where id=p_job_id and provider='r2'
  and completed_at is null and lease_until>now() and token_hash=p_token_hash;
 if item.id is null or private.trash_asset_referenced(item.provider,item.bucket,item.path) then return null; end if;
 return jsonb_build_object('key',item.path);
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where(n.nspname='private' and p.proname in ('enqueue_trash_asset','queue_trash_assets','trash_asset_referenced'))
 or(n.nspname='public' and p.proname in ('purge_expired_trash','claim_trash_asset','authorize_trash_asset_cleanup'))
 loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
