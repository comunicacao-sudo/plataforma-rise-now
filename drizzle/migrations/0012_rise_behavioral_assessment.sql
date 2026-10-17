-- Mapeamento Comportamental RISE v1.0
-- The authenticated client receives no direct grants for these tables. All
-- access is mediated by authenticated server functions that return only the
-- audience-authorized projection of a report.

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  mentee_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  assessment_version text not null,
  scoring_version text not null,
  prompt_version text not null,
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  current_index integer not null default 0 check (current_index >= 0 and current_index <= 50),
  report_status text not null default 'full_report_locked'
    check (report_status in ('summary_available','full_report_locked','full_report_released')),
  calculated_result jsonb,
  calculated_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null on update cascade,
  reviewed_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null on update cascade,
  released_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists assessment_one_open_attempt
  on public.assessment_attempts(enrollment_id, assessment_version)
  where status = 'in_progress';
create index if not exists assessment_attempts_history
  on public.assessment_attempts(enrollment_id, started_at desc);

create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  item_id text not null,
  perspective text not null check (perspective in ('natural','adapted','motivation','leadership')),
  value smallint not null check (value between 1 and 5),
  answered_at timestamptz not null default now(),
  unique (attempt_id, item_id)
);

create table if not exists public.assessment_ai_outputs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  audience text not null check (audience in ('mentee_summary','mentor_full')),
  prompt_version text not null,
  status text not null default 'pending' check (status in ('pending','generated','reviewed','failed')),
  authorized_sections jsonb not null default '[]'::jsonb,
  evidence_ids jsonb not null default '[]'::jsonb,
  output jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_development_plans (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict on update cascade,
  priority_focus text not null,
  objective text not null,
  action text not null,
  progress_evidence text,
  due_date date,
  review_date date,
  observations text,
  status text not null default 'draft' check (status in ('draft','agreed','in_progress','completed')),
  responsible text,
  shared_with_mentee boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private notes live in a separate table so a shared plan can never expose
-- mentor-only notes through a broad row projection.
create table if not exists public.assessment_development_private_notes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.assessment_development_plans(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant all on public.assessment_attempts to service_role;
grant all on public.assessment_responses to service_role;
grant all on public.assessment_ai_outputs to service_role;
grant all on public.assessment_development_plans to service_role;
grant all on public.assessment_development_private_notes to service_role;

revoke all on public.assessment_attempts from anon, authenticated;
revoke all on public.assessment_responses from anon, authenticated;
revoke all on public.assessment_ai_outputs from anon, authenticated;
revoke all on public.assessment_development_plans from anon, authenticated;
revoke all on public.assessment_development_private_notes from anon, authenticated;

alter table public.assessment_attempts enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_ai_outputs enable row level security;
alter table public.assessment_development_plans enable row level security;
alter table public.assessment_development_private_notes enable row level security;

comment on table public.assessment_attempts is
  'Versioned RISE behavioral assessment attempts. Accessed only by authenticated server functions.';
comment on column public.assessment_attempts.calculated_result is
  'Immutable deterministic result for the assessment and scoring versions recorded on this row.';
comment on table public.assessment_ai_outputs is
  'Reserved contract storage for future AI interpretation; never used for scoring.';

-- Bind the already-existing journey step to the native module without changing
-- its stable key or destroying legacy external-form history.
update public.journey_steps
set resource_type = 'rise_assessment'
where format in ('questionnaire', 'form')
  and (title ilike '%perfil comportamental%' or title ilike '%mapeamento comportamental%');
