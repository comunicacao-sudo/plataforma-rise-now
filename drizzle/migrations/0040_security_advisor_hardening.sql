-- Move privileged implementations out of the exposed public schema.
-- Public wrappers preserve every existing RPC signature while running as the caller.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;

alter function public.can_access_enrollment(uuid) set schema private;
alter function public.can_access_journey_step(uuid) set schema private;
alter function public.can_manage_journey_pillar(uuid) set schema private;
alter function public.can_see_meeting(uuid) set schema private;
alter function public.get_journey_media_path(uuid) set schema private;
alter function public.get_next_journey_step() set schema private;
alter function public.has_role(uuid, public.app_role) set schema private;
alter function public.is_admin() set schema private;
alter function public.is_enrollment_mentee(uuid) set schema private;
alter function public.is_staff() set schema private;
alter function public.mentee_public_profile(uuid) set schema private;
alter function public.public_staff_directory() set schema private;
alter function public.publish_journey_draft(uuid, integer, boolean) set schema private;
alter function public.save_journey_draft(uuid, integer, jsonb) set schema private;

create function public.can_access_enrollment(_enrollment_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.can_access_enrollment(_enrollment_id) $$;

create function public.can_access_journey_step(_step_key uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.can_access_journey_step(_step_key) $$;

create function public.can_manage_journey_pillar(_pillar_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.can_manage_journey_pillar(_pillar_id) $$;

create function public.can_see_meeting(_meeting_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.can_see_meeting(_meeting_id) $$;

create function public.get_journey_media_path(_step_key uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_journey_media_path(_step_key) $$;

create function public.get_next_journey_step()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_next_journey_step() $$;

create function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.has_role(_user_id, _role) $$;

create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_admin() $$;

create function public.is_enrollment_mentee(_enrollment_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_enrollment_mentee(_enrollment_id) $$;

create function public.is_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_staff() $$;

create function public.mentee_public_profile(_enrollment_id uuid)
returns table(
  id uuid,
  display_name text,
  avatar_url text,
  profession text,
  profession_visible boolean
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.mentee_public_profile(_enrollment_id) $$;

create function public.public_staff_directory()
returns table(
  id uuid,
  full_name text,
  title text,
  avatar_url text,
  is_admin boolean,
  staff_type text,
  specialty text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.public_staff_directory() $$;

create function public.publish_journey_draft(
  p_pillar_id uuid,
  p_expected_revision integer,
  p_apply_active boolean default false
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.publish_journey_draft(
    p_pillar_id,
    p_expected_revision,
    p_apply_active
  )
$$;

create function public.save_journey_draft(
  p_pillar_id uuid,
  p_expected_revision integer,
  p_steps jsonb
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.save_journey_draft(
    p_pillar_id,
    p_expected_revision,
    p_steps
  )
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

revoke execute on function public.can_access_enrollment(uuid) from public, anon;
revoke execute on function public.can_access_journey_step(uuid) from public, anon;
revoke execute on function public.can_manage_journey_pillar(uuid) from public, anon;
revoke execute on function public.can_see_meeting(uuid) from public, anon;
revoke execute on function public.get_journey_media_path(uuid) from public, anon;
revoke execute on function public.get_next_journey_step() from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_enrollment_mentee(uuid) from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.mentee_public_profile(uuid) from public, anon;
revoke execute on function public.public_staff_directory() from public, anon;
revoke execute on function public.publish_journey_draft(uuid, integer, boolean) from public, anon;
revoke execute on function public.save_journey_draft(uuid, integer, jsonb) from public, anon;

grant execute on function public.can_access_enrollment(uuid) to authenticated, service_role;
grant execute on function public.can_access_journey_step(uuid) to authenticated, service_role;
grant execute on function public.can_manage_journey_pillar(uuid) to authenticated, service_role;
grant execute on function public.can_see_meeting(uuid) to authenticated, service_role;
grant execute on function public.get_journey_media_path(uuid) to authenticated, service_role;
grant execute on function public.get_next_journey_step() to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_enrollment_mentee(uuid) to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.mentee_public_profile(uuid) to authenticated, service_role;
grant execute on function public.public_staff_directory() to authenticated, service_role;
grant execute on function public.publish_journey_draft(uuid, integer, boolean) to authenticated, service_role;
grant execute on function public.save_journey_draft(uuid, integer, jsonb) to authenticated, service_role;

-- Replace broad ALL policies with operation-specific policies so SELECT has
-- exactly one permissive policy per role/action.
drop policy "admins manage cohorts" on public.cohorts;
create policy "admins insert cohorts" on public.cohorts
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins update cohorts" on public.cohorts
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "admins delete cohorts" on public.cohorts
  for delete to authenticated
  using ((select private.is_admin()));

drop policy "admins manage deliverables" on public.deliverables;
create policy "admins insert deliverables" on public.deliverables
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins update deliverables" on public.deliverables
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "admins delete deliverables" on public.deliverables
  for delete to authenticated
  using ((select private.is_admin()));

drop policy "mentee reads own journey markers" on public.journey_content_markers;
drop policy "mentee reads own journey notes" on public.journey_content_notes;
drop policy "mentee reads own journey content progress" on public.journey_content_progress;

drop policy "mentee updates own incomplete journey progress" on public.journey_step_progress;
drop policy "staff updates progress in own journey pillar" on public.journey_step_progress;
create policy "authorized participants update journey progress"
on public.journey_step_progress
for update to authenticated
using (
  (
    (select private.is_enrollment_mentee(enrollment_id))
    and status <> 'completed'
  )
  or
  (
    (select private.is_admin())
    or exists (
      select 1
      from public.journey_steps s
      join public.journey_versions v on v.id = s.version_id
      where s.stable_key = journey_step_progress.step_key
        and (select private.can_manage_journey_pillar(v.pillar_id))
    )
  )
)
with check (
  (
    (select private.is_enrollment_mentee(enrollment_id))
    and status = any (array['not_started', 'in_progress', 'awaiting_confirmation'])
    and completed_at is null
    and confirmed_by is null
  )
  or
  (
    (select private.is_admin())
    or exists (
      select 1
      from public.journey_steps s
      join public.journey_versions v on v.id = s.version_id
      where s.stable_key = journey_step_progress.step_key
        and (select private.can_manage_journey_pillar(v.pillar_id))
    )
  )
);

drop policy "staff writes materials" on public.lesson_materials;
create policy "staff inserts materials" on public.lesson_materials
  for insert to authenticated
  with check ((select private.is_staff()));
create policy "staff updates materials" on public.lesson_materials
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));
create policy "staff deletes materials" on public.lesson_materials
  for delete to authenticated
  using ((select private.is_staff()));

drop policy "admins manage lessons" on public.lessons;
create policy "admins insert lessons" on public.lessons
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins update lessons" on public.lessons
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "admins delete lessons" on public.lessons
  for delete to authenticated
  using ((select private.is_admin()));

drop policy "admins manage mentor specialties" on public.mentor_specialties;
create policy "admins insert mentor specialties" on public.mentor_specialties
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins update mentor specialties" on public.mentor_specialties
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "admins delete mentor specialties" on public.mentor_specialties
  for delete to authenticated
  using ((select private.is_admin()));

drop policy "admins manage phases" on public.phases;
create policy "admins insert phases" on public.phases
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins update phases" on public.phases
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "admins delete phases" on public.phases
  for delete to authenticated
  using ((select private.is_admin()));

drop policy "admins manage programs" on public.programs;
create policy "admins insert programs" on public.programs
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins update programs" on public.programs
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "admins delete programs" on public.programs
  for delete to authenticated
  using ((select private.is_admin()));

drop policy "mentee writes milestones" on public.rise90_milestones;
create policy "mentee inserts milestones" on public.rise90_milestones
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.rise90_goals g
      where g.id = rise90_milestones.goal_id
        and (select private.is_enrollment_mentee(g.enrollment_id))
    )
  );
create policy "mentee updates milestones" on public.rise90_milestones
  for update to authenticated
  using (
    exists (
      select 1
      from public.rise90_goals g
      where g.id = rise90_milestones.goal_id
        and (select private.is_enrollment_mentee(g.enrollment_id))
    )
  )
  with check (
    exists (
      select 1
      from public.rise90_goals g
      where g.id = rise90_milestones.goal_id
        and (select private.is_enrollment_mentee(g.enrollment_id))
    )
  );
create policy "mentee deletes milestones" on public.rise90_milestones
  for delete to authenticated
  using (
    exists (
      select 1
      from public.rise90_goals g
      where g.id = rise90_milestones.goal_id
        and (select private.is_enrollment_mentee(g.enrollment_id))
    )
  );

drop policy "mentee inserts submissions" on public.submissions;
drop policy "reviewers insert submissions" on public.submissions;
create policy "authorized participants insert submissions"
on public.submissions
for insert to authenticated
with check (
  (select private.is_enrollment_mentee(enrollment_id))
  or (select private.is_admin())
  or exists (
    select 1
    from public.enrollments e
    where e.id = submissions.enrollment_id
      and e.mentor_id = (select auth.uid())
  )
);

drop policy "admins manage roles" on public.user_roles;
create policy "admins insert roles" on public.user_roles
  for insert to authenticated
  with check ((select private.is_admin()));
create policy "admins update roles" on public.user_roles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "admins delete roles" on public.user_roles
  for delete to authenticated
  using ((select private.is_admin()));
