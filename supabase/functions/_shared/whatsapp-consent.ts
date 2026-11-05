/** A autorização é válida somente para o número que foi confirmado pela equipe. */
export function isWhatsAppAuthorized(
  consent: { authorized?: boolean; phone?: string | null } | null | undefined,
  phone: string | null | undefined,
) {
  return !!phone && consent?.authorized === true && consent.phone === phone;
}

export async function authorizedWhatsAppPhone(
  admin: any,
  userId: string | null,
  phone: string | null,
) {
  if (!userId || !phone) return false;
  const { data, error } = await admin
    .from("whatsapp_contact_permissions")
    .select("authorized, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível conferir a autorização de WhatsApp.");
  if (!isWhatsAppAuthorized(data, phone)) return false;
  const profile = await admin.from("profiles").select("phone").eq("id", userId).single();
  if (profile.error) throw new Error("Não foi possível conferir o telefone atual.");
  let currentPhone = String(profile.data.phone ?? "").replace(/\D/g, "");
  if (currentPhone.length === 10 || currentPhone.length === 11) currentPhone = `55${currentPhone}`;
  return currentPhone === phone;
}
