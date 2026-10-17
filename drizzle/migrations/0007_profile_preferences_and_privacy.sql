ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS profession_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'dark';

UPDATE public.profiles
SET display_name = full_name
WHERE display_name IS NULL OR btrim(display_name) = '';

-- Keep future profiles initialized with a public display name while retaining
-- the legal/full name as a separate private field.
CREATE OR REPLACE FUNCTION public.claim_approved_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  approved_invite public.allowed_emails%rowtype;
  profile_name text;
BEGIN
  SELECT *
    INTO approved_invite
    FROM public.allowed_emails
   WHERE lower(email) = lower(new.email)
     AND status = 'approved'
   LIMIT 1;

  IF approved_invite.id IS NULL THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'RISE_ACCESS_NOT_APPROVED';
  END IF;

  profile_name := COALESCE(
    NULLIF(approved_invite.full_name, ''),
    NULLIF(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, display_name, full_name, claimed)
  VALUES (new.id, lower(new.email), profile_name, profile_name, true)
  ON CONFLICT (email) DO UPDATE
    SET id = excluded.id,
        display_name = COALESCE(NULLIF(profiles.display_name, ''), excluded.display_name),
        full_name = excluded.full_name,
        claimed = true;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, approved_invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_approved_invitation() FROM PUBLIC, anon, authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name,
  full_name,
  title,
  avatar_url,
  phone,
  contact_email,
  profession,
  profession_visible,
  theme_preference
) ON public.profiles TO authenticated;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_preference_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IN ('dark', 'light'));

-- Private profile fields (full name, email and phone) are readable only by
-- their owner and administrators. Other staff views use the restricted RPC
-- below and never receive those columns.
DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "private profile read" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.mentee_public_profile(_enrollment_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  profession text,
  profession_visible boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id,
    COALESCE(NULLIF(btrim(p.display_name), ''), p.full_name),
    p.avatar_url,
    CASE WHEN p.profession_visible THEN p.profession ELSE NULL END,
    p.profession_visible
  FROM public.enrollments e
  JOIN public.profiles p ON p.id = e.mentee_id
  WHERE e.id = _enrollment_id
    AND (
      auth.uid() = e.mentee_id
      OR auth.uid() = e.mentor_id
      OR public.is_admin()
    )
$$;

REVOKE EXECUTE ON FUNCTION public.mentee_public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mentee_public_profile(uuid) TO authenticated;
