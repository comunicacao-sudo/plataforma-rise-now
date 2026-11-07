-- Credenciais continuam criptografadas em app_user_connections.
-- A lista abaixo libera somente arquivos/revisões aprovados pela dona da conexão.
create table public.journey_drive_authorizations (
  content_id uuid primary key references public.journey_stage_contents(id) on delete cascade,
  source_revision integer not null check(source_revision > 0),
  authorized_by uuid not null references public.profiles(id) on delete cascade,
  authorized_at timestamptz not null default now()
);
create index journey_drive_authorizations_owner_idx
  on public.journey_drive_authorizations(authorized_by);
alter table public.journey_drive_authorizations enable row level security;
revoke all on public.journey_drive_authorizations from public, anon, authenticated;
grant select,insert,update,delete on public.journey_drive_authorizations to service_role;

create function private.resolve_drive_video_authorizer(p_content_id uuid, p_revision integer)
returns uuid language sql stable security definer set search_path='' as $$
  select a.authorized_by from public.journey_drive_authorizations a
  join public.journey_stage_contents c on c.id=a.content_id
  where a.content_id=p_content_id and a.source_revision=p_revision
    and c.source_revision=p_revision and c.active and c.content_type='video'
    and private.has_platform_access(a.authorized_by)
    and (public.has_role(a.authorized_by,'admin') or public.has_role(a.authorized_by,'mentor'))
$$;
revoke all on function private.resolve_drive_video_authorizer(uuid,integer) from public,anon,authenticated;
grant execute on function private.resolve_drive_video_authorizer(uuid,integer) to service_role;

create function public.resolve_drive_video_authorizer(p_content_id uuid, p_revision integer)
returns uuid language sql stable security invoker set search_path='' as $$
  select private.resolve_drive_video_authorizer(p_content_id,p_revision)
$$;
revoke all on function public.resolve_drive_video_authorizer(uuid,integer) from public,anon,authenticated;
grant execute on function public.resolve_drive_video_authorizer(uuid,integer) to service_role;
