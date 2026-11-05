-- Lembrete de encontro também para a mentora responsável (liga/desliga próprio).
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS enabled_meeting_reminder_mentor boolean NOT NULL DEFAULT false;

GRANT UPDATE (enabled_meeting_reminder_mentor) ON public.whatsapp_settings TO authenticated;

ALTER TABLE public.whatsapp_notifications
  DROP CONSTRAINT IF EXISTS whatsapp_notifications_event_type_check;

ALTER TABLE public.whatsapp_notifications
  ADD CONSTRAINT whatsapp_notifications_event_type_check CHECK (event_type IN (
    'account_created',
    'meeting_reminder',
    'meeting_reminder_mentor',
    'stage_released',
    'stage_completed_mentee',
    'stage_completed_mentor'
  ));
