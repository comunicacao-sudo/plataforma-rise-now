CREATE TABLE public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohorts TO authenticated;
GRANT ALL ON public.cohorts TO service_role;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','desativada'));
GRANT INSERT ON public.enrollments TO authenticated;
CREATE POLICY "admins insert enrollments" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "admins manage cohorts" ON public.cohorts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "staff and members read cohorts" ON public.cohorts FOR SELECT TO authenticated USING (
  public.is_admin() OR public.has_role(auth.uid(),'mentor')
  OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.cohort_id = cohorts.id AND e.mentee_id = auth.uid())
);

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','cohort','selected')),
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentor_name text,
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.phases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE public.meeting_attendees (
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, enrollment_id)
);
GRANT SELECT, INSERT, DELETE ON public.meeting_attendees TO authenticated;
GRANT ALL ON public.meeting_attendees TO service_role;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'mentor')
$$;

CREATE OR REPLACE FUNCTION public.can_see_meeting(_meeting_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.meetings m where m.id = _meeting_id and (
      public.is_staff()
      or m.audience = 'all'
      or (m.audience = 'cohort' and exists (select 1 from public.enrollments e where e.cohort_id = m.cohort_id and e.mentee_id = auth.uid() and e.status = 'ativa'))
      or (m.enrollment_id is not null and public.can_access_enrollment(m.enrollment_id))
      or exists (select 1 from public.meeting_attendees a join public.enrollments e on e.id = a.enrollment_id where a.meeting_id = m.id and e.mentee_id = auth.uid())
    )
  )
$$;

DROP POLICY IF EXISTS "read meetings" ON public.meetings;
DROP POLICY IF EXISTS "mentors manage meetings" ON public.meetings;
CREATE POLICY "read meetings" ON public.meetings FOR SELECT TO authenticated USING (public.can_see_meeting(id));
CREATE POLICY "staff create meetings" ON public.meetings FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND created_by = auth.uid());
CREATE POLICY "staff update meetings" ON public.meetings FOR UPDATE TO authenticated USING (public.is_admin() OR created_by = auth.uid() OR mentor_id = auth.uid()) WITH CHECK (public.is_staff());
CREATE POLICY "staff delete meetings" ON public.meetings FOR DELETE TO authenticated USING (public.is_admin() OR created_by = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;

CREATE POLICY "read attendees" ON public.meeting_attendees FOR SELECT TO authenticated USING (public.is_staff() OR public.can_access_enrollment(enrollment_id));
CREATE POLICY "staff write attendees" ON public.meeting_attendees FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "staff delete attendees" ON public.meeting_attendees FOR DELETE TO authenticated USING (public.is_staff());

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_submission_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare reviewer boolean;
begin
  select public.is_admin() or exists (select 1 from public.enrollments e where e.id = new.enrollment_id and e.mentor_id = auth.uid()) into reviewer;
  if not reviewer then
    if tg_op = 'UPDATE' then
      new.feedback := old.feedback; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
      if old.status in ('em_revisao','concluida') and new.status <> old.status then new.status := old.status; end if;
    else
      new.feedback := null; new.reviewed_by := null; new.reviewed_at := null;
    end if;
    if new.status not in ('nao_iniciada','em_andamento','enviada') and (tg_op = 'INSERT' or new.status <> old.status) then
      raise exception 'status not allowed';
    end if;
    if new.status = 'enviada' and (tg_op = 'INSERT' or old.status <> 'enviada') then new.submitted_at := now(); end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
REVOKE ALL ON FUNCTION public.guard_submission_review() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS submissions_guard ON public.submissions;
CREATE TRIGGER submissions_guard BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.guard_submission_review();

CREATE POLICY "reviewers insert submissions" ON public.submissions FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.mentor_id = auth.uid()));

CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cohorts (name, starts_on, ends_on) VALUES ('Turma 1 — 2026', '2026-10-01', '2027-03-31');
UPDATE public.enrollments SET cohort_id = (SELECT id FROM public.cohorts WHERE name = 'Turma 1 — 2026' LIMIT 1) WHERE cohort_id IS NULL;