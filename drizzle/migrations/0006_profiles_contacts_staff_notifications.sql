ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS contact_email text;

CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.id := old.id; new.email := old.email; new.claimed := old.claimed;
  end if;
  return new;
end; $$;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR public.is_staff() OR EXISTS (
    SELECT 1 FROM public.enrollments e WHERE (e.mentee_id = profiles.id AND e.mentor_id = auth.uid()) OR (e.mentor_id = profiles.id AND e.mentee_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.staff_directory()
RETURNS TABLE (id uuid, full_name text, title text, avatar_url text, phone text, contact_email text, is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select p.id, p.full_name, p.title, p.avatar_url, p.phone, p.contact_email, public.has_role(p.id,'admin')
  from public.profiles p
  where auth.uid() is not null and exists (select 1 from public.user_roles r where r.user_id = p.id and r.role in ('admin','mentor'))
  order by p.full_name
$$;
REVOKE EXECUTE ON FUNCTION public.staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_directory() TO authenticated;

CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.on_submission_sent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.status = 'enviada' and (tg_op = 'INSERT' or old.status is distinct from 'enviada') then
    insert into public.notifications (user_id, type, title, body, link)
    select distinct u.uid, 'submission', 'Nova entrega de ' || coalesce(p.full_name,'mentorada'), d.title, 'entregas'
    from public.enrollments e
    join public.profiles p on p.id = e.mentee_id
    join public.deliverables d on d.id = new.deliverable_id
    cross join lateral (
      select e.mentor_id as uid where e.mentor_id is not null
      union select r.user_id from public.user_roles r where r.role = 'admin') u
    where e.id = new.enrollment_id;
  end if;
  return new;
end; $$;
CREATE TRIGGER submissions_sent_notify AFTER INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.on_submission_sent();

CREATE OR REPLACE FUNCTION public.on_meeting_mentor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.mentor_id is not null and new.mentor_id is distinct from new.created_by then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.mentor_id, 'meeting', 'Você foi indicada para: ' || new.title,
      to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), 'agenda');
  end if;
  return new;
end; $$;
CREATE TRIGGER meetings_mentor_notify AFTER INSERT ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.on_meeting_mentor();