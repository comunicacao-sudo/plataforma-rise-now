-- Keep active enrollments on the latest published journey version.
-- Progress is preserved because it is keyed by the stable step identity.
insert into public.enrollment_journey_versions (
  enrollment_id,
  pillar_id,
  version_id,
  assigned_at
)
select
  enrollment.id,
  pillar.id,
  pillar.current_published_version_id,
  now()
from public.enrollments enrollment
join public.journey_pillars pillar on pillar.program_id = enrollment.program_id
where coalesce(enrollment.status, 'ativa') = 'ativa'
  and pillar.current_published_version_id is not null
on conflict (enrollment_id, pillar_id) do update
set
  version_id = excluded.version_id,
  assigned_at = excluded.assigned_at;
