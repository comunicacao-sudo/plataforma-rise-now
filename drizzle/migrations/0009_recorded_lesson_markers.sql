-- Private timestamped reflections for recorded lessons.
-- The existing `notes` table remains the source of truth for the lesson notebook.

CREATE TABLE IF NOT EXISTS public.lesson_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  timestamp_seconds integer NOT NULL CHECK (timestamp_seconds >= 0),
  reflection text NOT NULL CHECK (length(trim(reflection)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_markers_user_lesson_time_idx
  ON public.lesson_markers(user_id, lesson_id, timestamp_seconds);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_markers TO authenticated;
GRANT ALL ON public.lesson_markers TO service_role;

ALTER TABLE public.lesson_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentee reads own lesson markers" ON public.lesson_markers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_enrollment_mentee(enrollment_id)
  );

CREATE POLICY "mentee creates own lesson markers" ON public.lesson_markers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_enrollment_mentee(enrollment_id)
    AND EXISTS (
      SELECT 1
      FROM public.lessons lesson
      JOIN public.phases phase ON phase.id = lesson.phase_id
      JOIN public.enrollments enrollment ON enrollment.id = public.lesson_markers.enrollment_id
      WHERE lesson.id = public.lesson_markers.lesson_id
        AND phase.program_id = enrollment.program_id
    )
  );

CREATE POLICY "mentee updates own lesson markers" ON public.lesson_markers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id))
  WITH CHECK (user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id));

CREATE POLICY "mentee deletes own lesson markers" ON public.lesson_markers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id));
