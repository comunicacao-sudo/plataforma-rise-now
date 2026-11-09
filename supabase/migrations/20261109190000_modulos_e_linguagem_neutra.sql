-- 1) Módulos dentro de cada etapa: as aulas, materiais e questionários de uma etapa
--    podem ser agrupados por módulo. O módulo é só um nome; a ordem dos módulos segue
--    a ordem dos conteúdos (o primeiro conteúdo de cada módulo define onde ele aparece).
alter table public.journey_stage_contents
  add column if not exists module_title text;

alter table public.journey_stage_contents
  drop constraint if exists journey_stage_contents_module_title_check;
alter table public.journey_stage_contents
  add constraint journey_stage_contents_module_title_check
  check (module_title is null or char_length(btrim(module_title)) between 1 and 120);

-- 2) Linguagem neutra: a turma tem homens e mulheres.
--    Automações de WhatsApp já salvas: {mentorada} vira {participante}
--    e "A mentorada *{...}*" vira só o nome.
update public.whatsapp_automations
   set template = replace(
         replace(template, 'A mentorada *{mentorada}*', '*{participante}*'),
         '{mentorada}', '{participante}'),
       updated_at = now()
 where template like '%{mentorada}%';

-- Textos padrão dentro das funções do banco (sem reescrever a função inteira).
do $$
declare
  fn record;
  body text;
  changed text;
begin
  for fn in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('on_submission_sent', 'record_stage_video_progress', 'stage_video_engagement')
  loop
    body := pg_get_functiondef(fn.oid);
    changed := replace(body, $q$coalesce(p.full_name,'mentorada')$q$, $q$coalesce(p.full_name,'participante')$q$);
    changed := replace(changed, $q$'Acesso restrito ao mentorado deste vídeo.'$q$, $q$'Acesso restrito a quem participa deste vídeo.'$q$);
    changed := replace(changed, $q$p.full_name,'Mentorado')$q$, $q$p.full_name,'Participante')$q$);
    if changed <> body then
      execute changed;
    end if;
  end loop;
end $$;
