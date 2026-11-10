-- Cada aula gravada passa a ter seus próprios "Principais temas" (o resumo usa a
-- descrição da aula) e cada material de apoio pode ficar ligado a uma aula
-- específica. Sem aula ligada, o material aparece em todas as aulas da etapa.
alter table public.journey_stage_contents
  add column if not exists topics text[] not null default '{}';

alter table public.journey_stage_contents
  add column if not exists lesson_id uuid
    references public.journey_stage_contents (id) on delete set null;

create index if not exists journey_stage_contents_lesson_id_idx
  on public.journey_stage_contents (lesson_id)
  where lesson_id is not null;
