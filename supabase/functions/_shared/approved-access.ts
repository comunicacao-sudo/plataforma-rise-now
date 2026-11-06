/** Toda ação autenticada exige acesso ainda aprovado, inclusive com JWT não expirado. */
export async function requireApprovedAccount(db: any) {
  const { data, error } = await db.rpc("has_platform_access");
  if (error) throw new Error("Não foi possível verificar seu acesso. Tente novamente.");
  if (data !== true)
    throw new Error("Acesso restrito: seu acesso à RISE não está ativo. Procure a equipe.");
}
