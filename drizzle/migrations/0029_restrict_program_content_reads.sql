-- Restrict program content to staff or the mentee enrolled in that program.
DROP POLICY IF EXISTS "read programs" ON public.programs;
CREATE POLICY "read programs" ON public.programs
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.program_id = programs.id
        AND e.mentee_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "read phases" ON public.phases;
CREATE POLICY "read phases" ON public.phases
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.program_id = phases.program_id
        AND e.mentee_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "read lessons" ON public.lessons;
CREATE POLICY "read lessons" ON public.lessons
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.phases p
      JOIN public.enrollments e ON e.program_id = p.program_id
      WHERE p.id = lessons.phase_id
        AND e.mentee_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "read deliverables" ON public.deliverables;
CREATE POLICY "read deliverables" ON public.deliverables
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.phases p
      JOIN public.enrollments e ON e.program_id = p.program_id
      WHERE p.id = deliverables.phase_id
        AND e.mentee_id = (SELECT auth.uid())
    )
  );
