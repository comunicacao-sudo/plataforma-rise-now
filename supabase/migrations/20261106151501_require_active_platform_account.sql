-- A aprovação atual é consultada no banco, inclusive para JWTs ainda válidos.
-- Somente dados de identidade mantidos pelo servidor participam da autorização.
create or replace function private.has_platform_access()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.allowed_emails a on lower(a.email) = lower(u.email)
    join public.user_roles r on r.user_id = u.id
    where u.id = (select auth.uid())
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and a.status = 'approved' and a.archived_at is null
      and r.role in ('admin', 'mentor', 'mentee')
  )
$$;
revoke all on function private.has_platform_access() from public, anon;
grant execute on function private.has_platform_access() to authenticated, service_role;

-- A RPC pública retorna somente o estado de acesso do próprio chamador.
create or replace function public.has_platform_access()
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select private.has_platform_access() $$;
revoke all on function public.has_platform_access() from public, anon;
grant execute on function public.has_platform_access() to authenticated, service_role;

-- Interseção com as políticas existentes: não amplia acesso a linhas/colunas.
-- Tabelas exclusivas do servidor continuam sem políticas ou grants de navegador.
do $$
declare target record;
begin
  for target in
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (
        has_table_privilege('authenticated', c.oid, 'SELECT') or
        has_table_privilege('authenticated', c.oid, 'INSERT') or
        has_table_privilege('authenticated', c.oid, 'UPDATE') or
        has_table_privilege('authenticated', c.oid, 'DELETE')
      )
  loop
    if not target.relrowsecurity then
      raise exception 'RLS deve estar habilitado em public.%', target.relname;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = target.relname and policyname = 'approved account required') then
      execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select private.has_platform_access())) with check ((select private.has_platform_access()))', 'approved account required', target.relname);
    end if;
  end loop;
end $$;

create policy "approved account required" on storage.objects
as restrictive for all to authenticated
using ((select private.has_platform_access()))
with check ((select private.has_platform_access()));
