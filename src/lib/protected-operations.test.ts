import assert from "node:assert/strict";
import test from "node:test";
import { possibleAccessDuplicates, duplicatePhone } from "./access-duplicates";
import {
  proofHash,
  validProtectedScope,
} from "../../supabase/functions/_shared/protected-resources";
import { protectedOperations } from "../../supabase/functions/_shared/protected-operations";
const actor = "00000000-0000-4000-8000-000000000001";
const session = "00000000-0000-4000-8000-000000000002";
const target = "00000000-0000-4000-8000-000000000003";
const scope = { type: "content", id: target, operation: "delete" } as const;

test("duplicidades normalizam nome, acentos e WhatsApp com DDI sem unir cadastros", () => {
  const people = [
    {
      id: "a",
      name: "Ana Luíza Ribeiro",
      email: "ana@example.invalid",
      phone: "+55 (11) 99999-8888",
    },
    { id: "b", name: "ANA LUIZA RIBEIRO", email: "outra@example.invalid", phone: "11999998888" },
    { id: "c", name: "Pessoa diferente", email: "c@example.invalid", phone: "(00) 00000-0000" },
  ];
  const before = JSON.stringify(people),
    matches = possibleAccessDuplicates(people);
  assert.equal(matches.size, 2);
  assert.deepEqual(
    new Set(matches.get("a")?.map((x) => x.reason)),
    new Set(["Mesmo nome completo", "Mesmo WhatsApp ou telefone"]),
  );
  assert.equal(JSON.stringify(people), before);
  assert.equal(duplicatePhone("55 11 3333-4444"), "1133334444");
  assert.equal(duplicatePhone("00000000000"), "");
});
test("não marca a própria conta, nomes curtos, excluídos ou caixas de e-mail diferentes", () => {
  const matches = possibleAccessDuplicates([
    { id: "a", name: "Ana", email: "ana+teste@gmail.com" },
    { id: "a", name: "Ana", email: "ana+teste@gmail.com" },
    { id: "b", name: "Ana", email: "ana@gmail.com" },
    { id: "c", name: "Ana", email: "ana@gmail.com", archivedAt: "2026-11-07" },
  ]);
  assert.equal(matches.size, 0);
});
test("nomes muito parecidos só são comparados na mesma turma e com mesmo primeiro nome", () => {
  const a = {
    id: "a",
    name: "Ana Carolina Ribeiro",
    email: "a@example.invalid",
    cohortId: "turma-1",
  };
  const b = {
    id: "b",
    name: "Ana Caroline Ribeiro",
    email: "b@example.invalid",
    cohortId: "turma-1",
  };
  assert.equal(possibleAccessDuplicates([a, b]).size, 2);
  assert.equal(possibleAccessDuplicates([a, { ...b, cohortId: "turma-2" }]).size, 0);
  assert.equal(possibleAccessDuplicates([a, { ...b, name: "Eva Caroline Ribeiro" }]).size, 0);
});
test("escopo exige recurso conhecido, UUID e operação compatível", () => {
  assert.equal(validProtectedScope(scope), true);
  assert.equal(validProtectedScope({ type: "trash", id: target, operation: "restore" }), true);
  for (const invalid of [
    null,
    {},
    { type: "user_roles", id: target, operation: "delete" },
    { ...scope, id: "1;delete" },
    { ...scope, operation: "restore" },
    { type: "draft_step", id: target, operation: "delete" },
  ])
    assert.equal(validProtectedScope(invalid), false);
});
function fixture({
  allowed = true,
  attempt = true,
  passwordOK = true,
  otherUser = false,
  authThrows = false,
} = {}) {
  const events: Array<{ name: string; data?: unknown }> = [];
  const saved: Array<Record<string, unknown>> = [];
  const admin = {
    async rpc(name: string, data: unknown) {
      events.push({ name, data });
      return { error: null, data: name === "reserve_protected_attempt" ? attempt : allowed };
    },
    from(table: string) {
      return {
        delete() {
          return {
            async eq(column: string, value: string) {
              events.push({ name: "delete:" + table, data: { column, value } });
              return { error: null };
            },
          };
        },
        async insert(value: Record<string, unknown>) {
          saved.push(value);
          return { error: null };
        },
      };
    },
  };
  const verifier = {
    auth: {
      async signInWithPassword(data: unknown) {
        events.push({ name: "verify", data });
        if (authThrows) throw new Error("detalhe-sensivel-do-provedor");
        return {
          error: passwordOK ? null : { message: "detalhe-sensivel-do-provedor" },
          data: {
            user: { id: otherUser ? target : actor },
            session: passwordOK ? { access_token: "nao-retornar" } : null,
          },
        };
      },
      async signOut(data: unknown) {
        events.push({ name: "signOut", data });
        return { error: null };
      },
    },
  };
  const jwt = [
    "e30",
    Buffer.from(JSON.stringify({ session_id: session })).toString("base64url"),
    "assinatura",
  ].join(".");
  const service = protectedOperations(
    {
      userId: actor,
      user: { email: "ana@example.invalid" },
      admin,
      request: new Request("https://example.invalid", {
        headers: { Authorization: "Bearer " + jwt },
      }),
    },
    () => verifier,
  );
  return { service, events, saved };
}
test("senha incorreta não cria confirmação e não devolve detalhes de autenticação", async () => {
  const f = fixture({ passwordOK: false });
  await assert.rejects(
    f.service.authorize({ scope, email: "ana@example.invalid", password: "senha-so-do-teste" }),
    (error) => {
      assert.match((error as Error).message, /E-mail ou senha/);
      assert.doesNotMatch((error as Error).message, /detalhe-sensivel/);
      return true;
    },
  );
  assert.equal(f.saved.length, 0);
  assert.deepEqual(f.events.find((x) => x.name === "signOut")?.data, { scope: "local" });
});
test("sessão revogada, limite atingido e e-mail de outra conta falham antes de testar a senha", async () => {
  for (const config of [{ allowed: false }, { attempt: false }, {}]) {
    const f = fixture(config);
    await assert.rejects(
      f.service.authorize({
        scope,
        email:
          config.allowed === false || config.attempt === false
            ? "ana@example.invalid"
            : "outra@example.invalid",
        password: "teste",
      }),
    );
    assert.equal(
      f.events.some((x) => x.name === "verify"),
      false,
    );
    assert.equal(f.saved.length, 0);
  }
});
test("identidade de outra pessoa e falha do provedor não emitem confirmação", async () => {
  for (const config of [{ otherUser: true }, { authThrows: true }]) {
    const f = fixture(config);
    await assert.rejects(
      f.service.authorize({ scope, email: "ana@example.invalid", password: "teste" }),
      (error) => {
        assert.doesNotMatch((error as Error).message, /detalhe-sensivel/);
        return true;
      },
    );
    assert.equal(f.saved.length, 0);
  }
});
test("confirmação salva somente hash, sessão e recurso; descarta sessão temporária local", async () => {
  const f = fixture(),
    response = await f.service.authorize({
      scope,
      email: "ANA@example.invalid",
      password: "senha-so-do-teste",
    });
  assert.match(response.proof, /^[a-f0-9]{64}$/);
  assert.equal(f.saved[0]?.["token_hash"], await proofHash(response.proof));
  assert.equal(f.saved[0]?.["session_id"], session);
  assert.equal(f.saved[0]?.["resource_id"], target);
  assert.equal(f.saved[0]?.["resource_type"], "content");
  assert.equal(f.saved[0]?.["user_id"], actor);
  assert.equal(JSON.stringify(f.saved).includes("senha-so-do-teste"), false);
  assert.equal(JSON.stringify(response).includes("nao-retornar"), false);
  assert.deepEqual(f.events.find((x) => x.name === "signOut")?.data, { scope: "local" });
});
