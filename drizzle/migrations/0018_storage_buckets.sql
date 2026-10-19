-- Materialize every Storage bucket referenced by the application.
-- The earlier migrations define object policies, but historically three of
-- these buckets were created manually in the Supabase dashboard.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  ('rise-private', 'rise-private', false, NULL::bigint, NULL::text[]),
  ('materials', 'materials', false, NULL::bigint, NULL::text[]),
  ('journey-content', 'journey-content', false, NULL::bigint, NULL::text[])
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage upserts require SELECT, INSERT and UPDATE. SELECT and INSERT are
-- already defined by migrations 0005 and 0006; make UPDATE explicit and keep
-- ownership checks on both the old and new row values.
DROP POLICY IF EXISTS "avatars own update" ON storage.objects;
CREATE POLICY "avatars own update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "materials staff update" ON storage.objects;
CREATE POLICY "materials staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'materials' AND (SELECT public.is_staff()))
  WITH CHECK (bucket_id = 'materials' AND (SELECT public.is_staff()));
