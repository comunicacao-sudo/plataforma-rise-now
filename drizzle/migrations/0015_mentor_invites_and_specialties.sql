CREATE TABLE IF NOT EXISTS public.mentor_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'subject' CHECK (category IN ('pillar', 'subject')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mentor_specialties_name_key
  ON public.mentor_specialties (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_specialties TO authenticated;
GRANT ALL ON public.mentor_specialties TO service_role;
ALTER TABLE public.mentor_specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read mentor specialties" ON public.mentor_specialties;
CREATE POLICY "authenticated read mentor specialties"
  ON public.mentor_specialties FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admins manage mentor specialties" ON public.mentor_specialties;
CREATE POLICY "admins manage mentor specialties"
  ON public.mentor_specialties FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.mentor_specialties (name, category)
VALUES
  ('Reflexão', 'pillar'),
  ('Identidade', 'pillar'),
  ('Segurança', 'pillar'),
  ('Evolução', 'pillar')
ON CONFLICT DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_type text,
  ADD COLUMN IF NOT EXISTS primary_specialty_id uuid REFERENCES public.mentor_specialties(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_staff_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_staff_type_check
  CHECK (staff_type IS NULL OR staff_type = 'mentor');

-- Prepare the four official mentor addresses without deleting or merging any
-- existing account. Authentication users are still created only when an
-- administrator explicitly sends an invitation from the platform.
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

UPDATE public.profiles p
SET staff_type = 'mentor',
    primary_specialty_id = s.id,
    pillar = s.name,
    title = 'Mentora de ' || s.name
FROM public.mentor_specialties s
WHERE (lower(p.email), s.name) IN (
  ('camilaum@pamarisdigital.com', 'Reflexão'),
  ('gabi@pamarisdigital.com', 'Identidade'),
  ('ana@pamarisdigital.com', 'Segurança'),
  ('camila@pamarisdigital.com', 'Evolução')
);

CREATE OR REPLACE FUNCTION public.staff_directory()
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
    AND EXISTS (
      SELECT 1
      FROM public.user_roles r
      WHERE r.user_id = p.id
        AND r.role IN ('admin', 'mentor')
    )
  ORDER BY p.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_directory() TO authenticated;
