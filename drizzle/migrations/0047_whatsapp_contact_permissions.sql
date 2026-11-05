-- Autorizações são registradas pela equipe; números existentes não ganham aceite automático.
CREATE TABLE IF NOT EXISTS public.whatsapp_contact_permissions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text CHECK (phone IS NULL OR phone ~ '^55[1-9][0-9][2-9][0-9]{7,8}$'),
  authorized boolean NOT NULL DEFAULT false,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT authorized OR phone IS NOT NULL)
);
ALTER TABLE public.whatsapp_contact_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_contact_permissions FROM anon, authenticated;
GRANT ALL ON public.whatsapp_contact_permissions TO service_role;

CREATE TABLE IF NOT EXISTS public.whatsapp_contact_permission_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  authorized boolean NOT NULL,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_contact_permission_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_contact_permission_history FROM anon, authenticated;
GRANT ALL ON public.whatsapp_contact_permission_history TO service_role;
CREATE INDEX IF NOT EXISTS whatsapp_contact_permission_history_user_idx
  ON public.whatsapp_contact_permission_history(user_id, recorded_at DESC);

-- Telefone, autorização e histórico são gravados na mesma transação.
CREATE OR REPLACE FUNCTION public.record_whatsapp_permission(
  p_user_id uuid, p_phone text, p_authorized boolean, p_actor_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor_id AND role IN ('admin','mentor')) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe RISE NOW.';
  END IF;
  IF p_phone IS NOT NULL AND p_phone !~ '^55[1-9][0-9][2-9][0-9]{7,8}$' THEN
    RAISE EXCEPTION 'Telefone inválido.';
  END IF;
  IF p_authorized AND p_phone IS NULL THEN RAISE EXCEPTION 'Informe o telefone autorizado.'; END IF;
  UPDATE public.profiles SET phone = p_phone WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa não encontrada.'; END IF;
  INSERT INTO public.whatsapp_contact_permissions(user_id,phone,authorized,recorded_by,recorded_at)
  VALUES(p_user_id,p_phone,p_authorized,p_actor_id,now())
  ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,authorized=excluded.authorized,
    recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at;
  INSERT INTO public.whatsapp_contact_permission_history(user_id,phone,authorized,recorded_by)
  VALUES(p_user_id,p_phone,p_authorized,p_actor_id);
  IF NOT p_authorized THEN
    UPDATE public.whatsapp_notifications SET status='failed', error_message='Envio bloqueado: autorização de WhatsApp retirada.'
    WHERE recipient_user_id=p_user_id AND status='pending';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_whatsapp_permission(uuid,text,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_permission(uuid,text,boolean,uuid) TO service_role;
