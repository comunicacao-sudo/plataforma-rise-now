-- Transactional WhatsApp configuration and delivery audit trail.
-- WAHA credentials stay in server environment variables and are never stored
-- in these tables or exposed to authenticated browser clients.

CREATE TABLE public.whatsapp_settings (
  id text PRIMARY KEY DEFAULT 'primary' CHECK (id = 'primary'),
  session_name text NOT NULL DEFAULT 'rise-principal' CHECK (session_name = 'rise-principal'),
  engine text NOT NULL DEFAULT 'GOWS' CHECK (engine = 'GOWS'),
  enabled_account_created boolean NOT NULL DEFAULT false,
  enabled_meeting_reminder boolean NOT NULL DEFAULT false,
  enabled_stage_released boolean NOT NULL DEFAULT false,
  enabled_stage_completed_mentee boolean NOT NULL DEFAULT false,
  enabled_stage_completed_mentor boolean NOT NULL DEFAULT false,
  meeting_reminder_hours integer NOT NULL DEFAULT 24
    CHECK (meeting_reminder_hours BETWEEN 1 AND 168),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.whatsapp_settings (id)
VALUES ('primary')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  recipient_role text NOT NULL CHECK (recipient_role IN ('admin', 'mentor', 'mentee')),
  phone text,
  event_type text NOT NULL CHECK (event_type IN (
    'account_created',
    'meeting_reminder',
    'stage_released',
    'stage_completed_mentee',
    'stage_completed_mentor'
  )),
  reference_type text,
  reference_id text,
  message text NOT NULL,
  target_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'failed',
    'delivered',
    'read'
  )),
  provider_message_id text,
  idempotency_key text NOT NULL UNIQUE,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_notifications_status_created_idx
  ON public.whatsapp_notifications (status, created_at DESC);

CREATE INDEX whatsapp_notifications_recipient_created_idx
  ON public.whatsapp_notifications (recipient_user_id, created_at DESC);

CREATE INDEX whatsapp_notifications_reference_idx
  ON public.whatsapp_notifications (event_type, reference_type, reference_id);

CREATE OR REPLACE FUNCTION public.set_whatsapp_settings_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_whatsapp_notification_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_whatsapp_settings_audit_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_whatsapp_notification_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER whatsapp_settings_set_updated_at
BEFORE UPDATE ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_settings_audit_fields();

CREATE TRIGGER whatsapp_notifications_set_updated_at
BEFORE UPDATE ON public.whatsapp_notifications
FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_notification_updated_at();

GRANT SELECT ON public.whatsapp_settings TO authenticated;
GRANT UPDATE (
  enabled_account_created,
  enabled_meeting_reminder,
  enabled_stage_released,
  enabled_stage_completed_mentee,
  enabled_stage_completed_mentor,
  meeting_reminder_hours
) ON public.whatsapp_settings TO authenticated;
GRANT ALL ON public.whatsapp_settings TO service_role;

GRANT SELECT ON public.whatsapp_notifications TO authenticated;
GRANT ALL ON public.whatsapp_notifications TO service_role;

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read whatsapp settings"
  ON public.whatsapp_settings FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "admins update whatsapp settings"
  ON public.whatsapp_settings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "service role manages whatsapp settings"
  ON public.whatsapp_settings FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "admins read whatsapp notifications"
  ON public.whatsapp_notifications FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "service role manages whatsapp notifications"
  ON public.whatsapp_notifications FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
