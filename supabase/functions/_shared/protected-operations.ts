// @ts-nocheck
import { mediaSessionId } from "./video-media.ts";
import { proofHash, validProtectedScope } from "./protected-resources.ts";

const operationError = (error: any) =>
  new Error(
    error?.code === "P0001"
      ? error.message
      : "Não foi possível concluir a operação protegida. Tente novamente.",
  );
export function protectedOperations(c: any, credentialClient: () => any) {
  const session = () => mediaSessionId(c.request.headers.get("Authorization") ?? "");
  async function authorize(d: any) {
    if (!validProtectedScope(d.scope)) throw new Error("Operação inválida.");
    const sessionId = session();
    const allowed = await c.admin.rpc("check_protected_operation", {
      p_user: c.userId,
      p_session: sessionId,
      p_type: d.scope.type,
      p_id: d.scope.id,
      p_operation: d.scope.operation,
    });
    if (allowed.error || allowed.data !== true)
      throw new Error("Sua sessão expirou ou você não pode alterar este registro.");
    const attempt = await c.admin.rpc("reserve_protected_attempt", {
      p_user: c.userId,
      p_session: sessionId,
    });
    if (attempt.error || attempt.data !== true)
      throw new Error("Limite de tentativas atingido. Aguarde 15 minutos.");
    if (
      typeof d.email !== "string" ||
      typeof d.password !== "string" ||
      !d.password ||
      d.password.length > 1024 ||
      d.email.trim().toLowerCase() !== String(c.user.email ?? "").toLowerCase()
    )
      throw new Error("E-mail ou senha incorretos. Use a conta que está conectada.");
    const verifier = credentialClient();
    let verified = false;
    try {
      const response = await verifier.auth.signInWithPassword({
        email: c.user.email,
        password: d.password,
      });
      verified =
        !response.error && response.data?.user?.id === c.userId && !!response.data?.session;
    } catch {
      throw new Error("Não foi possível confirmar sua identidade. Tente novamente.");
    } finally {
      // A sessão temporária é descartada sem encerrar a sessão original nem outros aparelhos.
      await verifier.auth.signOut({ scope: "local" }).catch(() => null);
    }
    if (!verified) throw new Error("E-mail ou senha incorretos. Use a conta que está conectada.");
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
    const removed = await c.admin
      .from("protected_operation_proofs")
      .delete()
      .eq("user_id", c.userId);
    if (removed.error) throw new Error("Não foi possível preparar a confirmação.");
    const saved = await c.admin.from("protected_operation_proofs").insert({
      token_hash: await proofHash(token),
      user_id: c.userId,
      session_id: sessionId,
      resource_type: d.scope.type,
      resource_id: d.scope.id,
      operation: d.scope.operation,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
    });
    if (saved.error) throw new Error("Não foi possível preparar a confirmação.");
    await c.admin.from("protected_operation_attempts").delete().eq("user_id", c.userId);
    return { proof: token };
  }
  async function trash(d: any) {
    const scope = { type: d.type, id: d.id, operation: "delete" };
    if (!validProtectedScope(scope) || scope.type === "draft")
      throw new Error("Operação inválida.");
    const result = await c.admin.rpc("move_resource_to_trash", {
      p_user: c.userId,
      p_session: session(),
      p_type: scope.type,
      p_id: scope.id,
      p_hash: await proofHash(d.proof ?? ""),
    });
    if (result.error) throw operationError(result.error);
    return { ok: true, trashId: result.data };
  }
  async function restore(d: any) {
    const scope = { type: "trash", id: d.id, operation: "restore" };
    if (!validProtectedScope(scope)) throw new Error("Operação inválida.");
    const hash = await proofHash(d.proof ?? "");
    const result = await c.admin.rpc("restore_trash_resource", {
      p_user: c.userId,
      p_session: session(),
      p_id: d.id,
      p_hash: hash,
    });
    if (result.error) throw operationError(result.error);
    return { ok: true, message: result.data };
  }
  async function list(d: any) {
    const result = await c.admin.rpc("list_protected_trash", {
      p_user: c.userId,
      p_session: session(),
      p_offset: Math.max(0, Math.floor(Number(d?.offset) || 0)),
    });
    if (result.error) throw operationError(result.error);
    return result.data;
  }
  return { authorize, trash, restore, list };
}
