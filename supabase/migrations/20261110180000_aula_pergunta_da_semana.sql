-- "Para levar para a semana": pergunta de aplicação prática de cada aula gravada.
-- A resposta da pessoa vai para o caderno da etapa (journey_content_notes).
alter table public.journey_stage_contents
  add column if not exists reflection_prompt text
    check (reflection_prompt is null or char_length(reflection_prompt) <= 300);
