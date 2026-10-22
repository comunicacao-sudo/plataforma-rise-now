-- Separate journey structure from stage content.
-- Journey remains responsible for stage structure/order/cards.
-- This table stores lessons, materials and questionnaires with their own audience.

create table if not exists public.journey_stage_contents (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references public.journey_pillars(id) on delete cascade,
  step_key uuid not null,
  content_type text not null check (content_type in ('video','material','questionnaire')),
  title text not null,
  description text not null default '',
  duration_minutes integer,
  media_path text,
  file_path text,
  external_url text,
  questionnaire jsonb not null default '{"questions":[]}'::jsonb,
  access_scope text not null default 'general'
    check (access_scope in ('general','cohort','mentee')),
  cohort_id uuid references public.cohorts(id) on delete cascade,
  mentee_id uuid references public.profiles(id) on delete cascade,
  position integer not null default 0,
  active boolean not null default true,
  legacy_key text unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (access_scope='general' and cohort_id is null and mentee_id is null)
    or (access_scope='cohort' and cohort_id is not null and mentee_id is null)
    or (access_scope='mentee' and mentee_id is not null and cohort_id is null)
  )
);

create index if not exists journey_stage_contents_stage_idx
  on public.journey_stage_contents(pillar_id, step_key, position);
create index if not exists journey_stage_contents_audience_idx
  on public.journey_stage_contents(access_scope, cohort_id, mentee_id);

alter table public.journey_stage_contents enable row level security;
revoke all on public.journey_stage_contents from anon, authenticated;

create table if not exists public.journey_stage_questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.journey_stage_contents(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  user_id uuid not null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(content_id, enrollment_id)
);

create index if not exists journey_stage_questionnaire_responses_user_idx
  on public.journey_stage_questionnaire_responses(user_id, content_id);

alter table public.journey_stage_questionnaire_responses enable row level security;
revoke all on public.journey_stage_questionnaire_responses from anon, authenticated;

-- Preserve existing stage videos.
with draft_steps as (
  select p.id as pillar_id, s.*
  from public.journey_pillars p
  join public.journey_versions v on v.pillar_id=p.id and v.status='draft'
  join public.journey_steps s on s.version_id=v.id and s.archived_at is null
)
insert into public.journey_stage_contents (
  pillar_id, step_key, content_type, title, description, duration_minutes,
  media_path, external_url, access_scope, cohort_id, mentee_id, position,
  legacy_key, created_at, updated_at
)
select
  pillar_id, stable_key, 'video', title, coalesce(description,''), duration_minutes,
  media_path,
  case when media_path is null then resource_url else null end,
  access_scope, cohort_id, mentee_id, 10,
  'legacy:'||stable_key::text||':video', now(), now()
from draft_steps
where format in ('recorded_class','collective_recording','cohort_onboarding','individual_1_1')
  and (media_path is not null or resource_url is not null)
on conflict (legacy_key) do nothing;

-- Preserve existing support materials.
with draft_steps as (
  select p.id as pillar_id, s.*
  from public.journey_pillars p
  join public.journey_versions v on v.pillar_id=p.id and v.status='draft'
  join public.journey_steps s on s.version_id=v.id and s.archived_at is null
),
material_rows as (
  select
    d.pillar_id, d.stable_key, d.access_scope, d.cohort_id, d.mentee_id,
    m.value as material, m.ordinality
  from draft_steps d
  cross join lateral jsonb_array_elements(coalesce(d.materials,'[]'::jsonb))
    with ordinality as m(value, ordinality)
)
insert into public.journey_stage_contents (
  pillar_id, step_key, content_type, title, file_path, external_url,
  access_scope, cohort_id, mentee_id, position, legacy_key, created_at, updated_at
)
select
  pillar_id, stable_key, 'material',
  coalesce(nullif(material->>'title',''),'Material de apoio'),
  nullif(material->>'filePath',''),
  nullif(material->>'url',''),
  access_scope, cohort_id, mentee_id,
  100 + ordinality::int,
  'legacy:'||stable_key::text||':material:'||
    coalesce(nullif(material->>'id',''),ordinality::text),
  now(), now()
from material_rows
where nullif(material->>'filePath','') is not null
   or nullif(material->>'url','') is not null
on conflict (legacy_key) do nothing;

-- Preserve existing external questionnaires.
with draft_steps as (
  select p.id as pillar_id, s.*
  from public.journey_pillars p
  join public.journey_versions v on v.pillar_id=p.id and v.status='draft'
  join public.journey_steps s on s.version_id=v.id and s.archived_at is null
)
insert into public.journey_stage_contents (
  pillar_id, step_key, content_type, title, description, external_url,
  access_scope, cohort_id, mentee_id, position, legacy_key, created_at, updated_at
)
select
  pillar_id, stable_key, 'questionnaire', title, coalesce(description,''), resource_url,
  access_scope, cohort_id, mentee_id, 200,
  'legacy:'||stable_key::text||':questionnaire', now(), now()
from draft_steps
where format in ('questionnaire','form') and resource_url is not null
on conflict (legacy_key) do nothing;

-- Resolve the private R2 video for the authenticated viewer.
create or replace function public.get_journey_media_path(_step_key uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_path text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if public.is_admin() then
    select coalesce(c.media_path, s.media_path)
      into v_path
    from public.journey_steps s
    join public.journey_versions v on v.id = s.version_id
    left join lateral (
      select sc.media_path
      from public.journey_stage_contents sc
      where sc.step_key = s.stable_key
        and sc.content_type = 'video'
        and sc.active = true
        and sc.media_path is not null
      order by
        case sc.access_scope when 'mentee' then 3 when 'cohort' then 2 else 1 end desc,
        sc.position,
        sc.created_at
      limit 1
    ) c on true
    where s.stable_key = _step_key
      and s.archived_at is null
      and (c.media_path is not null or s.media_path is not null)
    order by
      case v.status when 'published' then 0 when 'draft' then 1 else 2 end,
      v.updated_at desc
    limit 1;
    return v_path;
  end if;

  select coalesce(c.media_path, s.media_path)
    into v_path
  from public.enrollments e
  join public.journey_pillars p on p.program_id = e.program_id
  left join public.enrollment_journey_versions ejv
    on ejv.enrollment_id = e.id and ejv.pillar_id = p.id
  join public.journey_versions v
    on v.id = coalesce(ejv.version_id, p.current_published_version_id)
    and v.status in ('published', 'archived')
  join public.journey_steps s on s.version_id = v.id
  left join lateral (
    select sc.media_path
    from public.journey_stage_contents sc
    where sc.pillar_id = p.id
      and sc.step_key = s.stable_key
      and sc.content_type = 'video'
      and sc.active = true
      and sc.media_path is not null
      and (
        sc.access_scope = 'general'
        or (sc.access_scope = 'cohort' and sc.cohort_id = e.cohort_id)
        or (sc.access_scope = 'mentee' and sc.mentee_id = e.mentee_id)
      )
    order by
      case sc.access_scope when 'mentee' then 3 when 'cohort' then 2 else 1 end desc,
      sc.position,
      sc.created_at
    limit 1
  ) c on true
  where e.mentee_id = auth.uid()
    and coalesce(e.status, 'ativa') <> 'desativada'
    and s.stable_key = _step_key
    and s.archived_at is null
    and s.month_number <= e.current_month
    and (s.release_at is null or s.release_at <= now())
    and (
      s.access_scope = 'general'
      or (s.access_scope = 'cohort' and s.cohort_id = e.cohort_id)
      or (s.access_scope = 'mentee' and s.mentee_id = e.mentee_id)
    )
    and (c.media_path is not null or s.media_path is not null)
  limit 1;

  return v_path;
end
$function$;

revoke all on function public.get_journey_media_path(uuid) from public;
revoke all on function public.get_journey_media_path(uuid) from anon;
grant execute on function public.get_journey_media_path(uuid) to authenticated;
