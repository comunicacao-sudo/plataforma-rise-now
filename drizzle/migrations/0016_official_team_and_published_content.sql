-- Keep the official RISE team visible and authorized without deleting profile
-- history, notes, reviews or past audit records.
INSERT INTO public.allowed_emails (email, full_name, role, status)
VALUES
  ('camilaum@pamarisdigital.com', 'Camila Um', 'admin', 'approved'),
  ('gabi@pamarisdigital.com', 'Gabriela Ribeiro', 'admin', 'approved'),
  ('ana@pamarisdigital.com', 'Ana Luiza', 'admin', 'approved'),
  ('camila@pamarisdigital.com', 'Camila Mariano', 'admin', 'approved')
ON CONFLICT (email) DO UPDATE
SET full_name = excluded.full_name,
    role = 'admin',
    status = 'approved';

INSERT INTO public.profiles (email, full_name, display_name, claimed)
VALUES
  ('camilaum@pamarisdigital.com', 'Camila Um', 'Camila Um', false),
  ('gabi@pamarisdigital.com', 'Gabriela Ribeiro', 'Gabriela Ribeiro', false),
  ('ana@pamarisdigital.com', 'Ana Luiza', 'Ana Luiza', false),
  ('camila@pamarisdigital.com', 'Camila Mariano', 'Camila Mariano', false)
ON CONFLICT (email) DO UPDATE
SET full_name = excluded.full_name,
    display_name = excluded.display_name;

UPDATE public.profiles p
SET staff_type = 'mentor',
    primary_specialty_id = s.id,
    pillar = official.specialty,
    title = 'Mentora de ' || official.specialty
FROM (
  VALUES
    ('camilaum@pamarisdigital.com', 'Reflexão'),
    ('gabi@pamarisdigital.com', 'Identidade'),
    ('ana@pamarisdigital.com', 'Segurança'),
    ('camila@pamarisdigital.com', 'Evolução')
) AS official(email, specialty)
JOIN public.mentor_specialties s ON s.name = official.specialty
WHERE lower(p.email) = official.email;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(p.email) IN (
  'camilaum@pamarisdigital.com',
  'gabi@pamarisdigital.com',
  'ana@pamarisdigital.com',
  'camila@pamarisdigital.com'
)
AND p.claimed
ON CONFLICT (user_id, role) DO NOTHING;

-- Preserve relationships by moving active mentor assignments from duplicate
-- profiles to the matching official profile before access is revoked.
WITH replacements AS (
  SELECT old_profile.id AS old_id, official_profile.id AS new_id
  FROM public.profiles old_profile
  JOIN public.profiles official_profile
    ON lower(official_profile.email) = CASE lower(old_profile.email)
      WHEN 'analuiza3727@icloud.com' THEN 'ana@pamarisdigital.com'
      WHEN 'camila@pamaris.com.br' THEN 'camila@pamarisdigital.com'
      WHEN 'gabriela.ribeirogrs250104@gmail.com' THEN 'gabi@pamarisdigital.com'
      ELSE NULL
    END
   AND official_profile.claimed
)
UPDATE public.enrollments e
SET mentor_id = r.new_id
FROM replacements r
WHERE e.mentor_id = r.old_id;

WITH replacements AS (
  SELECT old_profile.id AS old_id, official_profile.id AS new_id
  FROM public.profiles old_profile
  JOIN public.profiles official_profile
    ON lower(official_profile.email) = CASE lower(old_profile.email)
      WHEN 'analuiza3727@icloud.com' THEN 'ana@pamarisdigital.com'
      WHEN 'camila@pamaris.com.br' THEN 'camila@pamarisdigital.com'
      WHEN 'gabriela.ribeirogrs250104@gmail.com' THEN 'gabi@pamarisdigital.com'
      ELSE NULL
    END
   AND official_profile.claimed
)
UPDATE public.journey_pillars p
SET mentor_id = r.new_id
FROM replacements r
WHERE p.mentor_id = r.old_id;

WITH replacements AS (
  SELECT old_profile.id AS old_id, official_profile.id AS new_id
  FROM public.profiles old_profile
  JOIN public.profiles official_profile
    ON lower(official_profile.email) = CASE lower(old_profile.email)
      WHEN 'analuiza3727@icloud.com' THEN 'ana@pamarisdigital.com'
      WHEN 'camila@pamaris.com.br' THEN 'camila@pamarisdigital.com'
      WHEN 'gabriela.ribeirogrs250104@gmail.com' THEN 'gabi@pamarisdigital.com'
      ELSE NULL
    END
   AND official_profile.claimed
)
UPDATE public.meetings m
SET mentor_id = r.new_id
FROM replacements r
WHERE m.mentor_id = r.old_id;

UPDATE public.profiles p
SET staff_type = NULL,
    primary_specialty_id = NULL,
    pillar = NULL
WHERE lower(p.email) NOT IN (
  'camilaum@pamarisdigital.com',
  'gabi@pamarisdigital.com',
  'ana@pamarisdigital.com',
  'camila@pamarisdigital.com'
)
AND EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = p.id AND r.role IN ('admin', 'mentor')
);

DELETE FROM public.user_roles r
USING public.profiles p
WHERE r.user_id = p.id
  AND r.role IN ('admin', 'mentor')
  AND lower(p.email) NOT IN (
    'camilaum@pamarisdigital.com',
    'gabi@pamarisdigital.com',
    'ana@pamarisdigital.com',
    'camila@pamarisdigital.com'
  );

UPDATE public.allowed_emails
SET status = 'revoked'
WHERE role IN ('admin', 'mentor')
  AND lower(email) NOT IN (
    'camilaum@pamarisdigital.com',
    'gabi@pamarisdigital.com',
    'ana@pamarisdigital.com',
    'camila@pamarisdigital.com'
  );

CREATE OR REPLACE FUNCTION public.reassign_official_mentor_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  source_email text;
BEGIN
  IF NOT new.claimed THEN
    RETURN new;
  END IF;

  source_email := CASE lower(new.email)
    WHEN 'ana@pamarisdigital.com' THEN 'analuiza3727@icloud.com'
    WHEN 'camila@pamarisdigital.com' THEN 'camila@pamaris.com.br'
    WHEN 'gabi@pamarisdigital.com' THEN 'gabriela.ribeirogrs250104@gmail.com'
    ELSE NULL
  END;

  IF source_email IS NULL THEN
    RETURN new;
  END IF;

  UPDATE public.enrollments
  SET mentor_id = new.id
  WHERE mentor_id IN (SELECT id FROM public.profiles WHERE lower(email) = source_email);

  UPDATE public.journey_pillars
  SET mentor_id = new.id
  WHERE mentor_id IN (SELECT id FROM public.profiles WHERE lower(email) = source_email);

  UPDATE public.meetings
  SET mentor_id = new.id
  WHERE mentor_id IN (SELECT id FROM public.profiles WHERE lower(email) = source_email);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_official_mentor_claimed ON public.profiles;
CREATE TRIGGER on_official_mentor_claimed
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
WHEN (new.claimed)
EXECUTE FUNCTION public.reassign_official_mentor_links();

-- Normalize the official mentor name across legacy and editable content.
UPDATE public.phases SET mentor_name = 'Ana Luiza' WHERE mentor_name = 'Luiza Mendes';
UPDATE public.lessons SET mentor_name = 'Ana Luiza' WHERE mentor_name = 'Luiza Mendes';
UPDATE public.meetings SET mentor_name = 'Ana Luiza' WHERE mentor_name = 'Luiza Mendes';
UPDATE public.journey_steps SET responsible_name = 'Ana Luiza' WHERE responsible_name = 'Luiza Mendes';

-- Remove visible long dash punctuation from persisted copy.
UPDATE public.cohorts SET name = replace(replace(name, ' — ', ', '), '–', ',');
UPDATE public.phases SET
  title = replace(replace(title, ' — ', ', '), '–', ','),
  description = replace(replace(description, ' — ', ', '), '–', ','),
  question = replace(replace(question, ' — ', ', '), '–', ',');
UPDATE public.lessons SET
  title = replace(replace(title, ' — ', ', '), '–', ','),
  subtitle = replace(replace(subtitle, ' — ', ', '), '–', ','),
  description = replace(replace(description, ' — ', ', '), '–', ',');
UPDATE public.deliverables SET
  title = replace(replace(title, ' — ', ' '), '–', ' '),
  description = replace(replace(description, ' — ', ', '), '–', ',');
UPDATE public.journey_steps SET
  title = replace(replace(title, ' — ', ', '), '–', ','),
  impact_lead = replace(replace(impact_lead, ' — ', ', '), '–', ','),
  impact_highlight = replace(replace(impact_highlight, ' — ', ', '), '–', ','),
  impact_tail = replace(replace(impact_tail, ' — ', ', '), '–', ','),
  description = replace(replace(description, ' — ', ', '), '–', ','),
  summary = replace(replace(summary, ' — ', ', '), '–', ',');

UPDATE public.journey_steps
SET impact_highlight = title
WHERE btrim(coalesce(impact_lead, '') || coalesce(impact_highlight, '') || coalesce(impact_tail, '')) = '';

UPDATE public.journey_steps
SET description = coalesce(nullif(btrim(summary), ''), title)
WHERE btrim(coalesce(description, '')) = '';

-- Publish every valid current draft and immediately create its next editable
-- copy. Existing active enrollments receive the newly published content.
DO $$
DECLARE
  pillar_row record;
  draft_row public.journey_versions%ROWTYPE;
  new_draft_id uuid;
  next_version integer;
BEGIN
  FOR pillar_row IN SELECT id, program_id FROM public.journey_pillars LOOP
    SELECT * INTO draft_row
    FROM public.journey_versions
    WHERE pillar_id = pillar_row.id AND status = 'draft'
    FOR UPDATE;

    IF draft_row.id IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.journey_steps WHERE version_id = draft_row.id
    ) OR EXISTS (
      SELECT 1 FROM public.journey_steps
      WHERE version_id = draft_row.id
        AND (
          btrim(coalesce(title, '')) = ''
          OR btrim(coalesce(impact_lead, '') || coalesce(impact_highlight, '') || coalesce(impact_tail, '')) = ''
          OR btrim(coalesce(description, '')) = ''
        )
    ) OR EXISTS (
      SELECT 1 FROM public.journey_steps
      WHERE version_id = draft_row.id
        AND ((access_scope = 'cohort' AND cohort_id IS NULL)
          OR (access_scope = 'mentee' AND mentee_id IS NULL))
    ) THEN
      CONTINUE;
    END IF;

    SELECT coalesce(max(version_number), 0) + 1 INTO next_version
    FROM public.journey_versions
    WHERE pillar_id = pillar_row.id AND status IN ('published', 'archived');

    UPDATE public.journey_versions
    SET status = 'archived'
    WHERE pillar_id = pillar_row.id AND status = 'published';

    UPDATE public.journey_versions
    SET status = 'published',
        version_number = next_version,
        published_at = now(),
        updated_at = now()
    WHERE id = draft_row.id;

    UPDATE public.journey_pillars
    SET current_published_version_id = draft_row.id,
        updated_at = now()
    WHERE id = pillar_row.id;

    INSERT INTO public.enrollment_journey_versions (enrollment_id, pillar_id, version_id)
    SELECT e.id, pillar_row.id, draft_row.id
    FROM public.enrollments e
    WHERE e.program_id = pillar_row.program_id
      AND coalesce(e.status, 'ativa') = 'ativa'
    ON CONFLICT (enrollment_id, pillar_id) DO UPDATE
    SET version_id = excluded.version_id,
        assigned_at = now();

    INSERT INTO public.journey_versions (pillar_id, status, version_number, revision, created_by)
    VALUES (pillar_row.id, 'draft', 0, 1, draft_row.created_by)
    RETURNING id INTO new_draft_id;

    INSERT INTO public.journey_steps (
      version_id, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
      description, responsible_name, duration_minutes, resource_type, resource_id,
      resource_url, scheduled_at, release_at, completion_rule, required, position,
      month_number, cover_path, media_path, summary, topics, materials, access_scope,
      cohort_id, mentee_id
    )
    SELECT
      new_draft_id, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
      description, responsible_name, duration_minutes, resource_type, resource_id,
      resource_url, scheduled_at, release_at, completion_rule, required, position,
      month_number, cover_path, media_path, summary, topics, materials, access_scope,
      cohort_id, mentee_id
    FROM public.journey_steps
    WHERE version_id = draft_row.id
    ORDER BY position;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.staff_directory();

CREATE FUNCTION public.staff_directory()
RETURNS TABLE (
  id uuid,
  full_name text,
  title text,
  avatar_url text,
  phone text,
  contact_email text,
  is_admin boolean,
  staff_type text,
  specialty text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id,
    p.full_name,
    p.title,
    p.avatar_url,
    p.phone,
    p.contact_email,
    public.has_role(p.id, 'admin'),
    p.staff_type,
    COALESCE(s.name, p.pillar)
  FROM public.profiles p
  LEFT JOIN public.mentor_specialties s ON s.id = p.primary_specialty_id
  WHERE auth.uid() IS NOT NULL
    AND lower(p.email) IN (
      'camilaum@pamarisdigital.com',
      'gabi@pamarisdigital.com',
      'ana@pamarisdigital.com',
      'camila@pamarisdigital.com'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = p.id AND r.role = 'admin'
    )
  ORDER BY CASE lower(p.email)
    WHEN 'camilaum@pamarisdigital.com' THEN 1
    WHEN 'gabi@pamarisdigital.com' THEN 2
    WHEN 'ana@pamarisdigital.com' THEN 3
    ELSE 4
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_directory() TO authenticated;
