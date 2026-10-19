-- Bootstrap the official RISE NOW program from the repository source of truth.
-- Generated UUIDs are intentionally not hardcoded; natural business keys are
-- used so the migration remains safe on a freshly reconstructed project.

INSERT INTO public.programs (name, tagline, description, duration_months)
SELECT
  'RISE NOW',
  'Sua jornada de 6 meses',
  'Do autoconhecimento à evolução aplicada e sustentada.',
  6
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs WHERE lower(name) = lower('RISE NOW')
);

WITH official_program AS (
  SELECT id
  FROM public.programs
  WHERE lower(name) = lower('RISE NOW')
  ORDER BY created_at
  LIMIT 1
), phase_data(month_number, title, pillar, mentor_name, question, description) AS (
  VALUES
    (1, 'Reflexão', 'R', 'Camila Um', 'Onde estou?', 'Escuta ativa, diagnóstico de trajetória, forças, gaps, autoconsciência e clareza de momento.'),
    (2, 'Identidade + Segurança', 'I · S', 'Gabriela Ribeiro · Ana Luiza', 'Quem sou e como amplio minha capacidade?', 'Posicionamento executivo, marca pessoal e IA aplicada à rotina com critério e autonomia.'),
    (3, 'Direção', 'E', 'Camila Mariano', 'Para onde vou?', 'Tomada de decisão, escolhas, riscos e o custo da não decisão.'),
    (4, 'Execução', 'E', 'Camila Mariano', 'O que vou fazer?', 'Liderança, competências do próximo nível e o início do método RISE 90.'),
    (5, 'Consistência', 'E', 'Camila Mariano', 'Estou evoluindo de verdade?', 'Accountability, ajustes de rota e evidências de evolução.'),
    (6, 'Sustentação', 'E', 'Camila Mariano', 'Como sustento o próximo nível?', 'Sustentabilidade da evolução, revisão final e plano de continuidade.')
)
INSERT INTO public.phases (
  program_id, month_number, title, pillar, mentor_name, question, description
)
SELECT p.id, d.month_number, d.title, d.pillar, d.mentor_name, d.question, d.description
FROM official_program p
CROSS JOIN phase_data d
ON CONFLICT (program_id, month_number) DO UPDATE SET
  title = EXCLUDED.title,
  pillar = EXCLUDED.pillar,
  mentor_name = EXCLUDED.mentor_name,
  question = EXCLUDED.question,
  description = EXCLUDED.description;

WITH lesson_data(
  month_number, position, title, kind, session_format, mentor_name,
  duration_minutes, description, topics
) AS (
  VALUES
    (1, 1, 'Onboarding RISE', 'encontro', 'Coletivo', 'As quatro mentoras', 90, 'Boas vindas à jornada, apresentação das mentoras, do método e dos combinados do grupo.', ARRAY['O método RISE','Como a jornada funciona','Combinados e ritmo']::text[]),
    (1, 2, 'Mapa de Esclarecimento', 'encontro', '1:1', 'Camila Um', 60, 'Sessão individual de escuta ativa para mapear trajetória, momento e dilemas atuais.', ARRAY['Diagnóstico de trajetória','Forças e gaps','Dilemas do momento']::text[]),
    (1, 3, 'Consciência & Leitura de Ambiente', 'aula', NULL, 'Camila Um', 38, 'Autoconsciência, padrões de comportamento e leitura de contexto para decisões mais claras.', ARRAY['Autoconsciência','Perfil DISC','Leitura de contexto']::text[]),
    (1, 4, 'Forward Reflection', 'encontro', 'Coletivo', 'Camila Um', 90, 'Encontro coletivo para transformar reflexão em perspectiva de futuro.', ARRAY['Padrões que se repetem','O que levar adiante','Troca entre mentoradas']::text[]),
    (1, 5, 'Consolidação', 'encontro', '1:1', 'Camila Um', 60, 'Fechamento do mês para consolidar aprendizados e preparar o Mapa de Clareza RISE.', ARRAY['Síntese do mês','Clareza de momento','Preparação da entrega']::text[]),
    (2, 1, 'Self Brand & Posicionamento', 'aula', NULL, 'Gabriela Ribeiro', 32, 'Transforme competência em identidade, reconheça diferenciais e construa uma percepção de valor coerente.', ARRAY['Marca pessoal','Diferenciais','Reputação']::text[]),
    (2, 2, 'Identity Session', 'encontro', '1:1', 'Gabriela Ribeiro', 60, 'Diagnóstico 360 da sua presença no LinkedIn, Instagram, TikTok e WhatsApp.', ARRAY['Diagnóstico 360','Posicionamento executivo','Presença digital']::text[]),
    (2, 3, 'O Novo Profissional', 'aula', NULL, 'Ana Luiza', 41, 'A transformação do trabalho com IA, competências humanas, adaptabilidade e produtividade.', ARRAY['IA sem mistério','Critério de pergunta','Competências humanas']::text[]),
    (2, 4, 'IA na Prática', 'encontro', 'Coletivo', 'Ana Luiza', 90, 'Aplicações reais de IA para ganhar produtividade no dia a dia.', ARRAY['ChatGPT e Claude','Ferramenta certa por tarefa','Casos práticos']::text[]),
    (2, 5, 'AI & Productivity Session', 'encontro', '1:1', 'Ana Luiza', 60, 'Sessão individual para montar o seu plano de aplicação de IA na rotina.', ARRAY['Mapa de tarefas','Autonomia de processos','Plano individual']::text[]),
    (3, 1, 'Tomada de Decisão Profissional', 'aula', NULL, 'Camila Mariano', 44, 'Escolhas, riscos, concessões e o custo da não decisão.', ARRAY['Concessões','Riscos','Custo da não decisão']::text[]),
    (3, 2, 'RISE Decision Room', 'encontro', 'Coletivo', 'As quatro mentoras', 90, 'Dilemas reais com a perspectiva das quatro mentoras.', ARRAY['Dilemas reais','Quatro perspectivas','Decisões de alto impacto']::text[]),
    (3, 3, '1:1 Direção', 'encontro', '1:1', 'Camila Mariano', 60, 'Sessão individual para definir a direção dos próximos meses.', ARRAY['Opções','Critérios','Direção']::text[]),
    (4, 1, 'Competências do Próximo Nível', 'aula', NULL, 'Camila Mariano', 36, 'Comportamentos, liderança e capacidades para sustentar o próximo nível.', ARRAY['Liderança','Gestão de time','Comportamentos']::text[]),
    (4, 2, 'RISE 90 START', 'encontro', '1:1', 'Camila Mariano', 60, 'Construção do seu plano RISE 90.', ARRAY['Metas','Indicadores','Rotina de execução']::text[]),
    (4, 3, 'Next Level Lab', 'encontro', 'Coletivo', 'Camila Mariano', 90, 'Laboratório coletivo de liderança e execução.', ARRAY['Casos do grupo','Liderança na prática']::text[]),
    (5, 1, 'Consistência & Accountability', 'aula', NULL, 'Camila Mariano', 35, 'Como manter o ritmo e medir a evolução real.', ARRAY['Accountability','Evidências','Ajuste de rota']::text[]),
    (5, 2, 'RISE 90 CHECKPOINT', 'encontro', '1:1', 'Camila Mariano', 60, 'Revisão do plano RISE 90 e ajustes.', ARRAY['O que funcionou','O que ajustar']::text[]),
    (5, 3, 'Next Level Lab, Consistência', 'encontro', 'Coletivo', 'Camila Mariano', 90, 'Encontro coletivo de troca sobre consistência.', ARRAY['Troca entre mentoradas','Obstáculos comuns']::text[]),
    (6, 1, 'Sustentar a Evolução', 'aula', NULL, 'Camila Mariano', 38, 'Como sustentar o próximo nível depois da mentoria.', ARRAY['Sustentabilidade','Hábitos','Continuidade']::text[]),
    (6, 2, 'RISE Board', 'encontro', 'Coletivo', 'Camila Mariano', 90, 'Apresentação da evolução para o grupo.', ARRAY['Evolução','Feedback do grupo']::text[]),
    (6, 3, 'RISE 90 REVIEW', 'encontro', '1:1', 'Camila Mariano', 60, 'Revisão final do plano RISE 90.', ARRAY['Resultados','Aprendizados']::text[]),
    (6, 4, 'RISE Closing', 'encontro', 'Coletivo', 'As quatro mentoras', 90, 'Encerramento da jornada com as quatro mentoras.', ARRAY['Celebração','Próximos passos']::text[])
), official_program AS (
  SELECT id FROM public.programs WHERE lower(name) = lower('RISE NOW') ORDER BY created_at LIMIT 1
)
INSERT INTO public.lessons (
  phase_id, title, description, kind, duration_minutes, position,
  mentor_name, session_format, topics
)
SELECT
  p.id, d.title, d.description, d.kind::public.content_kind,
  d.duration_minutes, d.position, d.mentor_name, d.session_format, d.topics
FROM lesson_data d
JOIN official_program op ON true
JOIN public.phases p ON p.program_id = op.id AND p.month_number = d.month_number
WHERE NOT EXISTS (
  SELECT 1 FROM public.lessons existing
  WHERE existing.phase_id = p.id AND existing.title = d.title
);

WITH deliverable_data(month_number, title, description) AS (
  VALUES
    (1, 'Mapa de Clareza RISE', 'Sua leitura de momento: trajetória, forças, gaps e o que precisa mudar.'),
    (2, 'Mapa de Identidade & Plano de IA', 'Mapa de Identidade & Posicionamento e Plano Individual de Aplicação de IA.'),
    (3, 'Mapa de Direção', 'As escolhas que definem o seu próximo movimento.'),
    (4, 'RISE 90 START', 'Seu plano de 90 dias com metas e indicadores.'),
    (5, 'RISE 90 ajustado + evidências', 'Plano revisado e as evidências do que já mudou.'),
    (6, 'RISE 90 Review + Plano de Continuidade', 'Balanço da jornada e os próximos passos.')
), official_program AS (
  SELECT id FROM public.programs WHERE lower(name) = lower('RISE NOW') ORDER BY created_at LIMIT 1
)
INSERT INTO public.deliverables (phase_id, title, description, position)
SELECT p.id, d.title, d.description, 1
FROM deliverable_data d
JOIN official_program op ON true
JOIN public.phases p ON p.program_id = op.id AND p.month_number = d.month_number
WHERE NOT EXISTS (
  SELECT 1 FROM public.deliverables existing
  WHERE existing.phase_id = p.id AND existing.title = d.title
);

WITH pillar_data(name, position, mentor_email) AS (
  VALUES
    ('Reflexão', 1, 'camilaum@pamarisdigital.com'),
    ('Identidade', 2, 'gabi@pamarisdigital.com'),
    ('Segurança', 3, 'ana@pamarisdigital.com'),
    ('Evolução', 4, 'camila@pamarisdigital.com')
), official_program AS (
  SELECT id FROM public.programs WHERE lower(name) = lower('RISE NOW') ORDER BY created_at LIMIT 1
)
INSERT INTO public.journey_pillars (program_id, name, position, mentor_id)
SELECT op.id, d.name, d.position, profiles.id
FROM pillar_data d
JOIN official_program op ON true
LEFT JOIN public.profiles profiles ON lower(profiles.email) = lower(d.mentor_email)
ON CONFLICT (program_id, name) DO UPDATE SET
  position = EXCLUDED.position,
  mentor_id = EXCLUDED.mentor_id,
  updated_at = now();

INSERT INTO public.journey_versions (
  pillar_id, status, version_number, revision, created_by, published_at
)
SELECT p.id, 'published', 1, 1, p.mentor_id, now()
FROM public.journey_pillars p
JOIN public.programs program ON program.id = p.program_id
WHERE lower(program.name) = lower('RISE NOW')
  AND NOT EXISTS (
    SELECT 1 FROM public.journey_versions existing
    WHERE existing.pillar_id = p.id AND existing.status = 'published'
  );

WITH official_program AS (
  SELECT id FROM public.programs WHERE lower(name) = lower('RISE NOW') ORDER BY created_at LIMIT 1
), source_steps AS (
  SELECT
    l.id AS lesson_id,
    l.title,
    l.description,
    l.mentor_name,
    l.duration_minutes,
    l.topics,
    p.month_number,
    CASE
      WHEN p.month_number = 1 THEN 'Reflexão'
      WHEN p.month_number = 2 AND l.mentor_name = 'Gabriela Ribeiro' THEN 'Identidade'
      WHEN p.month_number = 2 THEN 'Segurança'
      ELSE 'Evolução'
    END AS pillar_name,
    CASE
      WHEN l.title = 'Onboarding RISE' THEN 'cohort_onboarding'
      WHEN l.kind = 'aula'::public.content_kind THEN 'recorded_class'
      WHEN l.session_format = '1:1' THEN 'individual_1_1'
      ELSE 'live_group'
    END AS step_format,
    CASE WHEN l.kind = 'aula'::public.content_kind THEN 'player_ended' ELSE 'mentor_confirmation' END AS completion_rule,
    row_number() OVER (
      PARTITION BY CASE
        WHEN p.month_number = 1 THEN 'Reflexão'
        WHEN p.month_number = 2 AND l.mentor_name = 'Gabriela Ribeiro' THEN 'Identidade'
        WHEN p.month_number = 2 THEN 'Segurança'
        ELSE 'Evolução'
      END
      ORDER BY p.month_number, l.position, l.created_at
    )::integer * 10 AS step_position
  FROM public.lessons l
  JOIN public.phases p ON p.id = l.phase_id
  JOIN official_program op ON op.id = p.program_id
)
INSERT INTO public.journey_steps (
  version_id, title, format, description, responsible_name, duration_minutes,
  resource_type, resource_id, completion_rule, required, position,
  month_number, summary, topics, materials, access_scope
)
SELECT
  version.id,
  source.title,
  source.step_format,
  source.description,
  source.mentor_name,
  source.duration_minutes,
  'legacy_lesson',
  source.lesson_id::text,
  source.completion_rule,
  true,
  source.step_position,
  source.month_number,
  source.description,
  source.topics,
  '[]'::jsonb,
  'general'
FROM source_steps source
JOIN public.journey_pillars pillar ON pillar.name = source.pillar_name
JOIN official_program op ON op.id = pillar.program_id
JOIN public.journey_versions version
  ON version.pillar_id = pillar.id AND version.status = 'published' AND version.version_number = 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.journey_steps existing
  WHERE existing.version_id = version.id
    AND existing.resource_type = 'legacy_lesson'
    AND existing.resource_id = source.lesson_id::text
);

INSERT INTO public.journey_steps (
  version_id, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
  description, responsible_name, duration_minutes, resource_type, completion_rule,
  required, position, month_number, summary, topics, materials, access_scope
)
SELECT
  version.id,
  '7d2d3d63-9fc4-4d7a-a1c0-6e32a5c91c50'::uuid,
  'Questionário do perfil comportamental',
  'questionnaire',
  'Conheça suas tendências ',
  'naturais e profissionais',
  ' para orientar seu desenvolvimento.',
  'Mapeamento nativo RISE com Perfil Natural e Perfil Adaptado ao trabalho.',
  'Equipe RISE',
  20,
  'rise_assessment',
  'final_submission',
  true,
  21,
  1,
  '50 respostas, cálculo determinístico e devolutiva privada no seu perfil.',
  ARRAY['Perfil Natural','Perfil Adaptado','Desenvolvimento']::text[],
  '[]'::jsonb,
  'general'
FROM public.journey_versions version
JOIN public.journey_pillars pillar ON pillar.id = version.pillar_id
JOIN public.programs program ON program.id = pillar.program_id
WHERE lower(program.name) = lower('RISE NOW')
  AND pillar.name = 'Reflexão'
  AND version.status = 'published'
  AND version.version_number = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.journey_steps existing
    WHERE existing.version_id = version.id
      AND existing.stable_key = '7d2d3d63-9fc4-4d7a-a1c0-6e32a5c91c50'::uuid
  );

UPDATE public.journey_pillars pillar
SET current_published_version_id = version.id,
    updated_at = now()
FROM public.journey_versions version
JOIN public.programs program ON program.id = (
  SELECT p.program_id FROM public.journey_pillars p WHERE p.id = version.pillar_id
)
WHERE version.pillar_id = pillar.id
  AND version.status = 'published'
  AND version.version_number = 1
  AND lower(program.name) = lower('RISE NOW');
