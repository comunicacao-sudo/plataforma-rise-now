/**
 * Automações de WhatsApp configuráveis pelo painel.
 * Módulo puro (sem Deno/Node): usado pelo rise-cron, pelo rise-backend e pelo painel.
 *
 * Cada automação = gatilho (quando) + público (para quem) + texto.
 * Gatilhos novos exigem código aqui e no rise-cron; o resto a equipe edita sozinha.
 */

export const AUTOMATION_TRIGGERS = [
  "weekly_schedule",
  "group_meeting_before",
  "booking_slots_available",
  "booking_before",
  "booking_confirmed",
  "questionnaire_submitted",
  "assessment_completed",
  "goal_created",
  "stage_completed",
  "account_created",
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_AUDIENCES = ["group", "mentees", "mentor", "staff", "member"] as const;
export type AutomationAudience = (typeof AUTOMATION_AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<AutomationAudience, string> = {
  group: "Grupo da RISE no WhatsApp",
  mentees: "Participantes (no privado)",
  mentor: "Mentora responsável",
  staff: "Todas as mentoras",
  member: "A pessoa cadastrada",
};

export const AUTOMATION_VARIABLE_HELP: Record<string, string> = {
  nome: "primeiro nome de quem recebe",
  participante: "nome de quem participa",
  mentora: "nome da mentora",
  encontro: "título do encontro",
  data: "data (dd/mm)",
  hora: "horário (hh:mm)",
  link_encontro: "link da chamada (Meet)",
  cronograma: "lista dos encontros da semana",
  semana: "período da semana (ex.: 10/11 a 16/11)",
  questionario: "nome do questionário",
  etapa: "nome da etapa",
  meta: "título da meta",
  email: "e-mail de acesso",
  link: "link da plataforma",
};

type TriggerKind = "weekly" | "before" | "event";

/**
 * Nomes antigos que continuam funcionando em textos já salvos, mas não aparecem
 * mais no painel. {mentorada} virou {participante} (linguagem neutra).
 */
export const AUTOMATION_VARIABLE_ALIASES: Record<string, string> = {
  mentorada: "participante",
};

export type TriggerDefinition = {
  label: string;
  /** Texto curto para o seletor "Quando". */
  description: string;
  kind: TriggerKind;
  audiences: AutomationAudience[];
  variables: string[];
  sample: Record<string, string>;
};

const LINK = "https://board.mentoriarisenow.com.br/";

export const TRIGGER_DEFINITIONS: Record<AutomationTrigger, TriggerDefinition> = {
  weekly_schedule: {
    label: "Cronograma da semana",
    description:
      "Uma vez por semana, no dia e horário escolhidos, com os encontros coletivos e aulas da semana seguinte",
    kind: "weekly",
    audiences: ["group"],
    variables: ["semana", "cronograma", "link"],
    sample: {
      semana: "10/11 a 16/11",
      cronograma:
        "• Seg 10/11 às 19:00 — Forward Reflection (Camila Um)\n• Qui 13/11 às 20:00 — Aula: Identidade (Gabriela Ribeiro)",
      link: LINK,
    },
  },
  group_meeting_before: {
    label: "Antes de encontro coletivo ou aula",
    description:
      "Um tempo antes de cada encontro coletivo ou aula (use 0 para enviar na hora, com o link)",
    kind: "before",
    audiences: ["group", "mentees", "mentor"],
    variables: ["nome", "encontro", "data", "hora", "mentora", "link_encontro", "link"],
    sample: {
      nome: "Mariana",
      encontro: "Forward Reflection",
      data: "12/11",
      hora: "19:00",
      mentora: "Camila Um",
      link_encontro: "https://meet.google.com/abc-defg-hij",
      link: `${LINK}?view=agenda`,
    },
  },
  booking_slots_available: {
    label: "Horários de 1:1 liberados",
    description: "Quando uma mentora libera (ou reativa) horários de 1:1 para agendamento",
    kind: "event",
    audiences: ["mentees"],
    variables: ["nome", "mentora", "encontro", "link"],
    sample: {
      nome: "Mariana",
      mentora: "Camila Mariano",
      encontro: "Mentoria individual de Direção",
      link: `${LINK}?view=agenda`,
    },
  },
  booking_before: {
    label: "Antes de um 1:1 agendado",
    description: "Um tempo antes de cada 1:1 confirmado (ex.: 1 dia antes, 1 hora antes)",
    kind: "before",
    audiences: ["mentees", "mentor"],
    variables: [
      "nome",
      "participante",
      "mentora",
      "encontro",
      "data",
      "hora",
      "link_encontro",
      "link",
    ],
    sample: {
      nome: "Mariana",
      participante: "Mariana Souza",
      mentora: "Camila Mariano",
      encontro: "Mentoria individual de Direção",
      data: "12/11",
      hora: "15:00",
      link_encontro: "https://meet.google.com/abc-defg-hij",
      link: `${LINK}?view=agenda`,
    },
  },
  booking_confirmed: {
    label: "1:1 agendado",
    description: "Assim que alguém da turma agenda um 1:1",
    kind: "event",
    audiences: ["mentor", "mentees"],
    variables: ["nome", "participante", "mentora", "encontro", "data", "hora", "link"],
    sample: {
      nome: "Camila",
      participante: "Mariana Souza",
      mentora: "Camila Mariano",
      encontro: "Mentoria individual de Direção",
      data: "12/11",
      hora: "15:00",
      link: `${LINK}?view=agenda`,
    },
  },
  questionnaire_submitted: {
    label: "Questionário respondido",
    description: "Quando alguém da turma envia um questionário de etapa",
    kind: "event",
    audiences: ["mentor", "staff"],
    variables: ["nome", "participante", "questionario", "link"],
    sample: {
      nome: "Camila",
      participante: "Mariana Souza",
      questionario: "Questionário de Clareza",
      link: LINK,
    },
  },
  assessment_completed: {
    label: "Mapeamento comportamental concluído",
    description: "Quando alguém da turma conclui o diagnóstico (mapeamento comportamental)",
    kind: "event",
    audiences: ["mentor", "staff"],
    variables: ["nome", "participante", "link"],
    sample: { nome: "Camila", participante: "Mariana Souza", link: LINK },
  },
  goal_created: {
    label: "Meta do RISE 90 preenchida",
    description: "Quando alguém da turma cadastra uma meta no RISE 90",
    kind: "event",
    audiences: ["mentor", "staff"],
    variables: ["nome", "participante", "meta", "link"],
    sample: {
      nome: "Camila",
      participante: "Mariana Souza",
      meta: "Assumir a gerência regional",
      link: LINK,
    },
  },
  stage_completed: {
    label: "Etapa concluída",
    description: "Quando uma etapa da jornada de alguém da turma é concluída",
    kind: "event",
    audiences: ["mentor", "staff", "mentees"],
    variables: ["nome", "participante", "etapa", "link"],
    sample: {
      nome: "Camila",
      participante: "Mariana Souza",
      etapa: "Mapa de Clareza RISE",
      link: `${LINK}?view=jornada`,
    },
  },
  account_created: {
    label: "Conta criada",
    description: "Quando alguém é convidado para a plataforma",
    kind: "event",
    audiences: ["member"],
    variables: ["nome", "email", "link"],
    sample: { nome: "Mariana", email: "mariana@email.com", link: LINK },
  },
};

export type AutomationInput = {
  name: string;
  trigger: AutomationTrigger;
  audience: AutomationAudience;
  offsetMinutes: number;
  weekday: number | null;
  sendTime: string | null;
  template: string;
  enabled: boolean;
};

export const MAX_AUTOMATION_TEMPLATE = 1500;
export const MAX_OFFSET_MINUTES = 14 * 24 * 60;
export const WEEKDAY_LABELS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const isTrigger = (value: unknown): value is AutomationTrigger =>
  typeof value === "string" && (AUTOMATION_TRIGGERS as readonly string[]).includes(value);

/** Valida o que vem do painel. Lança erro com mensagem amigável em português. */
export function sanitizeAutomation(input: unknown): AutomationInput {
  const raw = (input && typeof input === "object" ? input : {}) as {
    name?: unknown;
    trigger?: unknown;
    audience?: unknown;
    template?: unknown;
    offsetMinutes?: unknown;
    weekday?: unknown;
    sendTime?: unknown;
    enabled?: unknown;
  };
  const name = String(raw.name ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 3 || name.length > 120)
    throw new Error("Dê um nome de 3 a 120 caracteres para a automação.");
  if (!isTrigger(raw.trigger)) throw new Error("Escolha quando a automação deve acontecer.");
  const trigger = raw.trigger;
  const definition = TRIGGER_DEFINITIONS[trigger];
  const audience = String(raw.audience ?? "") as AutomationAudience;
  if (!definition.audiences.includes(audience))
    throw new Error("Esse público não está disponível para esse gatilho.");
  const template = String(raw.template ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!template) throw new Error("Escreva o texto da mensagem.");
  if (template.length > MAX_AUTOMATION_TEMPLATE)
    throw new Error(`O texto passou de ${MAX_AUTOMATION_TEMPLATE} caracteres.`);
  // Variável inexistente sairia literalmente na mensagem (ex.: "{titulo}"): bloqueia ao salvar.
  const unknown = unknownAutomationVariables(trigger, template);
  if (unknown.length)
    throw new Error(
      `Este gatilho não reconhece ${unknown.map((name) => `{${name}}`).join(", ")}. Use: ${definition.variables
        .map((name) => `{${name}}`)
        .join(", ")}.`,
    );

  let offsetMinutes = 0;
  let weekday: number | null = null;
  let sendTime: string | null = null;
  if (definition.kind === "before") {
    offsetMinutes = Math.round(Number(raw.offsetMinutes ?? 0));
    if (!Number.isFinite(offsetMinutes) || offsetMinutes < 0 || offsetMinutes > MAX_OFFSET_MINUTES)
      throw new Error("A antecedência precisa ficar entre 0 minutos e 14 dias.");
  }
  if (definition.kind === "weekly") {
    weekday = Math.round(Number(raw.weekday));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)
      throw new Error("Escolha o dia da semana do envio.");
    sendTime = String(raw.sendTime ?? "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime))
      throw new Error("Informe o horário do envio no formato hh:mm.");
  }
  return {
    name,
    trigger,
    audience,
    offsetMinutes,
    weekday,
    sendTime,
    template,
    enabled: raw.enabled === true,
  };
}

export function formatOffset(minutes: number) {
  if (minutes === 0) return "na hora";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 dia antes" : `${days} dias antes`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hora antes" : `${hours} horas antes`;
  }
  return `${minutes} minutos antes`;
}

/** Frase curta que descreve quando e para quem a automação envia. */
export function describeAutomation(
  a: Pick<AutomationInput, "trigger" | "audience" | "offsetMinutes" | "weekday" | "sendTime">,
) {
  const definition = TRIGGER_DEFINITIONS[a.trigger];
  const who = AUDIENCE_LABELS[a.audience];
  if (definition.kind === "weekly")
    return `Toda ${WEEKDAY_LABELS[a.weekday ?? 5]} às ${a.sendTime ?? "17:00"} → ${who}`;
  if (a.trigger === "group_meeting_before")
    return `${formatOffset(a.offsetMinutes)} de cada encontro coletivo ou aula → ${who}`;
  if (a.trigger === "booking_before")
    return `${formatOffset(a.offsetMinutes)} de cada 1:1 agendado → ${who}`;
  return `${definition.label} → ${who}`;
}

/** Variáveis escritas no texto que não existem para este gatilho. */
export function unknownAutomationVariables(trigger: AutomationTrigger, text: string) {
  const allowed = new Set(TRIGGER_DEFINITIONS[trigger].variables);
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
  return [...new Set(found.filter((name) => !allowed.has(resolveVariable(name))))];
}

const resolveVariable = (name: string) => AUTOMATION_VARIABLE_ALIASES[name] ?? name;

/** Troca nomes antigos de variável pelos atuais (ex.: {mentorada} → {participante}). */
export function modernizeAutomationTemplate(text: string) {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    AUTOMATION_VARIABLE_ALIASES[name] ? `{${AUTOMATION_VARIABLE_ALIASES[name]}}` : match,
  );
}

/**
 * Monta a mensagem. Variáveis desconhecidas ficam como estão; se {nome} estiver
 * vazio, a vírgula antes dele some ("Olá, {nome}!" vira "Olá!").
 */
export function renderAutomation(
  trigger: AutomationTrigger,
  template: string,
  variables: Record<string, string | null | undefined>,
) {
  const allowed = new Set(TRIGGER_DEFINITIONS[trigger].variables);
  let text = template;
  const name = variables["nome"]?.replace(/\s+/g, " ").trim();
  if (!name) text = text.replace(/[,\s]*\{nome\}/g, "");
  return text
    .replace(/\{(\w+)\}/g, (match, written: string) => {
      const variable = resolveVariable(written);
      if (!allowed.has(variable)) return match;
      const value = variables[variable];
      if (value === null || value === undefined) return "";
      return variable === "cronograma" ? value.trim() : value.replace(/\s+/g, " ").trim();
    })
    .trim();
}

export type DefaultAutomation = AutomationInput & { key: string };

/** Automações iniciais (todas desligadas) criadas pela migration. */
export const DEFAULT_AUTOMATIONS: DefaultAutomation[] = [
  {
    key: "weekly_schedule",
    name: "Cronograma da semana no grupo",
    trigger: "weekly_schedule",
    audience: "group",
    offsetMinutes: 0,
    weekday: 5,
    sendTime: "17:00",
    enabled: false,
    template:
      "📅 *Cronograma RISE NOW — semana de {semana}*\n\n{cronograma}\n\nOs links de cada encontro chegam aqui no grupo no dia. Até lá! ✨",
  },
  {
    key: "group_meeting_2h",
    name: "Aviso 2h antes do encontro coletivo",
    trigger: "group_meeting_before",
    audience: "group",
    offsetMinutes: 120,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "⏰ *Hoje tem RISE NOW!*\n\nO encontro *{encontro}* começa às {hora}, com {mentora}.\n\nO link chega aqui no grupo na hora do encontro.",
  },
  {
    key: "group_meeting_now",
    name: "Link na hora do encontro coletivo",
    trigger: "group_meeting_before",
    audience: "group",
    offsetMinutes: 0,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "🔴 *Estamos começando!*\n\n*{encontro}* com {mentora}.\n\nEntre pelo link:\n{link_encontro}",
  },
  {
    key: "booking_slots_available",
    name: "Horários de 1:1 liberados",
    trigger: "booking_slots_available",
    audience: "mentees",
    offsetMinutes: 0,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! ✨\n\n{mentora} liberou horários para *{encontro}* na RISE NOW.\n\nEscolha o melhor horário para você:\n{link}",
  },
  {
    key: "booking_1day",
    name: "Lembrete do 1:1 (1 dia antes)",
    trigger: "booking_before",
    audience: "mentees",
    offsetMinutes: 1440,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! 📅\n\nLembrete da *RISE NOW*: amanhã, {data} às {hora}, você tem o seu 1:1 com {mentora}.\n\nDetalhes na plataforma:\n{link}",
  },
  {
    key: "booking_1hour",
    name: "Lembrete do 1:1 (1 hora antes)",
    trigger: "booking_before",
    audience: "mentees",
    offsetMinutes: 60,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! ⏰\n\nSeu 1:1 com {mentora} começa às {hora}.\n\nLink da chamada:\n{link_encontro}",
  },
  {
    key: "mentor_questionnaire",
    name: "Mentora: questionário respondido",
    trigger: "questionnaire_submitted",
    audience: "mentor",
    offsetMinutes: 0,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! 📝\n\n{participante} respondeu o questionário *{questionario}* na RISE NOW.\n\nVeja as respostas:\n{link}",
  },
  {
    key: "mentor_assessment",
    name: "Mentora: diagnóstico concluído",
    trigger: "assessment_completed",
    audience: "staff",
    offsetMinutes: 0,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! 🧭\n\n{participante} concluiu o mapeamento comportamental na RISE NOW.\n\nVeja o resultado:\n{link}",
  },
  {
    key: "mentor_booking",
    name: "Mentora: 1:1 agendado com ela",
    trigger: "booking_confirmed",
    audience: "mentor",
    offsetMinutes: 0,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! 📅\n\n{participante} agendou *{encontro}* com você para {data} às {hora}.\n\nVeja na agenda:\n{link}",
  },
  {
    key: "mentor_goal",
    name: "Mentora: meta do RISE 90 preenchida",
    trigger: "goal_created",
    audience: "staff",
    offsetMinutes: 0,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! 🎯\n\n{participante} cadastrou uma nova meta no RISE 90: *{meta}*.\n\nAcompanhe:\n{link}",
  },
  {
    key: "mentor_stage",
    name: "Mentora: etapa concluída",
    trigger: "stage_completed",
    audience: "mentor",
    offsetMinutes: 0,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! ✅\n\n{participante} concluiu a etapa *{etapa}* na RISE NOW.\n\nAcompanhe o progresso:\n{link}",
  },
  {
    key: "account_created",
    name: "Conta criada",
    trigger: "account_created",
    audience: "member",
    offsetMinutes: 0,
    weekday: null,
    sendTime: null,
    enabled: false,
    template:
      "Olá, {nome}! ✨\n\nSeu acesso à plataforma *RISE NOW* foi criado.\n\nEnviamos para o seu e-mail ({email}) o link seguro para ativar a conta e definir sua senha. Depois, é só entrar por aqui:\n{link}",
  },
];

/** Partes de data/hora no fuso de São Paulo (sem horário de verão: UTC−3). */
export function saoPauloParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdays.indexOf(get("weekday")),
    isoDate: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export const formatDayMonth = (date: Date) => {
  const p = saoPauloParts(date);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`;
};
export const formatHour = (date: Date) => {
  const p = saoPauloParts(date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

/** Segunda a domingo da semana seguinte, em São Paulo (início e fim em UTC). */
export function nextWeekRange(now: Date) {
  const p = saoPauloParts(now);
  const daysToNextMonday = (8 - p.weekday) % 7 || 7;
  const startLocal = Date.UTC(p.year, p.month - 1, p.day + daysToNextMonday, 3, 0, 0); // 00:00 em SP
  const start = new Date(startLocal);
  const end = new Date(startLocal + 7 * 86_400_000);
  return {
    start,
    end,
    label: `${formatDayMonth(start)} a ${formatDayMonth(new Date(end.getTime() - 1))}`,
  };
}

const SHORT_WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function formatScheduleLines(
  meetings: Array<{ title: string; scheduled_at: string; mentor_name?: string | null }>,
) {
  if (!meetings.length) return "Sem encontros coletivos ou aulas agendados para essa semana.";
  return meetings
    .slice()
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .map((meeting) => {
      const date = new Date(meeting.scheduled_at);
      const p = saoPauloParts(date);
      const who = meeting.mentor_name ? ` (${meeting.mentor_name})` : "";
      return `• ${SHORT_WEEKDAYS[p.weekday]} ${formatDayMonth(date)} às ${formatHour(date)} — ${meeting.title}${who}`;
    })
    .join("\n");
}

/** A automação semanal deve disparar agora? (dia certo e horário já alcançado). */
export function weeklyIsDue(now: Date, weekday: number, sendTime: string) {
  const p = saoPauloParts(now);
  const [h, m] = sendTime.split(":").map(Number);
  return p.weekday === weekday && p.hour * 60 + p.minute >= h! * 60 + m!;
}
