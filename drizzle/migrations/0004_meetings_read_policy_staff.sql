DROP POLICY IF EXISTS "read meetings" ON public.meetings;
CREATE POLICY "read meetings" ON public.meetings FOR SELECT TO authenticated USING (
  public.is_staff()
  OR audience = 'all'
  OR (audience = 'cohort' AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.cohort_id = meetings.cohort_id AND e.mentee_id = auth.uid() AND e.status = 'ativa'))
  OR (enrollment_id IS NOT NULL AND public.can_access_enrollment(enrollment_id))
  OR public.can_see_meeting(id)
);