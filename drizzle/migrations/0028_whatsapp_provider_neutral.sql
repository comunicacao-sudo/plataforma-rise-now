-- Keep notification preferences and history while removing the retired GOWS contract.
ALTER TABLE public.whatsapp_settings
  DROP CONSTRAINT IF EXISTS whatsapp_settings_engine_check,
  DROP CONSTRAINT IF EXISTS whatsapp_settings_session_name_check;

ALTER TABLE public.whatsapp_settings
  ALTER COLUMN engine SET DEFAULT 'unconfigured';

UPDATE public.whatsapp_settings
SET
  engine = 'unconfigured',
  enabled_account_created = false,
  enabled_meeting_reminder = false,
  enabled_stage_released = false,
  enabled_stage_completed_mentee = false,
  enabled_stage_completed_mentor = false,
  updated_at = now()
WHERE id = 'primary';

COMMENT ON COLUMN public.whatsapp_settings.engine IS
  'Provider-neutral integration identifier. The value unconfigured means no WhatsApp provider is active.';
