ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS mentor_name text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS join_url text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS session_format text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS topics text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS mentor_name text;
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS question text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS file_path text;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_enrollment_deliverable_uidx ON public.submissions(enrollment_id, deliverable_id);
CREATE UNIQUE INDEX IF NOT EXISTS lesson_progress_enrollment_lesson_uidx ON public.lesson_progress(enrollment_id, lesson_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes, public.submissions, public.lesson_progress TO authenticated;
GRANT SELECT ON public.programs, public.phases, public.lessons, public.deliverables, public.enrollments TO authenticated;

CREATE OR REPLACE FUNCTION public.recalc_enrollment_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare total int; done int; pid uuid;
begin
  select program_id into pid from public.enrollments where id = new.enrollment_id;
  select count(*) into total from public.lessons l join public.phases p on p.id = l.phase_id where p.program_id = pid;
  select count(*) into done from public.lesson_progress where enrollment_id = new.enrollment_id and completed;
  update public.enrollments set progress_pct = case when total = 0 then 0 else round(done * 100.0 / total) end
   where id = new.enrollment_id;
  return new;
end; $$;
REVOKE ALL ON FUNCTION public.recalc_enrollment_progress() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS lesson_progress_recalc ON public.lesson_progress;
CREATE TRIGGER lesson_progress_recalc AFTER INSERT OR UPDATE ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.recalc_enrollment_progress();