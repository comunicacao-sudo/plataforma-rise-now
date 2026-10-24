ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mentor_summary text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_mentor_summary_length_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_mentor_summary_length_check
  CHECK (
    mentor_summary IS NULL
    OR char_length(btrim(mentor_summary)) BETWEEN 1 AND 600
  );

GRANT UPDATE (mentor_summary) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_mentor_summary_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Somente a equipe RISE pode editar a apresentação profissional.';
  END IF;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_mentor_summary_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_mentor_summary_update() TO service_role;

DROP TRIGGER IF EXISTS profiles_guard_mentor_summary ON public.profiles;
CREATE TRIGGER profiles_guard_mentor_summary
BEFORE UPDATE OF mentor_summary ON public.profiles
FOR EACH ROW
WHEN (new.mentor_summary IS DISTINCT FROM old.mentor_summary)
EXECUTE FUNCTION public.guard_mentor_summary_update();

-- These two tables are intentionally accessed only through the authenticated
-- RISE Edge Function. Keep direct browser access denied and auditable.
CREATE POLICY "backend only: journey stage contents"
ON public.journey_stage_contents
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "backend only: journey stage questionnaire responses"
ON public.journey_stage_questionnaire_responses
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
