import assert from "node:assert/strict";
import test from "node:test";
import { handleR2TrashRoute } from "../../infra/r2-trash-route";
import { readCleanupReceipt } from "../../supabase/functions/_shared/cleanup-receipt";
import { purgeTrash } from "../../supabase/functions/_shared/trash-purge";
import { proofHash } from "../../supabase/functions/_shared/protected-resources";
const jobId = "00000000-0000-4000-8000-000000000001",
  token = "a".repeat(64);
const request = (data: unknown, path = "/trash/purge") =>
  new Request("https://worker.example.invalid" + path, {
    method: "POST",
    body: JSON.stringify(data),
  });

test("Worker bloqueia exclusão antiga e exige recibo válido sem tocar no R2", async () => {
  let touched = 0;
  const bucket = {
    async delete() {
      touched++;
    },
  };
  const fetcher = (async () => {
    touched++;
    return Response.json({});
  }) as typeof fetch;
  assert.equal(
    (await handleR2TrashRoute(request({}, "/object/delete"), bucket, fetcher))?.status,
    409,
  );
  assert.equal(
    (await handleR2TrashRoute(request({ jobId, token: "inválido" }), bucket, fetcher))?.status,
    400,
  );
  assert.equal(
    (await handleR2TrashRoute(request({ jobId, token, extra: "a".repeat(4096) }), bucket, fetcher))
      ?.status,
    413,
  );
  assert.equal(await handleR2TrashRoute(request({}, "/upload/start"), bucket, fetcher), null);
  assert.equal(touched, 0);
});
test("Worker só apaga a chave autorizada pelo servidor e recusa recibo vencido", async () => {
  const deleted: string[] = [];
  const bucket = {
    async delete(key: string) {
      deleted.push(key);
    },
  };
  const fetcher = (async (_url: unknown, options: RequestInit) => {
    assert.deepEqual(JSON.parse(String(options.body)), { jobId, token });
    return Response.json({ key: "exclusivo/expirado.mp4" });
  }) as typeof fetch;
  assert.equal(
    (
      await handleR2TrashRoute(
        request({ jobId, token, key: "outro/nao-apagar.mp4" }),
        bucket,
        fetcher,
      )
    )?.status,
    200,
  );
  assert.deepEqual(deleted, ["exclusivo/expirado.mp4"]);
  assert.equal(
    (
      await handleR2TrashRoute(
        request({ jobId, token }),
        bucket,
        (async () => new Response(null, { status: 403 })) as typeof fetch,
      )
    )?.status,
    403,
  );
  assert.equal(deleted.length, 1);
});
test("falha na autorização ou no R2 não confirma a limpeza", async () => {
  const bucket = {
    async delete() {
      throw new Error("indisponível");
    },
  };
  assert.equal(
    (
      await handleR2TrashRoute(request({ jobId, token }), bucket, (async () =>
        Response.json({ key: "video.mp4" })) as typeof fetch)
    )?.status,
    503,
  );
  assert.equal(
    (
      await handleR2TrashRoute(request({ jobId, token }), bucket, (async () =>
        Response.json({})) as typeof fetch)
    )?.status,
    403,
  );
});
test("recibo de limpeza limita o corpo e devolve somente hash", async () => {
  assert.deepEqual(await readCleanupReceipt(request({ jobId, token })), {
    jobId,
    tokenHash: await proofHash(token),
  });
  for (const data of [
    { jobId, token: "inválido" },
    { jobId: "inválido", token },
    { jobId, token, extra: "x".repeat(4096) },
    null,
  ]) {
    await assert.rejects(() => readCleanupReceipt(request(data)));
  }
});
function cleanupFixture(fail = false) {
  const jobs = [
    { shared: true },
    { id: jobId, provider: "storage", bucket: "materials", path: "a.pdf" },
    { id: jobId, provider: "r2", path: "r2.mp4" },
    null,
  ];
  const updates: Record<string, unknown>[] = [],
    removed: unknown[] = [];
  const admin = {
    async rpc(name: string) {
      return {
        error: null,
        data: name === "purge_expired_trash" ? { purged: 2, failed: 0 } : jobs.shift(),
      };
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            removed.push({ bucket, paths });
            return { error: null };
          },
        };
      },
    },
    from() {
      return {
        update(data: Record<string, unknown>) {
          updates.push(data);
          const builder = {
            eq(_key: string, _value: unknown) {
              return builder;
            },
            then(resolve: (result: unknown) => void) {
              resolve({ error: null });
            },
          };
          return builder;
        },
      };
    },
  };
  const fetcher = (async (_url: unknown, options: RequestInit) => {
    const receipt = JSON.parse(String(options.body));
    assert.equal(receipt.jobId, jobId);
    assert.match(receipt.token, /^[a-f0-9]{64}$/);
    return new Response(null, { status: fail ? 503 : 200 });
  }) as typeof fetch;
  return { admin, fetcher, updates, removed };
}
test("limpeza preserva compartilhados e usa a API de Storage para arquivos exclusivos", async () => {
  const f = cleanupFixture();
  const result = await purgeTrash(f.admin, "https://example.invalid", f.fetcher, () => 1000);
  assert.deepEqual(result, {
    purged: 2,
    failed: 0,
    assetsDeleted: 2,
    assetsShared: 1,
    assetsFailed: 0,
  });
  assert.deepEqual(f.removed, [{ bucket: "materials", paths: ["a.pdf"] }]);
  assert.equal(f.updates.length, 2);
  assert.ok(f.updates.every((x) => x["completed_at"] && x["token_hash"] === null));
});
test("erro de R2 mantém tarefa pendente e agenda nova tentativa sem confirmar exclusão", async () => {
  const f = cleanupFixture(true);
  const result = await purgeTrash(f.admin, "https://example.invalid", f.fetcher, () => 1000);
  assert.equal(result.assetsFailed, 1);
  assert.equal(result.assetsDeleted, 1);
  const retry = f.updates.at(-1)!;
  assert.equal(retry["completed_at"], undefined);
  assert.equal(retry["lease_until"], new Date(901000).toISOString());
  assert.equal(retry["token_hash"], null);
});
