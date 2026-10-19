-- Cover the remaining foreign keys reported by the Supabase database advisor.

CREATE INDEX IF NOT EXISTS enrollment_journey_versions_pillar_id_idx
  ON public.enrollment_journey_versions(pillar_id);
CREATE INDEX IF NOT EXISTS enrollments_program_id_idx
  ON public.enrollments(program_id);
CREATE INDEX IF NOT EXISTS journey_steps_cohort_id_idx
  ON public.journey_steps(cohort_id);
CREATE INDEX IF NOT EXISTS journey_steps_mentee_id_idx
  ON public.journey_steps(mentee_id);
CREATE INDEX IF NOT EXISTS lesson_markers_lesson_id_idx
  ON public.lesson_markers(lesson_id);
CREATE INDEX IF NOT EXISTS lesson_progress_lesson_id_idx
  ON public.lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS meeting_attendees_enrollment_id_idx
  ON public.meeting_attendees(enrollment_id);
CREATE INDEX IF NOT EXISTS submissions_deliverable_id_idx
  ON public.submissions(deliverable_id);
