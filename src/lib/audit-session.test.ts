import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { syncSessionCache, isSessionCacheOwner } from "./session-cache";
import { requireApprovedAccount } from "../../supabase/functions/_shared/approved-access.ts";

test("troca de conta e saída removem cache privado e bloqueiam conclusões da conta anterior", () => {
  const client = new QueryClient();
  syncSessionCache(client, "a");
  client.setQueryData(["my-profile"], { id: "a", name: "Conta anterior" });
  client.setQueryData(["journey-content-library"], { enrollmentId: "a" });
  syncSessionCache(client, "b");
  assert.equal(client.getQueryData(["my-profile"]), undefined);
  assert.equal(client.getQueryData(["journey-content-library"]), undefined);
  assert.equal(isSessionCacheOwner(client, "a"), false);
  assert.equal(isSessionCacheOwner(client, "b"), true);
  client.setQueryData(["my-profile"], { id: "b" });
  syncSessionCache(client, null);
  assert.equal(client.getQueryData(["my-profile"]), undefined);
  client.clear();
});

test("renovação da mesma conta preserva cache e clientes distintos ficam isolados", () => {
  const a = new QueryClient(),
    b = new QueryClient();
  syncSessionCache(a, "a");
  syncSessionCache(b, "b");
  a.setQueryData(["trail"], { own: "a" });
  b.setQueryData(["trail"], { own: "b" });
  syncSessionCache(a, "a");
  assert.deepEqual(a.getQueryData(["trail"]), { own: "a" });
  syncSessionCache(a, null);
  assert.deepEqual(b.getQueryData(["trail"]), { own: "b" });
  a.clear();
  b.clear();
});

test("consulta antiga resolvida depois da troca não repovoa o cache", async () => {
  const client = new QueryClient();
  syncSessionCache(client, "a");
  let resolve!: (v: string) => void;
  const old = client
    .fetchQuery({
      queryKey: ["trail"],
      queryFn: () =>
        new Promise<string>((r) => {
          resolve = r;
        }),
    })
    .catch(() => null);
  syncSessionCache(client, "b");
  resolve("dados da conta a");
  await old;
  assert.equal(client.getQueryData(["trail"]), undefined);
  client.clear();
});

function accountDb(data: unknown, error: unknown = null) {
  return {
    rpc: async (name: string) => {
      assert.equal(name, "has_platform_access");
      return { data, error };
    },
  };
}

test("acesso aprovado é consultado na RPC do próprio usuário", async () => {
  await requireApprovedAccount(accountDb(true));
});

test("sessão ainda válida não libera conta revogada, arquivada ou sem convite", async () => {
  for (const data of [null, false, "true", { status: "approved" }])
    await assert.rejects(requireApprovedAccount(accountDb(data)), /Acesso restrito/);
});

test("falha de consulta de acesso impede a ação sem classificá-la como revogação", async () => {
  await assert.rejects(
    requireApprovedAccount(accountDb(null, { message: "indisponível" })),
    /Não foi possível verificar/,
  );
});
