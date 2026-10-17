export const ASSESSMENT_VERSION = "rise-behavioral-1.0";
export const SCORING_VERSION = "rise-scoring-1.0";
export const PROMPT_VERSION = "rise-insights-pending-1.0";

export type AssessmentPerspective = "natural" | "adapted" | "motivation" | "leadership";

export type AssessmentQuestion = {
  id: string;
  perspective: AssessmentPerspective;
  block: string;
  prompt: string;
  guidance: string;
  scale: "frequency" | "importance";
  baseKey?: string;
};

const naturalItems = [
  [
    "initiative",
    "Quando algo precisa começar e ninguém toma a iniciativa, costumo propor um primeiro passo.",
  ],
  [
    "direction",
    "Quando existe uma situação sem encaminhamento claro, costumo indicar uma direção possível.",
  ],
  ["objectivity", "Ao explicar uma recomendação, costumo ir diretamente aos pontos essenciais."],
  [
    "positioning",
    "Quando há opiniões diferentes, costumo apresentar com clareza o meu ponto de vista.",
  ],
  ["influence", "Costumo envolver outras pessoas para construir adesão a uma ideia ou caminho."],
  ["expression", "Costumo expressar ideias e decisões de forma aberta para o grupo."],
  [
    "energy",
    "Em atividades coletivas, costumo demonstrar energia para manter o movimento do grupo.",
  ],
  ["interaction", "Em grupos, costumo iniciar conversas e trocar ideias espontaneamente."],
  [
    "people",
    "Antes de decidir, costumo considerar como a escolha pode afetar as pessoas envolvidas.",
  ],
  ["calm", "Mesmo sob pressão, costumo preservar a calma antes de agir."],
  [
    "continuity",
    "Quando começo algo importante, costumo buscar continuidade mesmo depois que a novidade passa.",
  ],
  ["planning", "Antes de iniciar uma atividade relevante, costumo organizar etapas e prioridades."],
  [
    "organization",
    "Costumo manter informações, prazos e combinados organizados ao longo da execução.",
  ],
  ["details", "Antes de concluir uma atividade, costumo conferir detalhes e requisitos."],
  ["caution", "Antes de escolher um caminho, costumo avaliar riscos e consequências possíveis."],
  [
    "focus",
    "Quando uma atividade exige atenção prolongada, costumo manter a concentração até concluir uma etapa.",
  ],
  [
    "decision",
    "Antes de decidir, costumo comparar alternativas usando as informações disponíveis.",
  ],
  [
    "autonomy",
    "Ao dividir uma responsabilidade, costumo dar espaço para a outra pessoa escolher como executar.",
  ],
  [
    "divergence",
    "Diante de uma discordância, costumo explorar os argumentos antes de definir um encaminhamento.",
  ],
] as const;

const adaptedPrompts = [
  "No trabalho, quando algo precisa começar e ninguém toma a iniciativa, com que frequência você assume o primeiro passo?",
  "No trabalho, diante de uma situação sem encaminhamento claro, com que frequência você indica uma direção possível?",
  "No ambiente profissional, com que frequência você comunica recomendações de forma direta e objetiva?",
  "No trabalho, quando existem opiniões diferentes, com que frequência você apresenta claramente sua recomendação?",
  "No trabalho, com que frequência você envolve outras pessoas para construir adesão a uma ideia ou caminho?",
  "No ambiente profissional, com que frequência você expressa ideias e decisões de forma aberta para o grupo?",
  "No trabalho, com que frequência você demonstra energia para manter uma atividade coletiva em movimento?",
  "No ambiente profissional, com que frequência você inicia conversas para trocar ideias sobre uma atividade?",
  "Antes de decidir no trabalho, com que frequência você considera o impacto sobre as pessoas envolvidas?",
  "Em situações profissionais de pressão, com que frequência você preserva a calma antes de agir?",
  "No trabalho, com que frequência você dá continuidade a uma atividade depois que a novidade passa?",
  "Antes de iniciar uma atividade profissional relevante, com que frequência você organiza etapas e prioridades?",
  "No trabalho, com que frequência você mantém informações, prazos e combinados organizados durante a execução?",
  "No ambiente profissional, antes de entregar uma atividade, com que frequência você confere detalhes e requisitos?",
  "Antes de escolher um caminho no trabalho, com que frequência você avalia riscos e consequências possíveis?",
  "Quando uma atividade profissional exige atenção prolongada, com que frequência você mantém a concentração até concluir uma etapa?",
  "Antes de tomar uma decisão profissional, com que frequência você compara alternativas usando as informações disponíveis?",
  "Ao delegar uma responsabilidade no trabalho, com que frequência você oferece autonomia sobre a forma de execução?",
  "Diante de uma divergência no trabalho, com que frequência você explora os argumentos antes de definir um encaminhamento?",
] as const;

const natural: AssessmentQuestion[] = naturalItems.map(([baseKey, prompt], index) => ({
  id: `N${String(index + 1).padStart(2, "0")}`,
  perspective: "natural",
  block: "Perfil Natural",
  prompt,
  guidance:
    "Pense nos padrões que aparecem espontaneamente em diferentes fases e situações da sua vida.",
  scale: "frequency",
  baseKey,
}));

const adapted: AssessmentQuestion[] = naturalItems.map(([baseKey], index) => ({
  id: `A${String(index + 1).padStart(2, "0")}`,
  perspective: "adapted",
  block: "Perfil Adaptado · Como você atua no trabalho",
  prompt: adaptedPrompts[index]!,
  guidance: "Responda considerando como você costuma agir profissionalmente.",
  scale: "frequency",
  baseKey,
}));

const motivationPrompts = [
  "Ter oportunidades de aprofundar meus conhecimentos e aprender algo novo.",
  "Perceber resultados concretos e retorno útil para o esforço que dedico.",
  "Realizar minhas atividades em uma rotina e ambiente que considero agradáveis.",
  "Contribuir para que outras pessoas avancem em seus objetivos.",
  "Participar das decisões e influenciar os rumos de uma atividade.",
  "Fazer escolhas coerentes com os princípios que considero importantes.",
  "Ter minhas contribuições reconhecidas nos resultados alcançados.",
] as const;

const motivation: AssessmentQuestion[] = motivationPrompts.map((prompt, index) => ({
  id: `M${String(index + 1).padStart(2, "0")}`,
  perspective: "motivation",
  block: "O que move você",
  prompt,
  guidance: "Pensando no seu contexto profissional, quanto este aspecto é importante para você?",
  scale: "importance",
}));

const leadershipPrompts = [
  "Quando coordena pessoas, projetos ou entregas, com que frequência você esclarece qual resultado precisa ser alcançado?",
  "Ao comunicar uma decisão, com que frequência você explica os motivos e o sentido do caminho escolhido?",
  "Durante uma atividade coletiva, com que frequência você acompanha prazos e combinados com o grupo?",
  "Diante de divergências, com que frequência você abre espaço para contribuições antes de definir o encaminhamento?",
  "Sob cobrança ou pressão, com que frequência você equilibra o cuidado com as pessoas e a entrega esperada?",
] as const;

const leadership: AssessmentQuestion[] = leadershipPrompts.map((prompt, index) => ({
  id: `L${String(index + 1).padStart(2, "0")}`,
  perspective: "leadership",
  block: "Como você conduz e colabora",
  prompt,
  guidance:
    "Considere também coordenação informal de projetos ou entregas, mesmo sem cargo de liderança.",
  scale: "frequency",
}));

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  ...natural,
  ...adapted,
  ...motivation,
  ...leadership,
];

export const FREQUENCY_OPTIONS = [
  { value: 1, label: "Quase nunca" },
  { value: 2, label: "Raramente" },
  { value: 3, label: "Às vezes" },
  { value: 4, label: "Frequentemente" },
  { value: 5, label: "Quase sempre" },
] as const;

export const IMPORTANCE_OPTIONS = [
  { value: 1, label: "Nada importante" },
  { value: 2, label: "Pouco importante" },
  { value: 3, label: "Moderadamente importante" },
  { value: 4, label: "Muito importante" },
  { value: 5, label: "Extremamente importante" },
] as const;

export type AssessmentAnswer = { itemId: string; value: number };
export type ScoredIndicator = {
  id: string;
  name: string;
  definition: string;
  perspective: "natural" | "adapted";
  itemIds: string[];
  responses: number[];
  score: number;
  coverage: { valid: number; required: number };
  assessmentVersion: string;
  scoringVersion: string;
};
export type CompetencyInsight = {
  id: string;
  name: string;
  definition: string;
  natural: number;
  adapted: number;
  delta: number;
  evidence: string[];
  explanation: string;
};
export type LeadershipInsight = {
  id: string;
  name: string;
  score: number;
  evidence: string[];
  reading: string;
};
export type DevelopmentInsight = {
  id: string;
  name: string;
  reason: string;
  possibleImpact: string;
  reflectionQuestion: string;
  developmentPractice: string;
  evidence: string[];
};
export type StrengthInsight = {
  id: string;
  name: string;
  behavior: string;
  contribution: string;
  possibleExcess: string;
  evidence: string[];
};
export type BookRecommendation = {
  title: string;
  author: string;
  summary: string;
  rationale: string;
  sources: string[];
  searchedAt: string;
};
export type DevelopmentPlanSuggestion = {
  priority: string;
  targetBehavior: string;
  action: string;
  observableEvidence: string;
  frequency: string;
  suggestedReview: string;
  rationale: string;
};
export type AIInterpretationInput = {
  audience: "mentee_summary" | "mentor_full";
  authorizedSections: string[];
  result: CalculatedAssessmentResult;
};
export type MentorInsightOutput = {
  leadership: LeadershipInsight[];
  competencies: CompetencyInsight[];
  development: DevelopmentInsight[];
  questions: string[];
  communicationAdvice: string[];
  actionSuggestions: DevelopmentPlanSuggestion[];
  books: BookRecommendation[];
  promptVersion: string;
};

export type CalculatedAssessmentResult = {
  assessmentVersion: string;
  scoringVersion: string;
  promptVersion: string;
  calculatedAt: string;
  responseCount: number;
  indicators: ScoredIndicator[];
  competencies: CompetencyInsight[];
  comparisons: Array<{
    id: string;
    name: string;
    natural: number;
    adapted: number;
    delta: number;
    evidence: string[];
  }>;
  motivations: Array<{ id: string; name: string; score: number; evidence: string[] }>;
  leadership: LeadershipInsight[];
  strengths: StrengthInsight[];
  development: DevelopmentInsight[];
  summary: {
    headline: string;
    highlights: string[];
    strongestMotivations: string[];
    relevantDifference: string | null;
    notice: string;
  };
  limitations: string[];
};

export type AssessmentReportAudience = "mentee_summary" | "mentee_full" | "mentor_full";

export function filterAssessmentResultForAudience(
  result: CalculatedAssessmentResult,
  audience: AssessmentReportAudience,
): CalculatedAssessmentResult | Partial<CalculatedAssessmentResult> {
  if (audience !== "mentee_summary") return result;
  return {
    assessmentVersion: result.assessmentVersion,
    scoringVersion: result.scoringVersion,
    calculatedAt: result.calculatedAt,
    responseCount: result.responseCount,
    indicators: result.indicators,
    competencies: result.competencies,
    comparisons: result.comparisons,
    motivations: result.motivations,
    strengths: result.strengths,
    summary: result.summary,
    limitations: result.limitations,
  };
}

type CompetencyDefinition = { id: string; name: string; definition: string; keys: string[] };
const competencyDefinitions: CompetencyDefinition[] = [
  {
    id: "initiative",
    name: "Iniciativa",
    definition: "Tendência relatada de iniciar encaminhamentos.",
    keys: ["initiative", "direction"],
  },
  {
    id: "direction",
    name: "Direcionamento",
    definition: "Prática relatada de indicar caminhos e resultados.",
    keys: ["direction"],
  },
  {
    id: "objectivity",
    name: "Objetividade",
    definition: "Tendência a priorizar pontos essenciais na comunicação.",
    keys: ["objectivity", "decision"],
  },
  {
    id: "positioning",
    name: "Posicionamento",
    definition: "Prática relatada de apresentar uma recomendação com clareza.",
    keys: ["positioning", "divergence"],
  },
  {
    id: "influence",
    name: "Influência construtiva",
    definition: "Tendência a construir adesão sem pressupor poder formal.",
    keys: ["influence"],
  },
  {
    id: "expression",
    name: "Expressão",
    definition: "Frequência relatada de tornar ideias e decisões explícitas.",
    keys: ["expression"],
  },
  {
    id: "energy",
    name: "Energia de mobilização",
    definition: "Tendência a sustentar movimento em atividades coletivas.",
    keys: ["energy"],
  },
  {
    id: "interaction",
    name: "Interação",
    definition: "Prática relatada de iniciar trocas com outras pessoas.",
    keys: ["interaction"],
  },
  {
    id: "people",
    name: "Consideração pelas pessoas",
    definition: "Atenção relatada ao impacto das decisões nas pessoas.",
    keys: ["people"],
  },
  {
    id: "calm",
    name: "Tranquilidade",
    definition: "Tendência relatada de preservar calma antes de agir sob pressão.",
    keys: ["calm"],
  },
  {
    id: "continuity",
    name: "Continuidade",
    definition: "Prática relatada de sustentar a atuação ao longo do tempo.",
    keys: ["continuity"],
  },
  {
    id: "planning",
    name: "Planejamento",
    definition: "Frequência relatada de organizar etapas e prioridades.",
    keys: ["planning"],
  },
  {
    id: "organization",
    name: "Organização",
    definition: "Prática relatada de manter informações, prazos e acordos acessíveis.",
    keys: ["organization"],
  },
  {
    id: "details",
    name: "Atenção a detalhes",
    definition: "Frequência relatada de conferir requisitos antes da conclusão.",
    keys: ["details"],
  },
  {
    id: "caution",
    name: "Cautela",
    definition: "Tendência a avaliar riscos, consequências e informações.",
    keys: ["caution", "decision"],
  },
  {
    id: "focus",
    name: "Concentração",
    definition: "Prática relatada de manter atenção até concluir uma etapa.",
    keys: ["focus"],
  },
];

const motivationNames = [
  "Aprendizado e aprofundamento",
  "Retorno útil do esforço",
  "Qualidade da experiência",
  "Contribuição para outras pessoas",
  "Participação nos rumos",
  "Coerência com princípios",
  "Reconhecimento da contribuição",
];

function round(value: number) {
  return Math.round(value * 100) / 100;
}
function average(values: number[]) {
  if (!values.length) throw new Error("Não é possível calcular uma média sem respostas.");
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreByKeys(values: Map<string, number>, perspective: "N" | "A", keys: string[]) {
  const ids = keys.map((key) => {
    const index = naturalItems.findIndex(([candidate]) => candidate === key);
    return `${perspective}${String(index + 1).padStart(2, "0")}`;
  });
  return { ids, values: ids.map((id) => values.get(id)!) };
}

export function calculateAssessment(answers: AssessmentAnswer[]): CalculatedAssessmentResult {
  const values = new Map(answers.map((answer) => [answer.itemId, answer.value]));
  const expected = new Set(ASSESSMENT_QUESTIONS.map((question) => question.id));
  if (values.size !== expected.size || [...expected].some((id) => !values.has(id)))
    throw new Error(`O mapeamento precisa das ${expected.size} respostas para ser calculado.`);
  if (
    [...values].some(
      ([id, value]) => !expected.has(id) || !Number.isInteger(value) || value < 1 || value > 5,
    )
  )
    throw new Error("Há respostas fora da escala permitida de 1 a 5.");

  const competencies = competencyDefinitions.map((definition): CompetencyInsight => {
    const n = scoreByKeys(values, "N", definition.keys);
    const a = scoreByKeys(values, "A", definition.keys);
    const naturalScore = average(n.values);
    const adaptedScore = average(a.values);
    const delta = round(adaptedScore - naturalScore);
    return {
      id: definition.id,
      name: definition.name,
      definition: definition.definition,
      natural: naturalScore,
      adapted: adaptedScore,
      delta,
      evidence: [...n.ids, ...a.ids],
      explanation:
        Math.abs(delta) >= 1
          ? `A prática relatada no trabalho aparece ${delta > 0 ? "mais" : "menos"} frequente do que na perspectiva Natural. É um tema para explorar, não uma conclusão sobre adequação ou bem-estar.`
          : "As duas perspectivas aparecem próximas neste indicador de desenvolvimento RISE.",
    };
  });

  const indicatorGroups = [
    {
      id: "forward",
      name: "Iniciativa de encaminhamento",
      definition: "Iniciar e indicar direção.",
      keys: ["initiative", "direction", "objectivity"],
    },
    {
      id: "exchange",
      name: "Iniciativa de troca",
      definition: "Interagir, expressar e construir adesão.",
      keys: ["interaction", "expression", "influence"],
    },
    {
      id: "continuity",
      name: "Continuidade da atuação",
      definition: "Sustentar foco, calma e continuidade.",
      keys: ["continuity", "focus", "calm"],
    },
    {
      id: "criteria",
      name: "Uso de critérios",
      definition: "Planejar, conferir e avaliar consequências.",
      keys: ["planning", "details", "caution"],
    },
  ];
  const indicators = indicatorGroups.flatMap((group) =>
    (["natural", "adapted"] as const).map((perspective): ScoredIndicator => {
      const data = scoreByKeys(values, perspective === "natural" ? "N" : "A", group.keys);
      return {
        id: `${group.id}_${perspective}`,
        name: group.name,
        definition: group.definition,
        perspective,
        itemIds: data.ids,
        responses: data.values,
        score: average(data.values),
        coverage: { valid: data.values.length, required: data.ids.length },
        assessmentVersion: ASSESSMENT_VERSION,
        scoringVersion: SCORING_VERSION,
      };
    }),
  );

  const comparisons = competencies.map((item) => ({
    id: item.id,
    name: item.name,
    natural: item.natural,
    adapted: item.adapted,
    delta: item.delta,
    evidence: item.evidence,
  }));
  const motivations = motivationNames.map((name, index) => ({
    id: `motivation_${index + 1}`,
    name,
    score: values.get(`M${String(index + 1).padStart(2, "0")}`)!,
    evidence: [`M${String(index + 1).padStart(2, "0")}`],
  }));

  const leadershipDefinitions = [
    {
      id: "assume_direction",
      name: "Assumir direção",
      ids: ["A01", "A02", "L01"],
      reading: "Como indica caminhos e torna o resultado esperado mais claro.",
    },
    {
      id: "mobilize",
      name: "Mobilizar pelo sentido",
      ids: ["A05", "A07", "L02"],
      reading: "Como constrói adesão e explica o sentido da ação.",
    },
    {
      id: "communicate",
      name: "Comunicar decisões",
      ids: ["A03", "A06", "L02"],
      reading: "Como torna decisões e argumentos compreensíveis.",
    },
    {
      id: "follow_up",
      name: "Acompanhar acordos",
      ids: ["A11", "A13", "L03"],
      reading: "Como sustenta acompanhamento sem reduzir liderança a controle.",
    },
    {
      id: "delegate",
      name: "Delegar com autonomia",
      ids: ["A18", "L01"],
      reading: "Como combina clareza de resultado e espaço de execução.",
    },
    {
      id: "divergence",
      name: "Conduzir divergências",
      ids: ["A04", "A19", "L04"],
      reading: "Como escuta argumentos e assume um encaminhamento.",
    },
    {
      id: "people_delivery",
      name: "Equilibrar pessoas e entregas",
      ids: ["A09", "L05"],
      reading: "Como considera impactos humanos junto da entrega esperada.",
    },
    {
      id: "pressure",
      name: "Responder à pressão",
      ids: ["A10", "A15", "L05"],
      reading: "Como combina calma, cautela e ação sob cobrança.",
    },
  ];
  const leadershipResult = leadershipDefinitions.map((item): LeadershipInsight => ({
    id: item.id,
    name: item.name,
    score: average(item.ids.map((id) => values.get(id)!)),
    evidence: item.ids,
    reading: item.reading,
  }));

  const ranked = [...competencies].sort(
    (a, b) => b.adapted - a.adapted || a.name.localeCompare(b.name),
  );
  const strengths = ranked.slice(0, 3).map((item): StrengthInsight => ({
    id: item.id,
    name: item.name,
    behavior: `${item.name} aparece entre as práticas mais frequentes relatadas no trabalho (${item.adapted.toFixed(1)} de 5).`,
    contribution: `Pode contribuir quando o contexto pede ${item.definition.toLowerCase()}`,
    possibleExcess:
      "Em excesso ou sem leitura de contexto, a mesma tendência pode limitar outras formas de agir. Vale observar quando flexibilizá-la.",
    evidence: item.evidence,
  }));
  const development = [...competencies]
    .sort((a, b) => a.adapted - b.adapted || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((item): DevelopmentInsight => ({
      id: item.id,
      name: item.name,
      reason: `${item.name} aparece com frequência relativa menor no contexto profissional (${item.adapted.toFixed(1)} de 5). Isso não é uma avaliação de capacidade; é uma prioridade possível para conversa.`,
      possibleImpact:
        "Dependendo do objetivo e do contexto, ampliar o repertório neste tema pode tornar escolhas e entregas mais intencionais.",
      reflectionQuestion: `Em quais situações desenvolver mais ${item.name.toLowerCase()} faria diferença concreta?`,
      developmentPractice: `Escolha uma situação real da próxima semana e defina um comportamento observável ligado a ${item.name.toLowerCase()}.`,
      evidence: item.evidence,
    }));

  const topMotivationScore = Math.max(...motivations.map((item) => item.score));
  const strongestMotivations = motivations
    .filter((item) => item.score === topMotivationScore)
    .map((item) => item.name);
  const relevant = [...comparisons].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]!;
  return {
    assessmentVersion: ASSESSMENT_VERSION,
    scoringVersion: SCORING_VERSION,
    promptVersion: PROMPT_VERSION,
    calculatedAt: new Date().toISOString(),
    responseCount: values.size,
    indicators,
    competencies,
    comparisons,
    motivations,
    leadership: leadershipResult,
    strengths,
    development,
    summary: {
      headline: "Uma leitura inicial do seu Mapeamento Comportamental RISE",
      highlights: strengths.slice(0, 2).map((item) => item.behavior),
      strongestMotivations,
      relevantDifference:
        Math.abs(relevant.delta) >= 1
          ? `${relevant.name}: a frequência relatada no trabalho aparece ${relevant.delta > 0 ? "maior" : "menor"} que na perspectiva Natural.`
          : null,
      notice:
        "Esta é uma leitura inicial. A análise completa poderá ser aprofundada e liberada pela sua mentora.",
    },
    limitations: [
      "Autorrelato exploratório para conversas de desenvolvimento; não é diagnóstico nem avaliação objetiva de desempenho.",
      "As pontuações usam a escala de 1 a 5 e não representam percentis ou porcentagens de personalidade.",
      "Diferenças entre perspectivas não comprovam sofrimento, falsidade, conflito ou adequação profissional.",
    ],
  };
}

export async function generateMentorInsights(
  _input: AIInterpretationInput,
): Promise<MentorInsightOutput> {
  throw new Error("Integração de IA ainda não conectada.");
}
