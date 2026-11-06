-- Confiabilidade dos avisos, agendamentos e acesso aos materiais.
alter table public.whatsapp_notifications drop constraint whatsapp_notifications_status_check;
alter table public.whatsapp_notifications add constraint whatsapp_notifications_status_check
  check (status in ('pending','processing','sent','failed','delivered','read'));
alter table public.whatsapp_notifications add column if not exists expires_at timestamptz;
alter table public.whatsapp_notifications add column if not exists source_scheduled_at timestamptz;
create index if not exists whatsapp_notifications_pending_created_idx
  on public.whatsapp_notifications(created_at) where status='pending';

create table if not exists public.google_event_cancellations (
  id uuid primary key default gen_random_uuid(),
  google_user_id uuid not null references public.profiles(id),
  google_event_id text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  unique(google_user_id, google_event_id)
);
alter table public.google_event_cancellations enable row level security;
revoke all on public.google_event_cancellations from public, anon, authenticated;
grant all on public.google_event_cancellations to service_role;
create index if not exists google_cancellations_pending_idx on public.google_event_cancellations(created_at) where completed_at is null;

create table if not exists public.whatsapp_booking_availability (
  automation_id uuid not null references public.whatsapp_automations(id) on delete cascade,
  offering_id uuid not null references public.booking_offerings(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  available boolean not null,
  revision uuid not null default gen_random_uuid(),
  notified_revision uuid,
  primary key(automation_id, offering_id, enrollment_id)
);
alter table public.whatsapp_booking_availability enable row level security;
revoke all on public.whatsapp_booking_availability from public, anon, authenticated;
grant all on public.whatsapp_booking_availability to service_role;

-- Preserva a situação das ofertas já abertas: publicar a correção não dispara uma enxurrada retroativa.
insert into public.whatsapp_booking_availability(automation_id,offering_id,enrollment_id,available,revision,notified_revision)
select a.id,o.id,e.id,true,v.id,v.id
from public.whatsapp_automations a cross join public.booking_offerings o cross join public.enrollments e
cross join lateral (select gen_random_uuid() as id) v
where a.enabled and a.trigger='booking_slots_available' and o.status='active' and e.status='ativa'
  and (o.audience='all' or exists(select 1 from public.booking_offering_cohorts c where c.offering_id=o.id and c.cohort_id=e.cohort_id))
on conflict do nothing;

create or replace function public.set_booking_availability(p_automation_id uuid, p_offering_id uuid, p_enrollment_id uuid, p_available boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v public.whatsapp_booking_availability;
begin
  insert into public.whatsapp_booking_availability(automation_id,offering_id,enrollment_id,available)
  values(p_automation_id,p_offering_id,p_enrollment_id,p_available)
  on conflict(automation_id,offering_id,enrollment_id) do update set
    available=excluded.available,
    revision=case when not whatsapp_booking_availability.available and excluded.available then gen_random_uuid() else whatsapp_booking_availability.revision end;
  select * into v from public.whatsapp_booking_availability where automation_id=p_automation_id and offering_id=p_offering_id and enrollment_id=p_enrollment_id;
  if v.available and v.notified_revision is distinct from v.revision then return v.revision; end if;
  return null;
end $$;

create or replace function public.confirm_booking(p_reservation_id uuid,p_google_event_id text,p_join_url text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.booking_reservations; o public.booking_offerings; m uuid; mentor_name text;
begin
  select * into strict r from public.booking_reservations where id=p_reservation_id for update;
  if r.status='confirmed' then return r.meeting_id; end if;
  if r.status<>'pending' then raise exception 'Reserva indisponível.'; end if;
  select * into strict o from public.booking_offerings where id=r.offering_id;
  select coalesce(nullif(display_name,''),full_name) into mentor_name from public.profiles where id=r.mentor_id;
  insert into public.meetings(enrollment_id,title,description,kind,scheduled_at,ends_at,duration_minutes,join_url,audience,mentor_id,mentor_name,google_event_id,created_by)
  values(r.enrollment_id,o.title,o.description,'individual',r.starts_at,r.ends_at,o.duration_minutes,p_join_url,'selected',r.mentor_id,mentor_name,p_google_event_id,r.mentor_id)
  returning id into m;
  update public.booking_reservations set status='confirmed',meeting_id=m where id=r.id;
  return m;
end $$;

create or replace function public.cancel_booking_atomic(p_reservation_id uuid,p_actor_id uuid,p_google_event_id text default null,p_google_user_id uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.booking_reservations; event_id text; owner_id uuid;
begin
  select * into strict r from public.booking_reservations where id=p_reservation_id for update;
  select google_event_id, created_by into event_id,owner_id from public.meetings where id=r.meeting_id;
  event_id:=coalesce(event_id,p_google_event_id,case when r.status='pending' then replace(r.id::text,'-','') end);
  owner_id:=coalesce(owner_id,p_google_user_id,r.mentor_id);
  if event_id is not null then
    insert into public.google_event_cancellations(google_user_id,google_event_id) values(owner_id,event_id) on conflict do nothing;
  end if;
  update public.booking_reservations set status='cancelled',cancelled_by=p_actor_id,cancelled_at=coalesce(cancelled_at,now()) where id=r.id;
  update public.whatsapp_notifications set status='failed',error_message='Reserva cancelada.'
    where reference_type='booking' and reference_id=r.id::text and status='pending';
  delete from public.meetings where id=r.meeting_id;
end $$;

create or replace function public.recover_stale_bookings()
returns integer language plpgsql security invoker set search_path='' as $$
declare r record; n integer:=0;
begin
  for r in select id,booked_by from public.booking_reservations where status='pending' and created_at<now()-interval '15 minutes' for update skip locked loop
    perform public.cancel_booking_atomic(r.id,r.booked_by);
    n:=n+1;
  end loop;
  return n;
end $$;

create table if not exists public.operation_quotas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null,
  day date not null default current_date,
  used integer not null default 1,
  last_used_at timestamptz not null default now(),
  primary key(user_id,operation,day)
);
alter table public.operation_quotas enable row level security;
revoke all on public.operation_quotas from public,anon,authenticated;
grant all on public.operation_quotas to service_role;
create or replace function public.consume_operation_quota(p_user_id uuid,p_operation text,p_limit integer,p_cooldown_seconds integer)
returns void language plpgsql security invoker set search_path='' as $$
declare v public.operation_quotas;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_operation,0));
  select * into v from public.operation_quotas where user_id=p_user_id and operation=p_operation and day=current_date;
  if v.used>=p_limit or v.last_used_at>now()-make_interval(secs=>p_cooldown_seconds) then
    raise exception 'Limite de tentativas atingido. Aguarde e tente novamente mais tarde.';
  end if;
  insert into public.operation_quotas(user_id,operation) values(p_user_id,p_operation)
    on conflict(user_id,operation,day) do update set used=operation_quotas.used+1,last_used_at=now();
end $$;

revoke all on function public.set_booking_availability(uuid,uuid,uuid,boolean), public.confirm_booking(uuid,text,text),
  public.cancel_booking_atomic(uuid,uuid,text,uuid), public.recover_stale_bookings(), public.consume_operation_quota(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.set_booking_availability(uuid,uuid,uuid,boolean), public.confirm_booking(uuid,text,text),
  public.cancel_booking_atomic(uuid,uuid,text,uuid), public.recover_stale_bookings(), public.consume_operation_quota(uuid,text,integer,integer) to service_role;

-- A mesma verificação de conta ativa é usada pelos dois helpers internos.
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path=''
as $$ select private.is_staff() $$;
create or replace function private.is_enrollment_mentee(_enrollment_id uuid) returns boolean language sql stable security definer set search_path=''
as $$ select public.has_role(auth.uid(),'mentee') and exists(
  select 1 from public.enrollments e where e.id=_enrollment_id and e.mentee_id=auth.uid() and e.status='ativa'
) $$;

alter policy "read lessons" on public.lessons using (
  private.is_staff() or (public.has_role((select auth.uid()),'mentee') and exists(select 1 from public.phases p join public.enrollments e on e.program_id=p.program_id
    where p.id=lessons.phase_id and e.mentee_id=(select auth.uid()) and e.status='ativa' and p.month_number<=e.current_month))
);
alter policy "read materials" on public.lesson_materials using (
  private.is_staff() or (lesson_id is not null and exists(select 1 from public.lessons l where l.id=lesson_materials.lesson_id))
  or (meeting_id is not null and private.can_see_meeting(meeting_id))
);
alter policy "materials read" on storage.objects using (
  bucket_id='materials' and (private.is_staff() or exists(select 1 from public.lesson_materials lm where lm.file_path=objects.name))
);
