-- Janela de envio do WhatsApp (horário comercial, fuso de São Paulo).
-- O público da RISE NOW é CLT: mensagens só saem de seg a sex, das 09:00 às 17:00.
-- Fora da janela, avisos ficam na fila (send_after) e saem na próxima abertura;
-- lembretes com hora marcada não são enviados fora da janela.
-- digest_line permite juntar vários avisos para a mesma mentora em uma só mensagem.

ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS send_window_start text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS send_window_end text NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS send_window_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}';

ALTER TABLE public.whatsapp_settings
  DROP CONSTRAINT IF EXISTS whatsapp_settings_send_window_check;
ALTER TABLE public.whatsapp_settings
  ADD CONSTRAINT whatsapp_settings_send_window_check CHECK (
    send_window_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND send_window_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND send_window_start < send_window_end
    AND cardinality(send_window_days) BETWEEN 1 AND 7
    AND send_window_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  );

UPDATE public.whatsapp_settings
SET send_window_start = '09:00', send_window_end = '17:00', send_window_days = '{1,2,3,4,5}'
WHERE id = 'primary';

ALTER TABLE public.whatsapp_notifications
  ADD COLUMN IF NOT EXISTS send_after timestamptz,
  ADD COLUMN IF NOT EXISTS digest_line text CHECK (digest_line IS NULL OR char_length(digest_line) <= 300);

COMMENT ON COLUMN public.whatsapp_notifications.send_after IS
  'Não enviar antes deste instante (aviso criado fora do horário comercial).';
COMMENT ON COLUMN public.whatsapp_notifications.digest_line IS
  'Linha curta usada quando vários avisos da mesma pessoa saem juntos em um resumo.';

CREATE INDEX IF NOT EXISTS whatsapp_notifications_pending_send_idx
  ON public.whatsapp_notifications (status, send_after, created_at)
  WHERE status = 'pending';
