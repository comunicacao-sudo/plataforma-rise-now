-- Segurança (auditoria):
-- 1) Notas: só a equipe grava nota confidencial (mentor_private) e ninguém move
--    uma nota para uma matrícula que não acessa.
drop policy if exists "write own notes" on public.notes;
create policy "write own notes" on public.notes
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.can_access_enrollment(enrollment_id)
    and (visibility <> 'mentor_private' or private.is_staff())
  );

drop policy if exists "update own notes" on public.notes;
create policy "update own notes" on public.notes
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and private.can_access_enrollment(enrollment_id)
    and (visibility <> 'mentor_private' or private.is_staff())
  );

-- 2) Limite de tamanho nas pastas privadas de arquivos (antes: sem limite).
--    Maior arquivo existente hoje: ~1,8 MB. Vídeos ficam no Cloudflare R2.
update storage.buckets set file_size_limit = 100 * 1024 * 1024 where id = 'journey-content';
update storage.buckets set file_size_limit = 50 * 1024 * 1024 where id in ('rise-private', 'materials');
