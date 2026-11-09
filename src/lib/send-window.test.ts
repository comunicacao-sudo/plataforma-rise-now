import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SEND_WINDOW,
  describeSendWindow,
  isWithinWindow,
  nextWindowOpening,
  reminderSendTime,
  sanitizeSendWindow,
  sendWindowFromSettings,
} from "../../supabase/functions/_shared/send-window.ts";

// São Paulo = UTC−3. Segunda-feira, 09/11/2026.
const sp = (iso: string) => new Date(`${iso}-03:00`);
const W = DEFAULT_SEND_WINDOW;

test("janela padrão: seg a sex, das 09:00 às 17:00", () => {
  assert.equal(describeSendWindow(W), "seg a sex, das 09:00 às 17:00");
  assert.equal(isWithinWindow(sp("2026-11-09T09:00:00"), W), true);
  assert.equal(isWithinWindow(sp("2026-11-09T17:00:00"), W), true);
  assert.equal(isWithinWindow(sp("2026-11-09T17:01:00"), W), false);
  assert.equal(isWithinWindow(sp("2026-11-09T08:59:00"), W), false);
  assert.equal(isWithinWindow(sp("2026-11-14T10:00:00"), W), false); // sábado
  assert.equal(isWithinWindow(sp("2026-11-15T10:00:00"), W), false); // domingo
});

test("fora do horário, o aviso espera a próxima abertura", () => {
  const atOpening = (iso: string) => nextWindowOpening(sp(iso), W).toISOString();
  assert.equal(atOpening("2026-11-13T18:00:00"), sp("2026-11-16T09:00:00").toISOString()); // sex 18h → seg 9h
  assert.equal(atOpening("2026-11-15T23:00:00"), sp("2026-11-16T09:00:00").toISOString()); // dom → seg
  assert.equal(atOpening("2026-11-10T07:30:00"), sp("2026-11-10T09:00:00").toISOString()); // ter cedo
  assert.equal(atOpening("2026-11-10T22:15:00"), sp("2026-11-11T09:00:00").toISOString()); // ter noite
  assert.equal(atOpening("2026-11-10T11:00:00"), sp("2026-11-10T11:00:00").toISOString()); // já na janela
});

test("lembrete de 1 dia antes vai no dia útil anterior, nunca no fim de semana", () => {
  const send = (iso: string, offset: number) =>
    reminderSendTime(sp(iso), offset, W)?.toISOString() ?? null;
  // 1:1 na segunda 15h → sexta 15h
  assert.equal(send("2026-11-16T15:00:00", 1440), sp("2026-11-13T15:00:00").toISOString());
  // 1:1 na terça 10h → segunda 10h
  assert.equal(send("2026-11-10T10:00:00", 1440), sp("2026-11-09T10:00:00").toISOString());
  // encontro às 18h → dia anterior limitado ao fim da janela (17h)
  assert.equal(send("2026-11-11T18:00:00", 1440), sp("2026-11-10T17:00:00").toISOString());
  // 2 dias antes de uma terça → sexta
  assert.equal(send("2026-11-17T14:00:00", 2880), sp("2026-11-13T14:00:00").toISOString());
});

test("lembretes curtos respeitam a janela ou não saem", () => {
  const send = (iso: string, offset: number) =>
    reminderSendTime(sp(iso), offset, W)?.toISOString() ?? null;
  // aula às 17h: aviso 15 min antes (16h45) e na hora (17h)
  assert.equal(send("2026-11-10T17:00:00", 15), sp("2026-11-10T16:45:00").toISOString());
  assert.equal(send("2026-11-10T17:00:00", 0), sp("2026-11-10T17:00:00").toISOString());
  // 1:1 às 9h30 com aviso 1h antes → sai na abertura (9h), ainda antes do encontro
  assert.equal(send("2026-11-10T09:30:00", 60), sp("2026-11-10T09:00:00").toISOString());
  // encontro às 19h: 1h antes cairia às 18h → não sai
  assert.equal(send("2026-11-10T19:00:00", 60), null);
  // sábado: não sai
  assert.equal(send("2026-11-14T10:00:00", 15), null);
});

test("configuração salva e validação do painel", () => {
  assert.deepEqual(sendWindowFromSettings(null), W);
  assert.deepEqual(
    sendWindowFromSettings({
      send_window_start: "08:00",
      send_window_end: "18:00",
      send_window_days: [5, 1, 1],
    }),
    { start: "08:00", end: "18:00", days: [1, 5] },
  );
  assert.deepEqual(
    sendWindowFromSettings({ send_window_start: "18:00", send_window_end: "09:00" }),
    W,
  );
  assert.throws(
    () => sanitizeSendWindow({ start: "17:00", end: "09:00", days: [1] }),
    /depois do início/,
  );
  assert.throws(
    () => sanitizeSendWindow({ start: "09:00", end: "17:00", days: [] }),
    /dia da semana/,
  );
  assert.throws(() => sanitizeSendWindow({ start: "9h", end: "17:00", days: [1] }), /hh:mm/);
});
