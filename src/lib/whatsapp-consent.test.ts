import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizedWhatsAppPhone,
  isWhatsAppAuthorized,
} from "../../supabase/functions/_shared/whatsapp-consent.ts";
import {
  deliverNotification,
  enqueueNotification,
} from "../../supabase/functions/_shared/whatsapp-gateway.ts";

test("nega envio sem autorização, inclusive para números cadastrados", () => {
  assert.equal(isWhatsAppAuthorized(null, "5511999999999"), false);
  assert.equal(
    isWhatsAppAuthorized({ authorized: false, phone: "5511999999999" }, "5511999999999"),
    false,
  );
});
test("autoriza somente o número confirmado e bloqueia troca de telefone", () => {
  const consent = { authorized: true, phone: "5511999999999" };
  assert.equal(isWhatsAppAuthorized(consent, "5511999999999"), true);
  assert.equal(isWhatsAppAuthorized(consent, "5511888888888"), false);
  assert.equal(isWhatsAppAuthorized(consent, null), false);
});
test("retirada da autorização bloqueia o telefone anteriormente autorizado", () => {
  assert.equal(
    isWhatsAppAuthorized({ authorized: false, phone: "5511999999999" }, "5511999999999"),
    false,
  );
});

function fakeAdmin(
  consent: { authorized: boolean; phone: string } | null,
  currentPhone = "5511999999999",
) {
  const writes: Array<{ table: string; value: unknown }> = [];
  const admin = {
    from(table: string) {
      const result = () => ({
        data:
          table === "whatsapp_contact_permissions"
            ? consent
            : table === "profiles"
              ? { phone: currentPhone }
              : { recipient_user_id: "pessoa" },
        error: null,
      });
      const chain = {
        select: (_value?: string) => chain,
        eq: (_key: string, _value: unknown) => chain,
        maybeSingle: async () => result(),
        single: async () => result(),
        update: (value: unknown) => {
          writes.push({ table, value });
          return chain;
        },
        insert: (value: unknown) => {
          writes.push({ table, value });
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
  };
  return { admin, writes };
}

test("trocar o telefone no perfil invalida o aceite anterior no servidor", async () => {
  const { admin } = fakeAdmin({ authorized: true, phone: "5511999999999" }, "5511888888888");
  assert.equal(await authorizedWhatsAppPhone(admin, "pessoa", "5511999999999"), false);
});

test("a fila não recebe mensagens privadas sem autorização", async () => {
  const { admin, writes } = fakeAdmin(null);
  assert.equal(
    await enqueueNotification(admin, {
      eventType: "automation",
      recipientId: "pessoa",
      recipientRole: "mentee",
      phone: "11999999999",
      referenceType: "test",
      referenceId: "teste",
      idempotencyKey: "teste",
      message: "Mensagem",
      targetUrl: "https://example.com",
    }),
    null,
  );
  assert.equal(writes.length, 0);
});

test("revogação bloqueia uma notificação já pendente antes de chamar o gateway", async () => {
  const { admin, writes } = fakeAdmin({ authorized: false, phone: "5511999999999" });
  assert.equal(
    await deliverNotification(admin, { id: "pendente", phone: "5511999999999" }),
    "skipped",
  );
  assert.deepEqual(writes, [
    {
      table: "whatsapp_notifications",
      value: {
        status: "failed",
        error_message: "Envio bloqueado: WhatsApp sem autorização para este número.",
      },
    },
  ]);
});
