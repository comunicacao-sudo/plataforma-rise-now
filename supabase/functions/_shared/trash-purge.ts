// @ts-nocheck
import { proofHash } from "./protected-resources.ts";
/** Um recibo limitado ao objeto vencido substitui credenciais permanentes no Worker. */
export async function purgeTrash(
  admin: any,
  storageOrigin: string,
  fetcher = fetch,
  now = Date.now,
) {
  const records = await admin.rpc("purge_expired_trash", { p_storage_origin: storageOrigin });
  if (records.error) throw new Error("Não foi possível executar a retenção da lixeira.");
  const deadline = now() + 15_000;
  let assetsDeleted = 0,
    assetsShared = 0,
    assetsFailed = 0;
  for (let index = 0; index < 10 && now() < deadline; index++) {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x: number) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
    const tokenHash = await proofHash(token);
    const claimed = await admin.rpc("claim_trash_asset", { p_token_hash: tokenHash });
    if (claimed.error) throw new Error("Não foi possível conferir os arquivos vencidos.");
    const item = claimed.data;
    if (!item) break;
    if (item.shared) {
      assetsShared++;
      continue;
    }
    try {
      if (item.provider === "storage") {
        const removed = await admin.storage.from(item.bucket).remove([item.path]);
        if (removed.error) throw new Error("storage_cleanup_failed");
      } else if (item.provider === "r2") {
        const response = await fetcher(
          "https://rise-now-r2.rise-now-pamaris.workers.dev/trash/purge",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: item.id, token }),
            signal: AbortSignal.timeout(5_000),
          },
        );
        if (!response.ok) throw new Error("r2_cleanup_failed");
      } else throw new Error("unknown_asset_provider");
      const done = await admin
        .from("trash_asset_cleanup")
        .update({
          completed_at: new Date(now()).toISOString(),
          token_hash: null,
          lease_until: null,
          last_error: null,
        })
        .eq("id", item.id)
        .eq("token_hash", tokenHash);
      if (done.error) throw new Error("cleanup_receipt_failed");
      assetsDeleted++;
    } catch {
      assetsFailed++;
      const saved = await admin
        .from("trash_asset_cleanup")
        .update({
          last_error:
            "Não foi possível concluir a limpeza. Uma nova tentativa será feita automaticamente.",
          token_hash: null,
          lease_until: new Date(now() + 15 * 60_000).toISOString(),
        })
        .eq("id", item.id)
        .eq("token_hash", tokenHash);
      if (saved.error) throw new Error("Não foi possível registrar a nova tentativa de limpeza.");
    }
  }
  return { ...records.data, assetsDeleted, assetsShared, assetsFailed };
}
