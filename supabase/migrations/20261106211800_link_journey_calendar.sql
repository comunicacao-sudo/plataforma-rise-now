alter table public.meetings add column journey_step_key uuid;
alter table public.booking_offerings add column journey_step_key uuid;
create index meetings_journey_step_idx on public.meetings(journey_step_key,scheduled_at) where journey_step_key is not null;
create index booking_offerings_journey_step_idx on public.booking_offerings(journey_step_key) where journey_step_key is not null;

create function private.validate_meeting_journey_step() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.journey_step_key is not null and not exists(select 1 from public.journey_steps s where s.stable_key=new.journey_step_key and s.archived_at is null) then
  raise exception 'Etapa da jornada inválida.';
 end if;
 return new;
end $$;
create trigger validate_meeting_journey_step before insert or update of journey_step_key on public.meetings for each row execute function private.validate_meeting_journey_step();
create trigger validate_booking_journey_step before insert or update of journey_step_key on public.booking_offerings for each row execute function private.validate_meeting_journey_step();
revoke all on function private.validate_meeting_journey_step() from public,anon,authenticated;

-- Link only unambiguous existing legacy lesson identities; never match titles.
with identities as(select resource_id,min(stable_key::text)::uuid step_key from public.journey_steps where resource_id is not null and archived_at is null group by resource_id having count(distinct stable_key)=1)
update public.meetings m set journey_step_key=i.step_key from identities i where i.resource_id=m.lesson_id::text and m.journey_step_key is null;

create or replace function public.confirm_booking(p_reservation_id uuid,p_google_event_id text,p_join_url text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.booking_reservations; o public.booking_offerings; m uuid; mentor_name text;
begin
 select * into strict r from public.booking_reservations where id=p_reservation_id for update;
 if r.status='confirmed' then return r.meeting_id; end if;
 if r.status<>'pending' then raise exception 'Reserva indisponível.'; end if;
 select * into strict o from public.booking_offerings where id=r.offering_id;
 select coalesce(nullif(display_name,''),full_name) into mentor_name from public.profiles where id=r.mentor_id;
 insert into public.meetings(enrollment_id,title,description,kind,scheduled_at,ends_at,duration_minutes,join_url,audience,mentor_id,mentor_name,google_event_id,created_by,journey_step_key)
 values(r.enrollment_id,o.title,o.description,'individual',r.starts_at,r.ends_at,o.duration_minutes,p_join_url,'selected',r.mentor_id,mentor_name,p_google_event_id,r.mentor_id,o.journey_step_key) returning id into m;
 update public.booking_reservations set status='confirmed',meeting_id=m where id=r.id;
 return m;
end $$;
revoke all on function public.confirm_booking(uuid,text,text) from public,anon,authenticated;
grant execute on function public.confirm_booking(uuid,text,text) to service_role;
