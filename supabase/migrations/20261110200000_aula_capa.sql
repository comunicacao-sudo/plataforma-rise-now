-- Capa própria de cada aula gravada (aparece em "Continue de onde parou",
-- no cartão "A seguir" e antes do vídeo começar). Fica no bucket journey-content.
alter table public.journey_stage_contents
  add column if not exists cover_path text
    check (cover_path is null or cover_path like 'covers/%');
