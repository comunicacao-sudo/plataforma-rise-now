-- Automações de WhatsApp configuráveis pelo painel (gatilho + público + texto),
-- envio para o grupo da RISE e agendamento a cada 5 minutos.
-- As automações iniciais são criadas pelo rise-backend na primeira abertura do painel.

ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS group_chat_id text,
  ADD COLUMN IF NOT EXISTS group_name text;

ALTER TABLE public.whatsapp_settings
  DROP CONSTRAINT IF EXISTS whatsapp_settings_group_chat_id_check;
ALTER TABLE public.whatsapp_settings
  ADD CONSTRAINT whatsapp_settings_group_chat_id_check
  CHECK (group_chat_id IS NULL OR group_chat_id ~ '^[0-9-]+@g\.us$');

CREATE TABLE IF NOT EXISTS public.whatsapp_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_key text UNIQUE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
  trigger text NOT NULL CHECK (trigger IN (
    'weekly_schedule', 'group_meeting_before', 'booking_slots_available', 'booking_before',
    'booking_confirmed', 'questionnaire_submitted', 'assessment_completed', 'goal_created',
    'stage_completed', 'account_created'
  )),
  audience text NOT NULL CHECK (audience IN ('group', 'mentees', 'mentor', 'staff', 'member')),
  offset_minutes integer NOT NULL DEFAULT 0 CHECK (offset_minutes BETWEEN 0 AND 20160),
  weekday smallint CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  send_time text CHECK (send_time IS NULL OR send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  template text NOT NULL CHECK (char_length(template) BETWEEN 1 AND 1500),
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  last_run_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_automations FROM anon, authenticated;
GRANT ALL ON public.whatsapp_automations TO service_role;
DROP POLICY IF EXISTS "backend only automations" ON public.whatsapp_automations;
CREATE POLICY "backend only automations" ON public.whatsapp_automations
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.whatsapp_notifications
  ADD COLUMN IF NOT EXISTS chat_id text,
  ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES public.whatsapp_automations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS whatsapp_notifications_automation_idx
  ON public.whatsapp_notifications (automation_id, created_at DESC);

ALTER TABLE public.whatsapp_notifications
  DROP CONSTRAINT IF EXISTS whatsapp_notifications_event_type_check;
ALTER TABLE public.whatsapp_notifications
  ADD CONSTRAINT whatsapp_notifications_event_type_check CHECK (event_type IN (
    'account_created', 'meeting_reminder', 'meeting_reminder_mentor', 'stage_released',
    'stage_completed_mentee', 'stage_completed_mentor', 'automation'
  ));

ALTER TABLE public.whatsapp_notifications
  DROP CONSTRAINT IF EXISTS whatsapp_notifications_recipient_role_check;
ALTER TABLE public.whatsapp_notifications
  ADD CONSTRAINT whatsapp_notifications_recipient_role_check
  CHECK (recipient_role IN ('admin', 'mentor', 'mentee', 'group'));

-- Lembretes "1 hora antes" e "na hora" precisam de verificação mais frequente.
SELECT cron.alter_job(jobid, schedule := '*/5 * * * *')
FROM cron.job WHERE jobname = 'rise-whatsapp-notificacoes';
