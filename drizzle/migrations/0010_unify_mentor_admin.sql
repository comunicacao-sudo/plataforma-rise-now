-- Mentors and administrators now share one administrative access level.
-- Keep the legacy enum value for backwards compatibility, but normalize all
-- existing and future managed accounts to `admin`.

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role
FROM public.user_roles
WHERE role = 'mentor'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles WHERE role = 'mentor';

UPDATE public.allowed_emails
SET role = 'admin'
WHERE role = 'mentor';

-- During a rolling deployment, a legacy mentor record must already receive
-- full administrative privileges before the normalization above is applied.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'mentor')
  )
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true for the unified mentor/administrator access level.';
