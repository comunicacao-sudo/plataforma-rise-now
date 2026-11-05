/**
 * Textos das notificações de WhatsApp, editáveis pelo painel admin.
 * Módulo puro (sem Deno/Node): usado pelas Edge Functions e pela prévia no painel.
 */

export const WHATSAPP_TEMPLATE_KEYS = [
  "account_created",
  "meeting_reminder",
  "stage_released",
  "stage_completed_mentee",
  "stage_completed_mentor",
] as const;

export type WhatsAppTemplateKey = (typeof WHATSAPP_TEMPLATE_KEYS)[number];
export type WhatsAppTemplates = Partial<Record<WhatsAppTemplateKey, string>>;
export type TemplateVariables = Record<string, string | null | undefined>;

export const MAX_TEMPLATE_LENGTH = 1500;

export const WHATSAPP_VARIABLE_HELP: Record<string, string> = {
  nome: "primeiro nome de quem recebe",
  email: "e-mail de acesso",
  encontro: "título do encontro",
  data: "data e hora do encontro",
  etapa: "nome da etapa",
  mentorada: "nome da mentorada",
  link: "link da plataforma",
};

export const WHATSAPP_TEMPLATE_DEFINITIONS: Record<
  WhatsAppTemplateKey,
  { label: string; variables: string[]; defaultText: string; sample: TemplateVariables }
> = {
  account_created: {
    label: "Conta criada",
    variables: ["nome", "email", "link"],
    defaultText:
      "Olá, {nome}! ✨\n\nSeu acesso à plataforma *RISE NOW* foi criado.\n\nEnviamos para o seu e-mail ({email}) o link seguro para ativar a conta e definir sua senha. Depois, é só entrar por aqui:\n{link}",
    sample: {
      nome: "Mariana",
      email: "mariana@email.com",
      link: "https://board.mentoriarisenow.com.br/",
    },
  },
  meeting_reminder: {
    label: "Lembrete de encontro",
    variables: ["nome", "encontro", "data", "link"],
    defaultText:
      "Olá, {nome}! ⏰\n\nLembrete da *RISE NOW*: o encontro *{encontro}* está marcado para {data}.\n\nVeja os detalhes na plataforma:\n{link}",
    sample: {
      nome: "Mariana",
      encontro: "Forward Reflection",
      data: "12/11/2026 às 19:00",
      link: "https://board.mentoriarisenow.com.br/?view=agenda",
    },
  },
  stage_released: {
    label: "Nova etapa liberada",
    variables: ["nome", "etapa", "link"],
    defaultText:
      "Olá, {nome}! ✨\n\nUma nova etapa da sua jornada *RISE NOW* foi liberada: *{etapa}*.\n\nAcesse aqui:\n{link}",
    sample: {
      nome: "Mariana",
      etapa: "Mapa de Direção",
      link: "https://board.mentoriarisenow.com.br/?view=jornada",
    },
  },
  stage_completed_mentee: {
    label: "Etapa concluída (mentorada)",
    variables: ["nome", "etapa", "link"],
    defaultText:
      "Olá, {nome}! 🌟\n\nParabéns pela conclusão da etapa *{etapa}* na *RISE NOW*.\n\nAcompanhe seu progresso:\n{link}",
    sample: {
      nome: "Mariana",
      etapa: "Mapa de Clareza RISE",
      link: "https://board.mentoriarisenow.com.br/?view=jornada",
    },
  },
  stage_completed_mentor: {
    label: "Etapa concluída (mentora)",
    variables: ["nome", "mentorada", "etapa", "link"],
    defaultText:
      "Olá, {nome}! ✅\n\n{mentorada} concluiu a etapa *{etapa}* na *RISE NOW*.\n\nAcompanhe o progresso da mentorada:\n{link}",
    sample: {
      nome: "Camila",
      mentorada: "Mariana Souza",
      etapa: "Mapa de Clareza RISE",
      link: "https://board.mentoriarisenow.com.br/?view=gestao-jornada",
    },
  },
};

const isTemplateKey = (key: string): key is WhatsAppTemplateKey =>
  (WHATSAPP_TEMPLATE_KEYS as readonly string[]).includes(key);

const normalizeText = (value: string) => value.replace(/\r\n?/g, "\n").trim();

/**
 * Mantém só textos válidos e diferentes do padrão. Texto vazio volta ao padrão.
 * Lança erro com mensagem amigável se algum texto passar do limite.
 */
export function sanitizeTemplates(input: unknown): WhatsAppTemplates {
  const result: WhatsAppTemplates = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!isTemplateKey(key) || typeof raw !== "string") continue;
    const text = normalizeText(raw);
    if (!text || text === WHATSAPP_TEMPLATE_DEFINITIONS[key].defaultText) continue;
    if (text.length > MAX_TEMPLATE_LENGTH)
      throw new Error(
        `O texto "${WHATSAPP_TEMPLATE_DEFINITIONS[key].label}" passou de ${MAX_TEMPLATE_LENGTH} caracteres.`,
      );
    result[key] = text;
  }
  return result;
}

/** Texto em uso para o evento: o personalizado, se houver, ou o padrão. */
export function templateFor(key: WhatsAppTemplateKey, custom: unknown) {
  const stored =
    custom && typeof custom === "object" ? (custom as Record<string, unknown>)[key] : null;
  return typeof stored === "string" && normalizeText(stored)
    ? normalizeText(stored).slice(0, MAX_TEMPLATE_LENGTH)
    : WHATSAPP_TEMPLATE_DEFINITIONS[key].defaultText;
}

/** Variáveis escritas no texto que não existem para este evento. */
export function unknownVariables(key: WhatsAppTemplateKey, text: string) {
  const allowed = new Set(WHATSAPP_TEMPLATE_DEFINITIONS[key].variables);
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
  return [...new Set(found.filter((name) => !allowed.has(name)))];
}

/**
 * Monta a mensagem final. Variáveis desconhecidas ficam como estão; se {nome}
 * estiver vazio, a vírgula antes dele some ("Olá, {nome}!" vira "Olá!").
 */
export function renderTemplate(
  key: WhatsAppTemplateKey,
  custom: unknown,
  variables: TemplateVariables,
) {
  const allowed = new Set(WHATSAPP_TEMPLATE_DEFINITIONS[key].variables);
  let text = templateFor(key, custom);
  const name = variables["nome"]?.replace(/\s+/g, " ").trim();
  if (!name) text = text.replace(/[,\s]*\{nome\}/g, "");
  return text.replace(/\{(\w+)\}/g, (match, variable: string) => {
    if (!allowed.has(variable)) return match;
    const value = variables[variable];
    if (value === null || value === undefined) return "";
    return variable === "link" ? value.trim() : value.replace(/\s+/g, " ").trim();
  });
}
