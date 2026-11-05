-- A conta profissional existente da Gabriela usa comunicacao@pamarisdigital.com.
-- Corrige a função interna preservando assinatura, permissões e o perfil existente.
CREATE OR REPLACE FUNCTION private.public_staff_directory()
RETURNS TABLE(id uuid, full_name text, title text, avatar_url text, is_admin boolean, staff_type text, specialty text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p.id,p.full_name,p.title,p.avatar_url,public.has_role(p.id,'admin'),p.staff_type,COALESCE(s.name,p.pillar)
  FROM public.profiles p
  LEFT JOIN public.mentor_specialties s ON s.id=p.primary_specialty_id
  WHERE auth.uid() IS NOT NULL
    AND lower(p.email) IN ('camilaum@pamarisdigital.com','comunicacao@pamarisdigital.com','ana@pamarisdigital.com','camila@pamarisdigital.com')
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role IN ('admin','mentor'))
  ORDER BY CASE lower(p.email) WHEN 'camilaum@pamarisdigital.com' THEN 1 WHEN 'comunicacao@pamarisdigital.com' THEN 2 WHEN 'ana@pamarisdigital.com' THEN 3 ELSE 4 END;
$$;
