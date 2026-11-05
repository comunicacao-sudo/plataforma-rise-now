-- Textos das notificações de WhatsApp editáveis pelo painel admin.
-- Chaves: account_created, meeting_reminder, stage_released,
-- stage_completed_mentee, stage_completed_mentor. Chave ausente = texto padrão.
-- A gravação acontece só pela Edge Function (service_role), que valida o conteúdo.
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS message_templates jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.whatsapp_settings
  DROP CONSTRAINT IF EXISTS whatsapp_settings_message_templates_check;

ALTER TABLE public.whatsapp_settings
  ADD CONSTRAINT whatsapp_settings_message_templates_check
  CHECK (jsonb_typeof(message_templates) = 'object');

COMMENT ON COLUMN public.whatsapp_settings.message_templates IS
  'Textos personalizados por evento, com variáveis como {nome}, {etapa}, {data} e {link}.';
