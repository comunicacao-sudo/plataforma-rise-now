-- Integrated journey content library, scoped releases and private study data.
-- Extends the versioned journey introduced in 0008 instead of creating a
-- parallel content tree.

ALTER TABLE public.journey_steps
  DROP CONSTRAINT IF EXISTS journey_steps_format_check;

ALTER TABLE public.journey_steps
  ADD CONSTRAINT journey_steps_format_check CHECK (
    format IN (
      'questionnaire', 'form', 'recorded_class', 'collective_recording',
      'cohort_onboarding', 'live_group', 'individual_1_1'
    )
  ),
  ADD COLUMN IF NOT EXISTS month_number integer NOT NULL DEFAULT 1
    CHECK (month_number BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS topics text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS access_scope text NOT NULL DEFAULT 'general'
    CHECK (access_scope IN ('general', 'cohort', 'mentee')),
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.journey_steps
  DROP CONSTRAINT IF EXISTS journey_steps_scope_target_check;
ALTER TABLE public.journey_steps
  ADD CONSTRAINT journey_steps_scope_target_check CHECK (
    (access_scope = 'general' AND cohort_id IS NULL AND mentee_id IS NULL)
    OR (access_scope = 'cohort' AND cohort_id IS NOT NULL AND mentee_id IS NULL)
    OR (access_scope = 'mentee' AND mentee_id IS NOT NULL AND cohort_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS journey_steps_scope_idx
  ON public.journey_steps(access_scope, cohort_id, mentee_id, month_number, position);

CREATE TABLE IF NOT EXISTS public.journey_content_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  step_key uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_key)
);

CREATE TABLE IF NOT EXISTS public.journey_content_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  step_key uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  timestamp_seconds integer NOT NULL CHECK (timestamp_seconds >= 0),
  reflection text NOT NULL CHECK (length(trim(reflection)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journey_content_progress (
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  step_key uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  current_seconds integer NOT NULL DEFAULT 0 CHECK (current_seconds >= 0),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, step_key)
);

CREATE INDEX IF NOT EXISTS journey_content_markers_time_idx
  ON public.journey_content_markers(user_id, step_key, timestamp_seconds);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_content_notes,
  public.journey_content_markers, public.journey_content_progress TO authenticated;
GRANT ALL ON public.journey_content_notes, public.journey_content_markers,
  public.journey_content_progress TO service_role;

ALTER TABLE public.journey_content_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_content_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_content_progress ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_journey_step(_step_key uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.journey_pillars p ON p.program_id = e.program_id
    LEFT JOIN public.enrollment_journey_versions ejv
      ON ejv.enrollment_id = e.id AND ejv.pillar_id = p.id
    JOIN public.journey_versions v
      ON v.id = coalesce(ejv.version_id, p.current_published_version_id)
      AND v.status IN ('published', 'archived')
    JOIN public.journey_steps s ON s.version_id = v.id
    WHERE e.mentee_id = auth.uid()
      AND coalesce(e.status, 'ativa') <> 'desativada'
      AND s.stable_key = _step_key
      AND s.archived_at IS NULL
      AND s.month_number <= e.current_month
      AND (s.release_at IS NULL OR s.release_at <= now())
      AND (
        s.access_scope = 'general'
        OR (s.access_scope = 'cohort' AND s.cohort_id = e.cohort_id)
        OR (s.access_scope = 'mentee' AND s.mentee_id = e.mentee_id)
      )
  )
$$;

DROP POLICY IF EXISTS "published or owner read journey steps" ON public.journey_steps;
CREATE POLICY "authorized or manager read journey steps" ON public.journey_steps
  FOR SELECT TO authenticated USING (
    public.can_access_journey_step(stable_key)
    OR EXISTS (
      SELECT 1 FROM public.journey_versions v
      WHERE v.id = version_id AND public.can_manage_journey_pillar(v.pillar_id)
    )
  );

CREATE POLICY "mentee reads own journey notes" ON public.journey_content_notes
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
  );
CREATE POLICY "mentee writes own journey notes" ON public.journey_content_notes
  FOR ALL TO authenticated USING (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
  ) WITH CHECK (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
    AND public.can_access_journey_step(step_key)
  );

CREATE POLICY "mentee reads own journey markers" ON public.journey_content_markers
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
  );
CREATE POLICY "mentee writes own journey markers" ON public.journey_content_markers
  FOR ALL TO authenticated USING (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
  ) WITH CHECK (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
    AND public.can_access_journey_step(step_key)
  );

CREATE POLICY "mentee reads own journey content progress" ON public.journey_content_progress
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
  );
CREATE POLICY "mentee writes own journey content progress" ON public.journey_content_progress
  FOR ALL TO authenticated USING (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
  ) WITH CHECK (
    user_id = auth.uid() AND public.is_enrollment_mentee(enrollment_id)
    AND public.can_access_journey_step(step_key)
  );

-- Private objects are served through short-lived signed URLs created by
-- authenticated server functions. Direct bucket browsing is not granted.
INSERT INTO storage.buckets (id, name, public)
VALUES ('journey-content', 'journey-content', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "journey content staff insert" ON storage.objects;
CREATE POLICY "journey content staff insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'journey-content' AND public.is_admin());
DROP POLICY IF EXISTS "journey content staff update" ON storage.objects;
CREATE POLICY "journey content staff update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'journey-content' AND public.is_admin())
  WITH CHECK (bucket_id = 'journey-content' AND public.is_admin());
DROP POLICY IF EXISTS "journey content staff delete" ON storage.objects;
CREATE POLICY "journey content staff delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'journey-content' AND public.is_admin());

-- Persist every content field when the current draft is saved.
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
      resource_url, scheduled_at, release_at, completion_rule, required, position,
      month_number, cover_path, media_path, summary, topics, materials, access_scope,
      cohort_id, mentee_id
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
      coalesce((v_step->>'required')::boolean,true), v_position,
      coalesce((v_step->>'monthNumber')::integer, 1),
      nullif(v_step->>'coverPath',''), nullif(v_step->>'mediaPath',''),
      left(trim(coalesce(v_step->>'summary','')),4000),
      ARRAY(SELECT jsonb_array_elements_text(coalesce(v_step->'topics','[]'::jsonb))),
      coalesce(v_step->'materials','[]'::jsonb),
      coalesce(nullif(v_step->>'accessScope',''),'general'),
      nullif(v_step->>'cohortId','')::uuid, nullif(v_step->>'menteeId','')::uuid
    );
    v_position := v_position + 1;
  END LOOP;
  UPDATE public.journey_versions SET revision = revision + 1, updated_at = now()
  WHERE id = v_version.id RETURNING revision INTO p_expected_revision;
  INSERT INTO public.audit_log(actor_id, action, target, payload)
  VALUES (auth.uid(), 'journey_draft_saved', p_pillar_id::text, jsonb_build_object('steps',v_position));
  RETURN p_expected_revision;
END $$;

-- Publish creates a fresh editable copy including content metadata and scopes.
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
  IF EXISTS (SELECT 1 FROM public.journey_steps WHERE version_id = v_draft.id
    AND ((access_scope = 'cohort' AND cohort_id IS NULL)
      OR (access_scope = 'mentee' AND mentee_id IS NULL))) THEN
    RAISE EXCEPTION 'Defina o público de todos os conteúdos restritos.';
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
    release_at,completion_rule,required,position,month_number,cover_path,media_path,summary,
    topics,materials,access_scope,cohort_id,mentee_id
  ) SELECT v_new_draft,stable_key,title,format,impact_lead,impact_highlight,impact_tail,description,
    responsible_name,duration_minutes,resource_type,resource_id,resource_url,scheduled_at,
    release_at,completion_rule,required,position,month_number,cover_path,media_path,summary,
    topics,materials,access_scope,cohort_id,mentee_id
  FROM public.journey_steps WHERE version_id = v_draft.id ORDER BY position;
  INSERT INTO public.audit_log(actor_id,action,target,payload)
  VALUES (auth.uid(),'journey_published',p_pillar_id::text,
    jsonb_build_object('version',v_number,'applyActive',p_apply_active));
  RETURN v_draft.id;
END $$;

-- The home highlight uses the same audience rules as the library. Because this
-- function is SECURITY DEFINER, the scope predicates must live inside it.
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
      AND v.status IN ('published','archived')
    JOIN public.journey_steps s ON s.version_id = v.id AND s.archived_at IS NULL
    LEFT JOIN public.journey_step_progress pr ON pr.enrollment_id = e.id AND pr.step_key = s.stable_key
    LEFT JOIN LATERAL (
      SELECT mt.id,mt.scheduled_at,mt.join_url FROM public.meetings mt
      WHERE mt.enrollment_id = e.id
        AND s.format = 'individual_1_1'
        AND (mt.id::text = s.resource_id OR mt.lesson_id::text = s.resource_id)
      ORDER BY mt.scheduled_at DESC LIMIT 1
    ) m ON true
    WHERE s.required
      AND coalesce(pr.status,'not_started') <> 'completed'
      AND s.month_number <= e.current_month
      AND (
        s.access_scope = 'general'
        OR (s.access_scope = 'cohort' AND s.cohort_id = e.cohort_id)
        OR (s.access_scope = 'mentee' AND s.mentee_id = e.mentee_id)
      )
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
        WHEN coalesce(resource_url,resource_id,media_path,meeting_id::text) IS NULL THEN 'waiting_resource'
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
        WHEN format IN ('recorded_class','collective_recording','cohort_onboarding') THEN
          CASE WHEN progress_status='in_progress' THEN 'Continuar aula' ELSE 'Assistir à aula' END
        WHEN format = 'live_group' AND coalesce(resource_url,meeting_join_url) IS NOT NULL THEN 'Entrar no encontro'
        WHEN format = 'live_group' AND scheduled_at IS NOT NULL THEN 'Ver detalhes do encontro'
        WHEN format = 'individual_1_1' AND meeting_id IS NULL AND coalesce(resource_url,media_path) IS NULL THEN 'Agendar meu encontro'
        WHEN format = 'individual_1_1' AND meeting_join_url IS NULL THEN 'Ver meu encontro'
        WHEN format = 'individual_1_1' THEN 'Entrar no encontro'
        ELSE NULL END
    ) FROM candidates
  ) END
$$;

GRANT EXECUTE ON FUNCTION public.can_access_journey_step(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_access_journey_step(uuid) IS
  'Checks published version, enrollment, month, release date and general/cohort/mentee scope.';
