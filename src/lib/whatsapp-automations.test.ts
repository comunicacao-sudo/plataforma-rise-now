import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AUTOMATIONS,
  TRIGGER_DEFINITIONS,
  describeAutomation,
  formatScheduleLines,
  nextWeekRange,
  renderAutomation,
  sanitizeAutomation,
  unknownAutomationVariables,
  weeklyIsDue,
} from "../../supabase/functions/_shared/whatsapp-automations.ts";

test("automações padrão são válidas, usam só variáveis conhecidas e começam desligadas", () => {
  assert.equal(DEFAULT_AUTOMATIONS.length, 12);
  for (const item of DEFAULT_AUTOMATIONS) {
    assert.equal(item.enabled, false);
    assert.deepEqual(unknownAutomationVariables(item.trigger, item.template), [], item.key);
    assert.doesNotThrow(() => sanitizeAutomation(item), item.key);
    assert.ok(TRIGGER_DEFINITIONS[item.trigger].audiences.includes(item.audience), item.key);
  }
});

test("descreve quando e para quem", () => {
  const byKey = Object.fromEntries(DEFAULT_AUTOMATIONS.map((item) => [item.key, item]));
  assert.equal(
    describeAutomation(byKey["weekly_schedule"]!),
    "Toda sexta-feira às 17:00 → Grupo da RISE no WhatsApp",
  );
  assert.match(describeAutomation(byKey["group_meeting_2h"]!), /^2 horas antes de cada encontro/);
  assert.match(describeAutomation(byKey["group_meeting_now"]!), /^na hora de cada encontro/);
  assert.match(describeAutomation(byKey["booking_1day"]!), /^1 dia antes de cada 1:1/);
});

test("valida o que vem do painel", () => {
  const base = DEFAULT_AUTOMATIONS[1]!;
  assert.throws(() => sanitizeAutomation({ ...base, name: "x" }), /nome/);
  assert.throws(() => sanitizeAutomation({ ...base, trigger: "inventado" }), /quando/);
  assert.throws(() => sanitizeAutomation({ ...base, audience: "member" }), /público/);
  assert.throws(() => sanitizeAutomation({ ...base, template: "  " }), /texto/);
  assert.throws(() => sanitizeAutomation({ ...base, offsetMinutes: -5 }), /antecedência/);
  assert.throws(
    () => sanitizeAutomation({ ...DEFAULT_AUTOMATIONS[0]!, sendTime: "25:00" }),
    /horário/,
  );
  const clean = sanitizeAutomation({ ...base, name: "  Aviso   2h  ", enabled: "sim" });
  assert.equal(clean.name, "Aviso 2h");
  assert.equal(clean.enabled, false);
  assert.equal(clean.weekday, null);
});

test("monta a mensagem com as variáveis e limpa a saudação sem nome", () => {
  const text = renderAutomation("booking_before", "Olá, {nome}! {mentora} às {hora}. {xyz}", {
    nome: "",
    mentora: "Camila  Mariano",
    hora: "15:00",
  });
  assert.equal(text, "Olá! Camila Mariano às 15:00. {xyz}");
});

test("cronograma da semana seguinte em São Paulo", () => {
  // Sexta, 06/11/2026 às 17:00 em São Paulo (20:00 UTC).
  const friday = new Date("2026-11-06T20:00:00.000Z");
  const range = nextWeekRange(friday);
  assert.equal(range.start.toISOString(), "2026-11-09T03:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-11-16T03:00:00.000Z");
  assert.equal(range.label, "09/11 a 15/11");
  assert.equal(
    formatScheduleLines([
      { title: "Aula B", scheduled_at: "2026-11-12T23:00:00.000Z", mentor_name: "Gabriela" },
      { title: "Encontro A", scheduled_at: "2026-11-09T22:00:00.000Z" },
    ]),
    "• Seg 09/11 às 19:00 — Encontro A\n• Qui 12/11 às 20:00 — Aula B (Gabriela)",
  );
  assert.match(formatScheduleLines([]), /Sem encontros/);
});

test("envio semanal só a partir do dia e horário escolhidos", () => {
  const friday1659 = new Date("2026-11-06T19:59:00.000Z");
  const friday1700 = new Date("2026-11-06T20:00:00.000Z");
  const thursday = new Date("2026-11-05T21:00:00.000Z");
  assert.equal(weeklyIsDue(friday1659, 5, "17:00"), false);
  assert.equal(weeklyIsDue(friday1700, 5, "17:00"), true);
  assert.equal(weeklyIsDue(thursday, 5, "17:00"), false);
});
