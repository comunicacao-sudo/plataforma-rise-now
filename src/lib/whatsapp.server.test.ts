import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { verifyWahaWebhookSignature } from "./whatsapp.server";

test("valida a assinatura HMAC SHA 512 do webhook WAHA", () => {
  const previous = process.env["WAHA_WEBHOOK_HMAC_KEY"];
  process.env["WAHA_WEBHOOK_HMAC_KEY"] = "segredo-de-teste-comprido";
  try {
    const body = JSON.stringify({ event: "message.ack", session: "rise-principal" });
    const signature = createHmac("sha512", "segredo-de-teste-comprido")
      .update(body, "utf8")
      .digest("hex");
    assert.equal(verifyWahaWebhookSignature(body, signature), true);
    assert.equal(verifyWahaWebhookSignature(`${body} `, signature), false);
    assert.equal(verifyWahaWebhookSignature(body, "assinatura-invalida"), false);
    assert.equal(verifyWahaWebhookSignature(body, null), false);
  } finally {
    if (previous === undefined) delete process.env["WAHA_WEBHOOK_HMAC_KEY"];
    else process.env["WAHA_WEBHOOK_HMAC_KEY"] = previous;
  }
});
