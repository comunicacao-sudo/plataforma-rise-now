/**
 * Janela de envio do WhatsApp (horário comercial, fuso de São Paulo).
 * O público da RISE NOW é CLT: mensagens só saem dentro da janela configurada.
 * Módulo puro (sem Deno/Node): usado pelo rise-cron, pelo rise-backend e pelo painel.
 */

export type SendWindow = {
  /** Início, "hh:mm" (inclusivo). */
  start: string;
  /** Fim, "hh:mm" (inclusivo: às 17:00 ainda envia; às 17:01 não). */
  end: string;
  /** Dias permitidos: 0 = domingo … 6 = sábado. */
  days: number[];
};

export const DEFAULT_SEND_WINDOW: SendWindow = {
  start: "09:00",
  end: "17:00",
  days: [1, 2, 3, 4, 5],
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 86_400_000;
/** São Paulo não tem horário de verão: UTC−3 fixo. */
const SP_OFFSET_MS = 3 * 3_600_000;

export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function minutesOf(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

/** Lê a janela salva nas configurações; valores inválidos voltam ao padrão (9h–17h, seg–sex). */
export function sendWindowFromSettings(settings: unknown): SendWindow {
  const raw = (settings && typeof settings === "object" ? settings : {}) as {
    send_window_start?: unknown;
    send_window_end?: unknown;
    send_window_days?: unknown;
  };
  const start = typeof raw.send_window_start === "string" ? raw.send_window_start.slice(0, 5) : "";
  const end = typeof raw.send_window_end === "string" ? raw.send_window_end.slice(0, 5) : "";
  const days = Array.isArray(raw.send_window_days)
    ? [
        ...new Set(
          raw.send_window_days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        ),
      ]
    : [];
  if (!TIME.test(start) || !TIME.test(end) || minutesOf(start) >= minutesOf(end) || !days.length)
    return { ...DEFAULT_SEND_WINDOW, days: [...DEFAULT_SEND_WINDOW.days] };
  return { start, end, days: days.sort() };
}

/** Valida a janela vinda do painel. Lança erro em português. */
export function sanitizeSendWindow(input: unknown): SendWindow {
  const raw = (input && typeof input === "object" ? input : {}) as {
    start?: unknown;
    end?: unknown;
    days?: unknown;
  };
  const start = String(raw.start ?? "");
  const end = String(raw.end ?? "");
  if (!TIME.test(start) || !TIME.test(end))
    throw new Error("Informe os horários no formato hh:mm.");
  if (minutesOf(start) >= minutesOf(end)) throw new Error("O fim precisa ser depois do início.");
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    : [];
  if (!days.length) throw new Error("Escolha ao menos um dia da semana.");
  return { start, end, days: days.sort() };
}

/** Data local de São Paulo (dia, dia da semana e minutos do dia). */
export function localParts(date: Date) {
  const shifted = new Date(date.getTime() - SP_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Converte data local de São Paulo + minutos do dia em instante UTC. */
function localDate(year: number, month: number, day: number, minutes: number) {
  return new Date(Date.UTC(year, month, day, 0, minutes) + SP_OFFSET_MS);
}

export function isWithinWindow(date: Date, window: SendWindow) {
  const p = localParts(date);
  return (
    window.days.includes(p.weekday) &&
    p.minutes >= minutesOf(window.start) &&
    p.minutes <= minutesOf(window.end)
  );
}

/** Próximo instante permitido: agora, se já estiver na janela; senão a próxima abertura. */
export function nextWindowOpening(date: Date, window: SendWindow) {
  if (isWithinWindow(date, window)) return date;
  const p = localParts(date);
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = localParts(new Date(Date.UTC(p.year, p.month, p.day + offset, 12) + SP_OFFSET_MS));
    if (!window.days.includes(day.weekday)) continue;
    const opening = localDate(day.year, day.month, day.day, minutesOf(window.start));
    if (opening.getTime() > date.getTime()) return opening;
  }
  return localDate(p.year, p.month, p.day + 7, minutesOf(window.start));
}

/**
 * Quando enviar um lembrete "X antes" de um encontro, respeitando a janela.
 * - 1 dia ou mais: no(s) dia(s) útil(eis) anterior(es), no mesmo horário do encontro
 *   (limitado à janela). Encontro de segunda → lembrete na sexta, nunca no domingo.
 * - Menos de 1 dia: no horário exato; se cair antes da abertura do mesmo dia, envia na
 *   abertura (se ainda for antes do encontro); se cair fora da janela de outro jeito,
 *   não envia (retorna null), porque chegaria fora de hora ou atrasado.
 */
export function reminderSendTime(eventAt: Date, offsetMinutes: number, window: SendWindow) {
  const offset = Math.max(0, Math.round(offsetMinutes));
  const event = localParts(eventAt);
  const start = minutesOf(window.start);
  const end = minutesOf(window.end);

  if (offset >= 1440) {
    let businessDaysBack = Math.floor(offset / 1440);
    let cursor = { ...event };
    for (let guard = 0; guard < 60 && businessDaysBack > 0; guard += 1) {
      const previous = localParts(
        new Date(Date.UTC(cursor.year, cursor.month, cursor.day - 1, 12) + SP_OFFSET_MS),
      );
      cursor = { ...previous, minutes: event.minutes };
      if (window.days.includes(cursor.weekday)) businessDaysBack -= 1;
    }
    const minutes = Math.min(end, Math.max(start, event.minutes - (offset % 1440)));
    const sendAt = localDate(cursor.year, cursor.month, cursor.day, minutes);
    return sendAt.getTime() < eventAt.getTime() ? sendAt : null;
  }

  const due = new Date(eventAt.getTime() - offset * 60_000);
  if (isWithinWindow(due, window)) return due;
  const dueLocal = localParts(due);
  const sameDay =
    dueLocal.year === event.year && dueLocal.month === event.month && dueLocal.day === event.day;
  if (sameDay && window.days.includes(event.weekday) && dueLocal.minutes < start) {
    const opening = localDate(event.year, event.month, event.day, start);
    if (opening.getTime() < eventAt.getTime()) return opening;
  }
  return null;
}

/** Frase para o painel: "seg a sex, das 09:00 às 17:00". */
export function describeSendWindow(window: SendWindow) {
  const days = [...window.days].sort();
  const consecutive = days.every((day, index) => index === 0 || day === days[index - 1]! + 1);
  const label =
    consecutive && days.length > 2
      ? `${WEEKDAY_SHORT[days[0]!]} a ${WEEKDAY_SHORT[days[days.length - 1]!]}`
      : days.map((day) => WEEKDAY_SHORT[day]).join(", ");
  return `${label}, das ${window.start} às ${window.end}`;
}

export const DAY_IN_MS = DAY_MS;
