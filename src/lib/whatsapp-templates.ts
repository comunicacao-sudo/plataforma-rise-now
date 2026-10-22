export const WHATSAPP_EVENT_TYPES = [
  "account_created",
  "meeting_reminder",
  "stage_released",
  "stage_completed_mentee",
  "stage_completed_mentor",
] as const;

export type WhatsAppEventType = (typeof WHATSAPP_EVENT_TYPES)[number];

export type NormalizedBrazilianPhone = {
  e164: string;
  digits: string;
  chatId: string;
};

export type AppLinkParams = Record<string, string | number | boolean | null | undefined>;

export type WhatsAppMessageInput = {
  type: WhatsAppEventType;
  recipientName?: string | null;
  actorName?: string | null;
  title?: string | null;
  startsAt?: Date | string | number | null;
  actionUrl: string;
};

type MessageContext = {
  greeting: string;
  actorName: string;
  title: string;
  startsAt: string | null;
  actionUrl: string;
};

type MessageTemplate = (context: MessageContext) => string;

const BRAZIL_COUNTRY_CODE = "55";
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

const cleanInlineText = (value: string | null | undefined, fallback: string) => {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || fallback;
};

const assertSafeHttpUrl = (value: string, label: string) => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} precisa ser uma URL válida.`);
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new TypeError(`${label} precisa usar HTTP ou HTTPS e não pode conter credenciais.`);
  }

  return url;
};

/**
 * Normaliza telefones brasileiros comuns para o formato internacional E.164.
 * Aceita números com ou sem +55, pontuação, zero de longa distância e operadora.
 */
export function normalizeBrazilianPhone(
  raw: string | null | undefined,
): NormalizedBrazilianPhone | null {
  let inputDigits = raw?.replace(/\D/g, "") ?? "";

  if (inputDigits.startsWith("00")) {
    inputDigits = inputDigits.slice(2);
  }

  let nationalDigits: string;

  if (
    inputDigits.startsWith(BRAZIL_COUNTRY_CODE) &&
    (inputDigits.length === 12 || inputDigits.length === 13)
  ) {
    nationalDigits = inputDigits.slice(BRAZIL_COUNTRY_CODE.length);
  } else {
    // 0 + DDD + número ou 0 + código da operadora + DDD + número.
    if (inputDigits.startsWith("0") && (inputDigits.length === 11 || inputDigits.length === 12)) {
      inputDigits = inputDigits.slice(1);
    } else if (
      inputDigits.startsWith("0") &&
      (inputDigits.length === 13 || inputDigits.length === 14)
    ) {
      inputDigits = inputDigits.slice(3);
    }

    nationalDigits = inputDigits;
  }

  if (!/^[1-9]\d[2-9]\d{7,8}$/.test(nationalDigits)) {
    return null;
  }

  const digits = `${BRAZIL_COUNTRY_CODE}${nationalDigits}`;
  return {
    e164: `+${digits}`,
    digits,
    chatId: `${digits}@c.us`,
  };
}

/** Cria links internos sem permitir troca de origem ou protocolos inseguros. */
export function buildAppLink(baseUrl: string, path: string, params: AppLinkParams = {}) {
  const base = assertSafeHttpUrl(baseUrl, "A URL base");

  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    throw new TypeError("O caminho precisa ser interno à plataforma.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const target = new URL(normalizedPath, base.origin);

  if (target.origin !== base.origin) {
    throw new TypeError("O caminho precisa permanecer na origem da plataforma.");
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      target.searchParams.set(key, String(value));
    }
  }

  return target.toString();
}

export function formatBrazilianDateTime(
  value: Date | string | number | null | undefined,
  timeZone = DEFAULT_TIME_ZONE,
): string | null {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;

  return `${part("day")}/${part("month")}/${part("year")} às ${part("hour")}:${part("minute")}`;
}

export const WHATSAPP_MESSAGE_TEMPLATES: Readonly<Record<WhatsAppEventType, MessageTemplate>> = {
  account_created: ({ greeting, actionUrl }) =>
    `${greeting} ✨\n\nSeu acesso à plataforma RISE NOW foi criado.\n\nAtive sua conta e defina sua senha com segurança pelo link:\n${actionUrl}`,
  meeting_reminder: ({ greeting, title, startsAt, actionUrl }) =>
    `${greeting} ⏰\n\nLembrete: o encontro *${title}*${startsAt ? ` está marcado para ${startsAt}` : " acontecerá em breve"}.\n\nVeja os detalhes na plataforma:\n${actionUrl}`,
  stage_released: ({ greeting, title, actionUrl }) =>
    `${greeting} ✨\n\nUma nova etapa foi liberada para você: *${title}*.\n\nAcesse sua jornada:\n${actionUrl}`,
  stage_completed_mentee: ({ greeting, title, actionUrl }) =>
    `${greeting} 🌟\n\nParabéns pela conclusão da etapa *${title}*.\n\nAcompanhe seu progresso na plataforma:\n${actionUrl}`,
  stage_completed_mentor: ({ greeting, actorName, title, actionUrl }) =>
    `${greeting} ✅\n\n${actorName} concluiu a etapa *${title}*.\n\nAcompanhe o progresso da mentorada:\n${actionUrl}`,
};

export function renderWhatsAppMessage(input: WhatsAppMessageInput) {
  const actionUrl = assertSafeHttpUrl(input.actionUrl, "O link de ação").toString();
  const recipientName = cleanInlineText(input.recipientName, "");
  const context: MessageContext = {
    greeting: recipientName ? `Olá, ${recipientName}!` : "Olá!",
    actorName: cleanInlineText(input.actorName, "Uma mentorada"),
    title: cleanInlineText(input.title, "Nova etapa"),
    startsAt: formatBrazilianDateTime(input.startsAt),
    actionUrl,
  };

  return WHATSAPP_MESSAGE_TEMPLATES[input.type](context);
}
