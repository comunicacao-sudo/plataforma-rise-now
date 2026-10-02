ALTER TABLE public.rise90_goals
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS progress_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE TABLE public.rise90_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.rise90_goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rise90_milestones TO authenticated;
GRANT ALL ON public.rise90_milestones TO service_role;
ALTER TABLE public.rise90_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read milestones" ON public.rise90_milestones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rise90_goals g WHERE g.id = goal_id AND public.can_access_enrollment(g.enrollment_id)));
CREATE POLICY "mentee writes milestones" ON public.rise90_milestones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rise90_goals g WHERE g.id = goal_id AND public.is_enrollment_mentee(g.enrollment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rise90_goals g WHERE g.id = goal_id AND public.is_enrollment_mentee(g.enrollment_id)));

CREATE TABLE public.lesson_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('link','file')),
  title text NOT NULL,
  description text,
  url text,
  file_path text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lesson_id IS NOT NULL OR meeting_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_materials TO authenticated;
GRANT ALL ON public.lesson_materials TO service_role;
ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read materials" ON public.lesson_materials FOR SELECT TO authenticated
  USING (public.is_staff() OR lesson_id IS NOT NULL OR (meeting_id IS NOT NULL AND public.can_see_meeting(meeting_id)));
CREATE POLICY "staff writes materials" ON public.lesson_materials FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "materials read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'materials' AND (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.lesson_materials lm WHERE lm.file_path = storage.objects.name
      AND (lm.lesson_id IS NOT NULL OR (lm.meeting_id IS NOT NULL AND public.can_see_meeting(lm.meeting_id))))));
CREATE POLICY "materials staff insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materials' AND public.is_staff());
CREATE POLICY "materials staff delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'materials' AND public.is_staff());

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_meeting_audience(_meeting_id uuid, _type text, _title text, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare m public.meetings%rowtype;
begin
  select * into m from public.meetings where id = _meeting_id;
  if m.id is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  select distinct e.mentee_id, _type, _title, _body, 'agenda'
  from public.enrollments e
  where e.status = 'ativa' and (
    m.audience = 'all'
    or (m.audience = 'cohort' and e.cohort_id = m.cohort_id)
    or e.id = m.enrollment_id
    or exists (select 1 from public.meeting_attendees a where a.meeting_id = m.id and a.enrollment_id = e.id));
end; $$;

CREATE OR REPLACE FUNCTION public.on_meeting_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.audience in ('all','cohort') or new.enrollment_id is not null then
    perform public.notify_meeting_audience(new.id, 'meeting', 'Novo encontro: ' || new.title,
      to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'));
  end if;
  return new;
end; $$;
CREATE TRIGGER meetings_notify AFTER INSERT ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.on_meeting_created();

CREATE OR REPLACE FUNCTION public.on_attendee_added() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare m public.meetings%rowtype;
begin
  select * into m from public.meetings where id = new.meeting_id;
  insert into public.notifications (user_id, type, title, body, link)
  select e.mentee_id, 'meeting', 'Novo encontro: ' || m.title,
    to_char(m.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), 'agenda'
  from public.enrollments e where e.id = new.enrollment_id;
  return new;
end; $$;
CREATE TRIGGER meeting_attendees_notify AFTER INSERT ON public.meeting_attendees FOR EACH ROW EXECUTE FUNCTION public.on_attendee_added();

CREATE OR REPLACE FUNCTION public.on_submission_reviewed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare t text;
begin
  if new.status = old.status then return new; end if;
  if new.status = 'concluida' then t := 'Entrega aprovada';
  elsif new.status = 'em_andamento' and old.status in ('enviada','em_revisao') then t := 'Sua mentora pediu ajustes na entrega';
  else return new; end if;
  insert into public.notifications (user_id, type, title, body, link)
  select e.mentee_id, 'submission', t, d.title, 'entregas'
  from public.enrollments e, public.deliverables d
  where e.id = new.enrollment_id and d.id = new.deliverable_id;
  return new;
end; $$;
CREATE TRIGGER submissions_notify AFTER UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.on_submission_reviewed();

CREATE OR REPLACE FUNCTION public.on_material_added() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.meeting_id is not null then
    perform public.notify_meeting_audience(new.meeting_id, 'material', 'Novo material: ' || new.title, null);
  else
    insert into public.notifications (user_id, type, title, body, link)
    select distinct e.mentee_id, 'material', 'Novo material: ' || new.title, l.title, 'lesson:' || l.id
    from public.lessons l join public.phases p on p.id = l.phase_id
    join public.enrollments e on e.program_id = p.program_id and e.status = 'ativa'
    where l.id = new.lesson_id;
  end if;
  return new;
end; $$;
CREATE TRIGGER lesson_materials_notify AFTER INSERT ON public.lesson_materials FOR EACH ROW EXECUTE FUNCTION public.on_material_added();

REVOKE EXECUTE ON FUNCTION public.notify_meeting_audience(uuid,text,text,text) FROM PUBLIC, anon, authenticated;