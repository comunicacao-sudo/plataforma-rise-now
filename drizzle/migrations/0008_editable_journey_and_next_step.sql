-- Editable, versioned journey owned by the mentor responsible for each pillar.
-- The legacy phases/lessons remain available while the UI migrates to this source.

CREATE TABLE IF NOT EXISTS public.journey_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  mentor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  current_published_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, name)
);

CREATE TABLE IF NOT EXISTS public.journey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id uuid NOT NULL REFERENCES public.journey_pillars(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version_number integer NOT NULL DEFAULT 0,
  revision integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (pillar_id, version_number)
);

ALTER TABLE public.journey_pillars
  DROP CONSTRAINT IF EXISTS journey_pillars_current_published_version_id_fkey;
ALTER TABLE public.journey_pillars
  ADD CONSTRAINT journey_pillars_current_published_version_id_fkey
  FOREIGN KEY (current_published_version_id) REFERENCES public.journey_versions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS journey_versions_one_draft_per_pillar
  ON public.journey_versions(pillar_id) WHERE status = 'draft';

CREATE TABLE IF NOT EXISTS public.journey_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.journey_versions(id) ON DELETE CASCADE,
  stable_key uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  format text NOT NULL CHECK (format IN ('questionnaire','form','recorded_class','live_group','individual_1_1')),
  impact_lead text NOT NULL DEFAULT '',
  impact_highlight text NOT NULL DEFAULT '',
  impact_tail text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  responsible_name text,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  resource_type text,
  resource_id text,
  resource_url text,
  scheduled_at timestamptz,
  release_at timestamptz,
  completion_rule text NOT NULL DEFAULT 'mentor_confirmation'
    CHECK (completion_rule IN ('final_submission','player_ended','mentor_confirmation','verified_external')),
  required boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, stable_key),
  UNIQUE (version_id, position)
);

CREATE TABLE IF NOT EXISTS public.enrollment_journey_versions (
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  pillar_id uuid NOT NULL REFERENCES public.journey_pillars(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.journey_versions(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, pillar_id)
);

CREATE TABLE IF NOT EXISTS public.journey_step_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  step_key uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','awaiting_confirmation','completed')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  confirmation_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, step_key)
);

GRANT SELECT ON public.journey_pillars, public.journey_versions, public.journey_steps,
  public.enrollment_journey_versions, public.journey_step_progress TO authenticated;
GRANT INSERT, UPDATE ON public.journey_step_progress TO authenticated;
GRANT ALL ON public.journey_pillars, public.journey_versions, public.journey_steps,
  public.enrollment_journey_versions, public.journey_step_progress TO service_role;

ALTER TABLE public.journey_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_journey_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_step_progress ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_journey_pillar(_pillar_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.journey_pillars p
    WHERE p.id = _pillar_id AND p.mentor_id = auth.uid()
  )
$$;

CREATE POLICY "authenticated read journey pillars" ON public.journey_pillars
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "published or owner read journey versions" ON public.journey_versions
  FOR SELECT TO authenticated USING (status = 'published' OR public.can_manage_journey_pillar(pillar_id));
CREATE POLICY "published or owner read journey steps" ON public.journey_steps
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.journey_versions v
    WHERE v.id = version_id AND (v.status = 'published' OR public.can_manage_journey_pillar(v.pillar_id))
  ));
CREATE POLICY "read assigned journey versions" ON public.enrollment_journey_versions
  FOR SELECT TO authenticated USING (public.can_access_enrollment(enrollment_id));
CREATE POLICY "read journey progress" ON public.journey_step_progress
  FOR SELECT TO authenticated USING (public.can_access_enrollment(enrollment_id));
CREATE POLICY "mentee starts journey progress" ON public.journey_step_progress
  FOR INSERT TO authenticated WITH CHECK (
    public.is_enrollment_mentee(enrollment_id)
    AND status IN ('not_started','in_progress','awaiting_confirmation')
    AND completed_at IS NULL
    AND confirmed_by IS NULL
  );
CREATE POLICY "mentee updates own incomplete journey progress" ON public.journey_step_progress
  FOR UPDATE TO authenticated
  USING (public.is_enrollment_mentee(enrollment_id) AND status <> 'completed')
  WITH CHECK (
    public.is_enrollment_mentee(enrollment_id)
    AND status IN ('not_started','in_progress','awaiting_confirmation')
    AND completed_at IS NULL
    AND confirmed_by IS NULL
  );
CREATE POLICY "staff updates progress in own journey pillar" ON public.journey_step_progress
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1
      FROM public.journey_steps s
      JOIN public.journey_versions v ON v.id = s.version_id
      WHERE s.stable_key = journey_step_progress.step_key
        AND public.can_manage_journey_pillar(v.pillar_id)
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1
      FROM public.journey_steps s
      JOIN public.journey_versions v ON v.id = s.version_id
      WHERE s.stable_key = journey_step_progress.step_key
        AND public.can_manage_journey_pillar(v.pillar_id)
    )
  );

-- Seed pillar ownership from existing data. Onboarding stays global instead of
-- being silently assigned to the Reflexão mentor.
INSERT INTO public.journey_pillars (program_id, name, position, mentor_id)
SELECT p.id, 'Global', 0, NULL FROM public.programs p
ON CONFLICT (program_id, name) DO NOTHING;

INSERT INTO public.journey_pillars (program_id, name, position, mentor_id)
SELECT DISTINCT ph.program_id,
  CASE ph.pillar
    WHEN 'R' THEN 'Reflexão'
    WHEN 'I' THEN 'Identidade'
    WHEN 'S' THEN 'Segurança'
    WHEN 'I · S' THEN 'Identidade · Segurança'
    WHEN 'E' THEN 'Evolução'
    ELSE ph.pillar
  END,
  CASE ph.pillar WHEN 'R' THEN 10 WHEN 'I' THEN 20 WHEN 'S' THEN 30 WHEN 'I · S' THEN 20 WHEN 'E' THEN 40 ELSE 50 END,
  CASE WHEN ph.pillar = 'R' THEN (
    SELECT pr.id FROM public.profiles pr
    WHERE lower(pr.full_name) = lower('Camila Um') LIMIT 1
  ) ELSE (
    SELECT pr.id FROM public.profiles pr
    WHERE lower(coalesce(pr.pillar,'')) = lower(CASE ph.pillar
      WHEN 'I' THEN 'Identidade' WHEN 'S' THEN 'Segurança'
      WHEN 'I · S' THEN 'Identidade · Segurança' WHEN 'E' THEN 'Evolução' ELSE ph.pillar END)
    LIMIT 1
  ) END
FROM public.phases ph
ON CONFLICT (program_id, name) DO UPDATE SET
  mentor_id = COALESCE(public.journey_pillars.mentor_id, EXCLUDED.mentor_id),
  position = EXCLUDED.position;

-- Create the initial published version for every pillar.
INSERT INTO public.journey_versions (pillar_id, status, version_number, revision, published_at)
SELECT jp.id, 'published', 1, 1, now()
FROM public.journey_pillars jp
WHERE NOT EXISTS (SELECT 1 FROM public.journey_versions v WHERE v.pillar_id = jp.id AND v.status = 'published');

UPDATE public.journey_pillars jp
SET current_published_version_id = v.id
FROM public.journey_versions v
WHERE v.pillar_id = jp.id AND v.status = 'published' AND v.version_number = 1
  AND jp.current_published_version_id IS NULL;

-- Existing participants are pinned to the version they had when the feature is
-- introduced. Later publications only move them when the publisher explicitly
-- opts in; new enrollments naturally use the current published version.
INSERT INTO public.enrollment_journey_versions(enrollment_id,pillar_id,version_id)
SELECT e.id,jp.id,jp.current_published_version_id
FROM public.enrollments e
JOIN public.journey_pillars jp ON jp.program_id = e.program_id
WHERE jp.current_published_version_id IS NOT NULL
ON CONFLICT (enrollment_id,pillar_id) DO NOTHING;

-- Import the current lessons once. The clean editor becomes the source of truth
-- after this migration; stable_key preserves progress across presentation/order changes.
INSERT INTO public.journey_steps (
  version_id, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
  description, responsible_name, duration_minutes, resource_type, resource_id,
  resource_url, scheduled_at, completion_rule, position
)
SELECT v.id, l.id, l.title,
  CASE
    WHEN lower(l.title) LIKE '%question%' THEN 'questionnaire'
    WHEN l.kind = 'aula' THEN 'recorded_class'
    WHEN lower(coalesce(l.session_format,'')) LIKE '%individual%' THEN 'individual_1_1'
    ELSE 'live_group'
  END,
  '', l.title, '', coalesce(l.description,''), l.mentor_name, l.duration_minutes,
  'legacy_lesson', l.id::text, coalesce(l.media_url,l.join_url), l.scheduled_at,
  CASE WHEN lower(l.title) LIKE '%question%' THEN 'final_submission' ELSE 'mentor_confirmation' END,
  ph.month_number * 100 + l.position
FROM public.lessons l
JOIN public.phases ph ON ph.id = l.phase_id
JOIN public.journey_pillars jp ON jp.program_id = ph.program_id
  AND jp.name = CASE
    WHEN lower(l.title) LIKE '%onboarding%' THEN 'Global'
    WHEN ph.pillar = 'R' THEN 'Reflexão'
    WHEN ph.pillar = 'I' THEN 'Identidade'
    WHEN ph.pillar = 'S' THEN 'Segurança'
    WHEN ph.pillar = 'I · S' THEN 'Identidade · Segurança'
    WHEN ph.pillar = 'E' THEN 'Evolução'
    ELSE ph.pillar END
JOIN public.journey_versions v ON v.id = jp.current_published_version_id
ON CONFLICT (version_id, stable_key) DO NOTHING;

UPDATE public.journey_steps s SET
  impact_highlight = 'Seu próximo nível',
  impact_tail = 'começa aqui.',
  description = 'O onboarding é o primeiro encontro da sua jornada RISE. Em uma reunião coletiva no Google Meet, você vai entender como a mentoria funciona, alinhar expectativas e se preparar para os próximos passos.',
  duration_minutes = coalesce(s.duration_minutes,40),
  responsible_name = NULL
WHERE lower(s.title) LIKE '%onboarding%';

UPDATE public.journey_steps s SET
  impact_highlight = 'Enxergar com clareza',
  impact_tail = 'é o primeiro passo para avançar com intenção.',
  description = 'O Mapa de Esclarecimento é um encontro individual 1:1 com a Camila Um. Nele, você aprofunda a leitura do seu momento atual, organiza percepções sobre seus desafios e identifica caminhos mais conscientes para a sua evolução.',
  responsible_name = 'Camila Um'
WHERE lower(s.title) LIKE '%mapa de esclarecimento%';

-- Drafts begin as exact copies of the published versions.
INSERT INTO public.journey_versions (pillar_id, status, version_number, revision)
SELECT jp.id, 'draft', 0, 1 FROM public.journey_pillars jp
WHERE NOT EXISTS (SELECT 1 FROM public.journey_versions v WHERE v.pillar_id = jp.id AND v.status = 'draft');

INSERT INTO public.journey_steps (
  version_id, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
  description, responsible_name, duration_minutes, resource_type, resource_id,
  resource_url, scheduled_at, release_at, completion_rule, required, position
)
SELECT draft.id, s.stable_key, s.title, s.format, s.impact_lead, s.impact_highlight, s.impact_tail,
  s.description, s.responsible_name, s.duration_minutes, s.resource_type, s.resource_id,
  s.resource_url, s.scheduled_at, s.release_at, s.completion_rule, s.required, s.position
FROM public.journey_versions draft
JOIN public.journey_pillars jp ON jp.id = draft.pillar_id
JOIN public.journey_steps s ON s.version_id = jp.current_published_version_id
WHERE draft.status = 'draft'
ON CONFLICT (version_id, stable_key) DO NOTHING;

-- Save the whole ordered draft in one transaction and reject stale editors.
CREATE OR REPLACE FUNCTION public.save_journey_draft(
  p_pillar_id uuid,
  p_expected_revision integer,
  p_steps jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_version public.journey_versions%ROWTYPE;
  v_step jsonb;
  v_position integer := 0;
BEGIN
  IF NOT public.can_manage_journey_pillar(p_pillar_id) THEN
    RAISE EXCEPTION 'Acesso restrito ao pilar.';
  END IF;
  SELECT * INTO v_version FROM public.journey_versions
  WHERE pillar_id = p_pillar_id AND status = 'draft' FOR UPDATE;
  IF v_version.id IS NULL THEN RAISE EXCEPTION 'Rascunho não encontrado.'; END IF;
  IF v_version.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Este rascunho foi alterado em outra sessão. Recarregue antes de salvar.';
  END IF;
  DELETE FROM public.journey_steps WHERE version_id = v_version.id;
  FOR v_step IN SELECT * FROM jsonb_array_elements(coalesce(p_steps,'[]'::jsonb)) LOOP
    INSERT INTO public.journey_steps (
      version_id, stable_key, title, format, impact_lead, impact_highlight, impact_tail,
      description, responsible_name, duration_minutes, resource_type, resource_id,
      resource_url, scheduled_at, release_at, completion_rule, required, position
    ) VALUES (
      v_version.id, coalesce((v_step->>'stableKey')::uuid, gen_random_uuid()),
      left(trim(coalesce(v_step->>'title','')),160), v_step->>'format',
      left(trim(coalesce(v_step->>'impactLead','')),180),
      left(trim(coalesce(v_step->>'impactHighlight','')),180),
      left(trim(coalesce(v_step->>'impactTail','')),180),
      left(trim(coalesce(v_step->>'description','')),1200),
      nullif(left(trim(coalesce(v_step->>'responsibleName','')),120),''),
      nullif(v_step->>'durationMinutes','')::integer,
      nullif(v_step->>'resourceType',''), nullif(v_step->>'resourceId',''),
      nullif(v_step->>'resourceUrl',''), nullif(v_step->>'scheduledAt','')::timestamptz,
      nullif(v_step->>'releaseAt','')::timestamptz,
      coalesce(nullif(v_step->>'completionRule',''),'mentor_confirmation'),
      coalesce((v_step->>'required')::boolean,true), v_position
    );
    v_position := v_position + 1;
  END LOOP;
  UPDATE public.journey_versions SET revision = revision + 1, updated_at = now()
  WHERE id = v_version.id RETURNING revision INTO p_expected_revision;
  INSERT INTO public.audit_log(actor_id, action, target, payload)
  VALUES (auth.uid(), 'journey_draft_saved', p_pillar_id::text, jsonb_build_object('steps',v_position));
  RETURN p_expected_revision;
END $$;

CREATE OR REPLACE FUNCTION public.publish_journey_draft(
  p_pillar_id uuid,
  p_expected_revision integer,
  p_apply_active boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_draft public.journey_versions%ROWTYPE;
  v_new_draft uuid;
  v_number integer;
  v_program uuid;
BEGIN
  IF NOT public.can_manage_journey_pillar(p_pillar_id) THEN
    RAISE EXCEPTION 'Acesso restrito ao pilar.';
  END IF;
  SELECT * INTO v_draft FROM public.journey_versions
  WHERE pillar_id = p_pillar_id AND status = 'draft' FOR UPDATE;
  IF v_draft.id IS NULL OR v_draft.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'O rascunho mudou. Recarregue antes de publicar.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.journey_steps WHERE version_id = v_draft.id
    AND (title = '' OR (impact_lead = '' AND impact_highlight = '' AND impact_tail = '') OR description = '')) THEN
    RAISE EXCEPTION 'Preencha título, frase de impacto e descrição antes de publicar.';
  END IF;
  SELECT coalesce(max(version_number),0) + 1 INTO v_number
  FROM public.journey_versions WHERE pillar_id = p_pillar_id AND status IN ('published','archived');
  UPDATE public.journey_versions SET status = 'archived'
  WHERE pillar_id = p_pillar_id AND status = 'published';
  UPDATE public.journey_versions
  SET status = 'published', version_number = v_number, published_at = now(), updated_at = now()
  WHERE id = v_draft.id;
  UPDATE public.journey_pillars SET current_published_version_id = v_draft.id, updated_at = now()
  WHERE id = p_pillar_id RETURNING program_id INTO v_program;
  IF p_apply_active THEN
    INSERT INTO public.enrollment_journey_versions(enrollment_id,pillar_id,version_id)
    SELECT e.id,p_pillar_id,v_draft.id FROM public.enrollments e
    WHERE e.program_id = v_program AND coalesce(e.status,'ativa') = 'ativa'
    ON CONFLICT (enrollment_id,pillar_id) DO UPDATE
      SET version_id = excluded.version_id, assigned_at = now();
  END IF;
  INSERT INTO public.journey_versions(pillar_id,status,version_number,revision,created_by)
  VALUES (p_pillar_id,'draft',0,1,auth.uid()) RETURNING id INTO v_new_draft;
  INSERT INTO public.journey_steps (
    version_id,stable_key,title,format,impact_lead,impact_highlight,impact_tail,description,
    responsible_name,duration_minutes,resource_type,resource_id,resource_url,scheduled_at,
    release_at,completion_rule,required,position
  ) SELECT v_new_draft,stable_key,title,format,impact_lead,impact_highlight,impact_tail,description,
    responsible_name,duration_minutes,resource_type,resource_id,resource_url,scheduled_at,
    release_at,completion_rule,required,position
  FROM public.journey_steps WHERE version_id = v_draft.id ORDER BY position;
  INSERT INTO public.audit_log(actor_id,action,target,payload)
  VALUES (auth.uid(),'journey_published',p_pillar_id::text,
    jsonb_build_object('version',v_number,'applyActive',p_apply_active));
  RETURN v_draft.id;
END $$;

-- Single source used by the Inicio highlight. It never advances on click,
-- booking or elapsed time: only a persisted completed status advances it.
CREATE OR REPLACE FUNCTION public.get_next_journey_step()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH enrollment AS (
    SELECT e.* FROM public.enrollments e
    WHERE e.mentee_id = auth.uid() AND coalesce(e.status,'ativa') <> 'desativada'
    ORDER BY e.created_at DESC LIMIT 1
  ), candidates AS (
    SELECT e.id enrollment_id, jp.id pillar_id, jp.name pillar_name, jp.position pillar_position,
      s.*, coalesce(pr.status,'not_started') progress_status,
      m.id meeting_id, m.scheduled_at meeting_scheduled_at, m.join_url meeting_join_url
    FROM enrollment e
    JOIN public.journey_pillars jp ON jp.program_id = e.program_id
    LEFT JOIN public.enrollment_journey_versions ejv
      ON ejv.enrollment_id = e.id AND ejv.pillar_id = jp.id
    JOIN public.journey_versions v ON v.id = coalesce(ejv.version_id,jp.current_published_version_id)
    JOIN public.journey_steps s ON s.version_id = v.id AND s.archived_at IS NULL
    LEFT JOIN public.journey_step_progress pr ON pr.enrollment_id = e.id AND pr.step_key = s.stable_key
    LEFT JOIN LATERAL (
      SELECT mt.id,mt.scheduled_at,mt.join_url FROM public.meetings mt
      WHERE mt.enrollment_id = e.id
        AND s.format = 'individual_1_1'
        AND (mt.id::text = s.resource_id OR mt.lesson_id::text = s.resource_id)
      ORDER BY mt.scheduled_at DESC LIMIT 1
    ) m ON true
    WHERE s.required AND coalesce(pr.status,'not_started') <> 'completed'
    ORDER BY jp.position,s.position
    LIMIT 1
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM enrollment) THEN
    jsonb_build_object('state','no_enrollment')
  WHEN NOT EXISTS (SELECT 1 FROM candidates) THEN
    jsonb_build_object('state','complete')
  ELSE (
    SELECT jsonb_build_object(
      'state', CASE
        WHEN release_at IS NOT NULL AND release_at > now() THEN 'blocked'
        WHEN format = 'individual_1_1' THEN 'ready'
        WHEN format = 'live_group' AND scheduled_at IS NOT NULL THEN 'ready'
        WHEN coalesce(resource_url,resource_id,meeting_id::text) IS NULL THEN 'waiting_resource'
        ELSE 'ready' END,
      'enrollmentId',enrollment_id,'pillarId',pillar_id,'pillarName',pillar_name,
      'stepKey',stable_key,'title',title,'format',format,'impactLead',impact_lead,
      'impactHighlight',impact_highlight,'impactTail',impact_tail,'description',description,
      'responsibleName',responsible_name,'durationMinutes',duration_minutes,
      'resourceType',resource_type,'resourceId',resource_id,
      'resourceUrl',coalesce(meeting_join_url,resource_url),
      'scheduledAt',coalesce(meeting_scheduled_at,scheduled_at),'releaseAt',release_at,
      'progressStatus',progress_status,
      'actionLabel',CASE
        WHEN release_at IS NOT NULL AND release_at > now() THEN NULL
        WHEN format = 'questionnaire' THEN CASE WHEN progress_status='in_progress' THEN 'Continuar questionário' ELSE 'Responder questionário' END
        WHEN format = 'form' THEN CASE WHEN progress_status='in_progress' THEN 'Continuar formulário' ELSE 'Preencher formulário' END
        WHEN format = 'recorded_class' THEN CASE WHEN progress_status='in_progress' THEN 'Continuar aula' ELSE 'Assistir à aula' END
        WHEN format = 'live_group' AND coalesce(resource_url,meeting_join_url) IS NOT NULL THEN 'Entrar no encontro'
        WHEN format = 'live_group' AND scheduled_at IS NOT NULL THEN 'Ver detalhes do encontro'
        WHEN format = 'individual_1_1' AND meeting_id IS NULL THEN 'Agendar meu encontro'
        WHEN format = 'individual_1_1' AND meeting_join_url IS NULL THEN 'Ver meu encontro'
        WHEN format = 'individual_1_1' THEN 'Entrar no encontro'
        ELSE NULL END
    ) FROM candidates
  ) END
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_journey_pillar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_journey_draft(uuid,integer,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_journey_draft(uuid,integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_journey_step() TO authenticated;

-- Keep legacy lesson completion and the new source in sync during migration.
CREATE OR REPLACE FUNCTION public.sync_legacy_lesson_journey_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.journey_step_progress(
    enrollment_id,step_key,status,completed_at,confirmation_source,updated_at
  ) VALUES (
    NEW.enrollment_id,NEW.lesson_id,
    CASE WHEN NEW.completed THEN 'completed' ELSE 'not_started' END,
    CASE WHEN NEW.completed THEN coalesce(NEW.completed_at,now()) ELSE NULL END,
    CASE WHEN NEW.completed THEN 'legacy_lesson_progress' ELSE NULL END,
    now()
  ) ON CONFLICT (enrollment_id,step_key) DO UPDATE SET
    status = excluded.status,
    completed_at = excluded.completed_at,
    confirmation_source = excluded.confirmation_source,
    updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lesson_progress_sync_journey ON public.lesson_progress;
CREATE TRIGGER lesson_progress_sync_journey
AFTER INSERT OR UPDATE OF completed,completed_at ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_lesson_journey_progress();

INSERT INTO public.journey_step_progress(
  enrollment_id,step_key,status,completed_at,confirmation_source
)
SELECT lp.enrollment_id,lp.lesson_id,
  CASE WHEN lp.completed THEN 'completed' ELSE 'not_started' END,
  lp.completed_at,
  CASE WHEN lp.completed THEN 'legacy_lesson_progress' ELSE NULL END
FROM public.lesson_progress lp
ON CONFLICT (enrollment_id,step_key) DO NOTHING;

