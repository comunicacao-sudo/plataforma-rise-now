export const protectedResources = {
  access: "Acesso",
  cohort: "Turma",
  content: "Conteúdo da jornada",
  material: "Material",
  automation: "Automação de WhatsApp",
  meeting: "Encontro",
  offering: "Disponibilidade 1:1",
  goal: "Meta RISE 90",
  milestone: "Marco RISE 90",
  draft: "Etapas do rascunho",
  draft_step: "Etapa do rascunho",
  trash: "Item da lixeira",
} as const;
export type ProtectedResource = keyof typeof protectedResources;
export type ProtectedScope = {
  type: ProtectedResource;
  id: string;
  operation: "delete" | "restore";
};
export function validProtectedScope(value: unknown): value is ProtectedScope {
  if (!value || typeof value !== "object") return false;
  const input = value as ProtectedScope;
  return (
    Object.hasOwn(protectedResources, input.type) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id) &&
    (input.type === "trash"
      ? input.operation === "restore"
      : input.type !== "draft_step" && input.operation === "delete")
  );
}
export async function proofHash(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new Error("Confirme seu e-mail e senha para esta operação.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}
