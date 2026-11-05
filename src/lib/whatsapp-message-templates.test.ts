import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_TEMPLATE_LENGTH,
  WHATSAPP_TEMPLATE_DEFINITIONS,
  WHATSAPP_TEMPLATE_KEYS,
  renderTemplate,
  sanitizeTemplates,
  templateFor,
  unknownVariables,
} from "../../supabase/functions/_shared/whatsapp-templates.ts";

test("usa o texto padrão quando não há personalização", () => {
  for (const key of WHATSAPP_TEMPLATE_KEYS) {
    assert.equal(templateFor(key, {}), WHATSAPP_TEMPLATE_DEFINITIONS[key].defaultText);
    assert.equal(templateFor(key, null), WHATSAPP_TEMPLATE_DEFINITIONS[key].defaultText);
    assert.equal(
      templateFor(key, { [key]: "   " }),
      WHATSAPP_TEMPLATE_DEFINITIONS[key].defaultText,
    );
  }
});

test("todo texto padrão menciona a RISE NOW e traz o link", () => {
  for (const key of WHATSAPP_TEMPLATE_KEYS) {
    const text = WHATSAPP_TEMPLATE_DEFINITIONS[key].defaultText;
    assert.match(text, /RISE NOW/);
    assert.match(text, /\{link\}/);
    assert.deepEqual(unknownVariables(key, text), []);
  }
});

test("troca as variáveis pelo valor de cada pessoa", () => {
  const message = renderTemplate(
    "meeting_reminder",
    { meeting_reminder: "Oi {nome}! O encontro {encontro} é {data}. {link}" },
    {
      nome: "  Ana   Luiza ",
      encontro: "Forward\nReflection",
      data: "12/11/2026 às 19:00",
      link: "https://board.mentoriarisenow.com.br/?view=agenda",
    },
  );
  assert.equal(
    message,
    "Oi Ana Luiza! O encontro Forward Reflection é 12/11/2026 às 19:00. https://board.mentoriarisenow.com.br/?view=agenda",
  );
});

test("sem nome, a saudação fica limpa", () => {
  const message = renderTemplate("stage_released", {}, { nome: "", etapa: "Direção", link: "x" });
  assert.match(message, /^Olá! ✨/);
});

test("variáveis de outro aviso não são trocadas e são apontadas", () => {
  const text = "Olá {nome}, encontro {encontro} {link}";
  assert.deepEqual(unknownVariables("stage_released", text), ["encontro"]);
  assert.equal(
    renderTemplate(
      "stage_released",
      { stage_released: text },
      { nome: "Bia", encontro: "X", link: "L" },
    ),
    "Olá Bia, encontro {encontro} L",
  );
});

test("sanitiza o que vem do painel", () => {
  const custom = sanitizeTemplates({
    account_created: "  Bem-vinda, {nome}!\r\n{link}  ",
    meeting_reminder: WHATSAPP_TEMPLATE_DEFINITIONS.meeting_reminder.defaultText,
    stage_released: "",
    chave_inventada: "x",
    stage_completed_mentee: 123,
  });
  assert.deepEqual(custom, { account_created: "Bem-vinda, {nome}!\n{link}" });
  assert.deepEqual(sanitizeTemplates(null), {});
  assert.deepEqual(sanitizeTemplates(["x"]), {});
  assert.throws(
    () => sanitizeTemplates({ stage_released: "a".repeat(MAX_TEMPLATE_LENGTH + 1) }),
    /passou de/,
  );
});
