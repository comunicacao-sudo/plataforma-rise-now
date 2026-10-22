-- Keep the staff directory tied to the four official profiles without modifying them.
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      'gabriela@pamarisdigital.com',
      'ana@pamarisdigital.com',
      'camila@pamarisdigital.com'
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles r
      WHERE r.user_id = p.id AND r.role = 'admin'
    )
  ORDER BY CASE lower(p.email)
    WHEN 'camilaum@pamarisdigital.com' THEN 1
    WHEN 'gabriela@pamarisdigital.com' THEN 2
    WHEN 'ana@pamarisdigital.com' THEN 3
    ELSE 4
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_directory() TO authenticated, service_role;

