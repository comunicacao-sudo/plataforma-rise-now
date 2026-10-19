import assert from "node:assert/strict";
import test from "node:test";

import {
  WHATSAPP_EVENT_TYPES,
  buildAppLink,
  formatBrazilianDateTime,
  normalizeBrazilianPhone,
  renderWhatsAppMessage,
} from "./whatsapp-templates";

test("normaliza formatos brasileiros para E.164 e chatId do WAHA", () => {
  const expected = {
    e164: "+5511912345678",
    digits: "5511912345678",
    chatId: "5511912345678@c.us",
  };

  assert.deepEqual(normalizeBrazilianPhone("(11) 91234-5678"), expected);
  assert.deepEqual(normalizeBrazilianPhone("+55 11 91234 5678"), expected);
  assert.deepEqual(normalizeBrazilianPhone("0055 11 91234 5678"), expected);
  assert.deepEqual(normalizeBrazilianPhone("011 91234-5678"), expected);
  assert.deepEqual(normalizeBrazilianPhone("021 11 91234-5678"), expected);
});

test("aceita telefone fixo válido e recusa números incompletos ou estrangeiros", () => {
  assert.deepEqual(normalizeBrazilianPhone("11 3456-7890"), {
    e164: "+551134567890",
    digits: "551134567890",
    chatId: "551134567890@c.us",
  });
  assert.equal(normalizeBrazilianPhone("91234-5678"), null);
  assert.equal(normalizeBrazilianPhone("+1 202 555 0198"), null);
  assert.equal(normalizeBrazilianPhone("55 00 91234-5678"), null);
  assert.equal(normalizeBrazilianPhone(null), null);
});

test("monta links internos na origem configurada e preserva parâmetros", () => {
  assert.equal(
    buildAppLink("https://mentoriarisenow.lovable.app/", "/", {
      view: "jornada",
      step: "mapa de clareza",
      empty: null,
    }),
    "https://mentoriarisenow.lovable.app/?view=jornada&step=mapa+de+clareza",
  );
  assert.equal(
    buildAppLink("http://localhost:3000", "reset-password", { invited: true }),
    "http://localhost:3000/reset-password?invited=true",
  );
});

test("bloqueia origem insegura, credenciais e caminhos externos", () => {
  assert.throws(() => buildAppLink("javascript:alert(1)", "/"), /HTTP ou HTTPS/);
  assert.throws(() => buildAppLink("https://user:secret@example.com", "/"), /credenciais/);
  assert.throws(
    () => buildAppLink("https://mentoriarisenow.lovable.app", "https://example.com"),
    /interno/,
  );
  assert.throws(
    () => buildAppLink("https://mentoriarisenow.lovable.app", "//example.com"),
    /interno/,
  );
  assert.throws(
    () => buildAppLink("https://mentoriarisenow.lovable.app", "\\example.com"),
    /origem/,
  );
});

test("formata encontro no horário de Brasília de forma determinística", () => {
  assert.equal(formatBrazilianDateTime("2026-10-20T12:00:00.000Z"), "20/10/2026 às 09:00");
  assert.equal(formatBrazilianDateTime("data inválida"), null);
});

test("renderiza os cinco eventos transacionais com mensagem e link", () => {
  const link = "https://mentoriarisenow.lovable.app/?view=jornada";
  const messages = WHATSAPP_EVENT_TYPES.map((type) =>
    renderWhatsAppMessage({
      type,
      recipientName: "  Ana   Luiza  ",
      actorName: "Maria",
      title: "Mapa de Clareza",
      startsAt: "2026-10-20T12:00:00.000Z",
      actionUrl: link,
    }),
  );

  assert.equal(messages.length, 5);
  for (const message of messages) {
    assert.match(message, /^Olá, Ana Luiza!/);
    assert.match(message, new RegExp(`${link.replace(/[?]/g, "\\?")}$`));
  }
  assert.match(messages[0]!, /defina sua senha com segurança/);
  assert.match(messages[1]!, /20\/10\/2026 às 09:00/);
  assert.match(messages[2]!, /nova etapa foi liberada/i);
  assert.match(messages[3]!, /Parabéns pela conclusão/);
  assert.match(messages[4]!, /Maria concluiu a etapa/);
});

test("usa textos seguros de apoio quando dados opcionais não existem", () => {
  const message = renderWhatsAppMessage({
    type: "stage_completed_mentor",
    actionUrl: "https://mentoriarisenow.lovable.app/",
  });

  assert.match(message, /^Olá!/);
  assert.match(message, /Uma mentorada concluiu a etapa \*Nova etapa\*/);
  assert.throws(
    () =>
      renderWhatsAppMessage({
        type: "account_created",
        actionUrl: "javascript:alert(1)",
      }),
    /HTTP ou HTTPS/,
  );
});
