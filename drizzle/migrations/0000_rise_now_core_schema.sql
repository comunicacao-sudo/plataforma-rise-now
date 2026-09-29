
-- ENUMS
create type public.app_role as enum ('admin','mentor','mentee');
create type public.invite_status as enum ('approved','revoked');
create type public.content_kind as enum ('aula','atividade','encontro','material');
create type public.submission_status as enum ('nao_iniciada','em_andamento','enviada','em_revisao','concluida');
create type public.note_visibility as enum ('mentee_private','mentor_private','shared');
create type public.meeting_kind as enum ('grupo','individual');

-- PROFILES (id mirrors auth.uid once claimed; no FK to auth schema)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  title text,
  pillar text,
  avatar_url text,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role app_role not null default 'mentee',
  status invite_status not null default 'approved',
  invited_by uuid references public.profiles(id) on update cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.allowed_emails to authenticated;
grant all on public.allowed_emails to service_role;
alter table public.allowed_emails enable row level security;

-- HELPERS
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

-- PROGRAM STRUCTURE
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  description text,
  duration_months int not null default 6,
  created_at timestamptz not null default now()
);
grant select on public.programs to authenticated;
grant all on public.programs to service_role;
alter table public.programs enable row level security;

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  month_number int not null,
  title text not null,
  pillar text not null,
  description text,
  unique (program_id, month_number)
);
grant select on public.phases to authenticated;
grant all on public.phases to service_role;
alter table public.phases enable row level security;

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  title text not null,
  subtitle text,
  description text,
  kind content_kind not null default 'aula',
  duration_minutes int,
  media_url text,
  cover_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.lessons to authenticated;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  title text not null,
  description text,
  position int not null default 0
);
grant select on public.deliverables to authenticated;
grant all on public.deliverables to service_role;
alter table public.deliverables enable row level security;

-- ENROLLMENTS
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  mentor_id uuid references public.profiles(id) on delete set null on update cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  current_month int not null default 1,
  progress_pct int not null default 0,
  started_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (mentee_id, program_id)
);
grant select, update on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;

create or replace function public.can_access_enrollment(_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    where e.id = _enrollment_id
      and (e.mentee_id = auth.uid() or e.mentor_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  )
$$;

create or replace function public.is_enrollment_mentee(_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e where e.id = _enrollment_id and e.mentee_id = auth.uid())
$$;

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (enrollment_id, lesson_id)
);
grant select, insert, update on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
alter table public.lesson_progress enable row level security;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  status submission_status not null default 'nao_iniciada',
  content text,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, deliverable_id)
);
grant select, insert, update on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.enrollments(id) on delete cascade,
  title text not null,
  description text,
  kind meeting_kind not null default 'individual',
  scheduled_at timestamptz not null,
  duration_minutes int default 60,
  join_url text
);
grant select on public.meetings to authenticated;
grant all on public.meetings to service_role;
alter table public.meetings enable row level security;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  visibility note_visibility not null default 'mentee_private',
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;

create table public.rise90_goals (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  title text not null,
  metric text,
  target_value numeric,
  current_value numeric not null default 0,
  horizon text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.rise90_goals to authenticated;
grant all on public.rise90_goals to service_role;
alter table public.rise90_goals enable row level security;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on update cascade,
  action text not null,
  target text,
  payload jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  kind text not null,
  granted boolean not null default true,
  granted_at timestamptz not null default now(),
  unique (user_id, kind)
);
grant select, insert, update on public.consents to authenticated;
grant all on public.consents to service_role;
alter table public.consents enable row level security;

-- POLICIES
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin()
    or exists (select 1 from public.enrollments e where (e.mentee_id = profiles.id and e.mentor_id = auth.uid()) or (e.mentor_id = profiles.id and e.mentee_id = auth.uid())));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "admins manage invites" on public.allowed_emails for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read programs" on public.programs for select to authenticated using (true);
create policy "read phases" on public.phases for select to authenticated using (true);
create policy "read lessons" on public.lessons for select to authenticated using (true);
create policy "read deliverables" on public.deliverables for select to authenticated using (true);

create policy "read own enrollments" on public.enrollments for select to authenticated
  using (mentee_id = auth.uid() or mentor_id = auth.uid() or public.is_admin());
create policy "update enrollments" on public.enrollments for update to authenticated
  using (mentee_id = auth.uid() or mentor_id = auth.uid() or public.is_admin())
  with check (mentee_id = auth.uid() or mentor_id = auth.uid() or public.is_admin());

create policy "read progress" on public.lesson_progress for select to authenticated
  using (public.can_access_enrollment(enrollment_id));
create policy "mentee writes progress" on public.lesson_progress for insert to authenticated
  with check (public.is_enrollment_mentee(enrollment_id));
create policy "mentee updates progress" on public.lesson_progress for update to authenticated
  using (public.is_enrollment_mentee(enrollment_id)) with check (public.is_enrollment_mentee(enrollment_id));

create policy "read submissions" on public.submissions for select to authenticated
  using (public.can_access_enrollment(enrollment_id));
create policy "mentee inserts submissions" on public.submissions for insert to authenticated
  with check (public.is_enrollment_mentee(enrollment_id));
create policy "participants update submissions" on public.submissions for update to authenticated
  using (public.can_access_enrollment(enrollment_id)) with check (public.can_access_enrollment(enrollment_id));

create policy "read meetings" on public.meetings for select to authenticated
  using (enrollment_id is null or public.can_access_enrollment(enrollment_id));

create policy "read notes" on public.notes for select to authenticated
  using (author_id = auth.uid() or (visibility = 'shared' and public.can_access_enrollment(enrollment_id)));
create policy "write own notes" on public.notes for insert to authenticated
  with check (author_id = auth.uid() and public.can_access_enrollment(enrollment_id));
create policy "update own notes" on public.notes for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own notes" on public.notes for delete to authenticated
  using (author_id = auth.uid());

create policy "read rise90" on public.rise90_goals for select to authenticated
  using (public.can_access_enrollment(enrollment_id));
create policy "mentee writes rise90" on public.rise90_goals for insert to authenticated
  with check (public.is_enrollment_mentee(enrollment_id));
create policy "mentee updates rise90" on public.rise90_goals for update to authenticated
  using (public.is_enrollment_mentee(enrollment_id)) with check (public.is_enrollment_mentee(enrollment_id));
create policy "mentee deletes rise90" on public.rise90_goals for delete to authenticated
  using (public.is_enrollment_mentee(enrollment_id));

create policy "admins read audit" on public.audit_log for select to authenticated using (public.is_admin());
create policy "insert audit" on public.audit_log for insert to authenticated with check (actor_id = auth.uid());

create policy "own consents" on public.consents for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "insert own consents" on public.consents for insert to authenticated with check (user_id = auth.uid());
create policy "update own consents" on public.consents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
