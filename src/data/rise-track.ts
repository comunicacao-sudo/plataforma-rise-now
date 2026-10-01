// Official RISE NOW 6-month track. Mirrors the rows seeded in the database;
// the demo mode renders this file directly.
export type TrackLesson = {
  title: string;
  kind: "aula" | "encontro";
  format?: "Coletivo" | "1:1";
  mentor: string;
  duration: number;
  description: string;
  topics: string[];
};

export type TrackPhase = {
  month: number;
  title: string;
  pillar: string;
  mentor: string;
  question: string;
  description: string;
  deliverable: { title: string; description: string };
  lessons: TrackLesson[];
};

const CU = "Camila Um";
const GR = "Gabriela Ribeiro";
const LM = "Luiza Mendes";
const CM = "Camila Mariano";
const ALL = "As quatro mentoras";

export const track: TrackPhase[] = [
  {
    month: 1,
    title: "Reflexão",
    pillar: "R",
    mentor: CU,
    question: "Onde estou?",
    description:
      "Escuta ativa, diagnóstico de trajetória, forças, gaps, autoconsciência (DISC) e clareza de momento.",
    deliverable: {
      title: "Mapa de Clareza RISE",
      description: "Sua leitura de momento: trajetória, forças, gaps e o que precisa mudar.",
    },
    lessons: [
      { title: "Onboarding RISE", kind: "encontro", format: "Coletivo", mentor: ALL, duration: 90, description: "Boas-vindas à jornada, apresentação das mentoras, do método e dos combinados do grupo.", topics: ["O método RISE", "Como a jornada funciona", "Combinados e ritmo"] },
      { title: "Mapa de Esclarecimento", kind: "encontro", format: "1:1", mentor: CU, duration: 60, description: "Sessão individual de escuta ativa para mapear trajetória, momento e dilemas atuais.", topics: ["Diagnóstico de trajetória", "Forças e gaps", "Dilemas do momento"] },
      { title: "Consciência & Leitura de Ambiente", kind: "aula", mentor: CU, duration: 38, description: "Autoconsciência, padrões de comportamento e leitura de contexto para decisões mais claras.", topics: ["Autoconsciência", "Perfil DISC", "Leitura de contexto"] },
      { title: "Forward Reflection", kind: "encontro", format: "Coletivo", mentor: CU, duration: 90, description: "Encontro coletivo para transformar reflexão em perspectiva de futuro.", topics: ["Padrões que se repetem", "O que levar adiante", "Troca entre mentoradas"] },
      { title: "Consolidação", kind: "encontro", format: "1:1", mentor: CU, duration: 60, description: "Fechamento do mês: consolidar aprendizados e preparar o Mapa de Clareza RISE.", topics: ["Síntese do mês", "Clareza de momento", "Preparação da entrega"] },
    ],
  },
  {
    month: 2,
    title: "Identidade + Segurança",
    pillar: "I · S",
    mentor: `${GR} · ${LM}`,
    question: "Quem sou e como amplio minha capacidade?",
    description:
      "Semana 1: posicionamento executivo e marca pessoal. Semanas 2 a 4: IA aplicada à rotina com critério e autonomia.",
    deliverable: {
      title: "Mapa de Identidade & Plano de IA",
      description:
        "Mapa de Identidade & Posicionamento e Plano Individual de Aplicação de IA.",
    },
    lessons: [
      { title: "Self Brand & Posicionamento", kind: "aula", mentor: GR, duration: 32, description: "Transforme competência em identidade, reconheça diferenciais e construa uma percepção de valor coerente.", topics: ["Marca pessoal", "Diferenciais", "Reputação"] },
      { title: "Identity Session", kind: "encontro", format: "1:1", mentor: GR, duration: 60, description: "Diagnóstico 360 da sua presença: LinkedIn, Instagram, TikTok e WhatsApp.", topics: ["Diagnóstico 360", "Posicionamento executivo", "Presença digital"] },
      { title: "O Novo Profissional", kind: "aula", mentor: LM, duration: 41, description: "A transformação do trabalho: IA, competências humanas, adaptabilidade e produtividade.", topics: ["IA sem mistério", "Critério de pergunta", "Competências humanas"] },
      { title: "IA na Prática", kind: "encontro", format: "Coletivo", mentor: LM, duration: 90, description: "Aplicações reais de IA para ganhar produtividade no dia a dia.", topics: ["ChatGPT vs. Claude", "Ferramenta certa por tarefa", "Casos práticos"] },
      { title: "AI & Productivity Session", kind: "encontro", format: "1:1", mentor: LM, duration: 60, description: "Sessão individual para montar o seu plano de aplicação de IA na rotina.", topics: ["Mapa de tarefas", "Autonomia de processos", "Plano individual"] },
    ],
  },
  {
    month: 3,
    title: "Direção",
    pillar: "E",
    mentor: CM,
    question: "Para onde vou?",
    description: "Tomada de decisão, escolhas, riscos e o custo da não decisão.",
    deliverable: { title: "Mapa de Direção", description: "As escolhas que definem o seu próximo movimento." },
    lessons: [
      { title: "Tomada de Decisão Profissional", kind: "aula", mentor: CM, duration: 44, description: "Escolhas, riscos, trade-offs e o custo da não decisão.", topics: ["Trade-offs", "Riscos", "Custo da não decisão"] },
      { title: "RISE Decision Room", kind: "encontro", format: "Coletivo", mentor: ALL, duration: 90, description: "Dilemas reais com a perspectiva das quatro mentoras.", topics: ["Dilemas reais", "Quatro perspectivas", "Decisões de alto impacto"] },
      { title: "1:1 Direção", kind: "encontro", format: "1:1", mentor: CM, duration: 60, description: "Sessão individual para definir a direção dos próximos meses.", topics: ["Opções", "Critérios", "Direção"] },
    ],
  },
  {
    month: 4,
    title: "Execução",
    pillar: "E",
    mentor: CM,
    question: "O que vou fazer?",
    description: "Liderança, competências do próximo nível e o início do método RISE 90.",
    deliverable: { title: "RISE 90 — START", description: "Seu plano de 90 dias com metas e indicadores." },
    lessons: [
      { title: "Competências do Próximo Nível", kind: "aula", mentor: CM, duration: 36, description: "Comportamentos, liderança e capacidades para sustentar o próximo nível.", topics: ["Liderança", "Gestão de time", "Comportamentos"] },
      { title: "RISE 90 START", kind: "encontro", format: "1:1", mentor: CM, duration: 60, description: "Construção do seu plano RISE 90.", topics: ["Metas", "Indicadores", "Rotina de execução"] },
      { title: "Next Level Lab", kind: "encontro", format: "Coletivo", mentor: CM, duration: 90, description: "Laboratório coletivo de liderança e execução.", topics: ["Casos do grupo", "Liderança na prática"] },
    ],
  },
  {
    month: 5,
    title: "Consistência",
    pillar: "E",
    mentor: CM,
    question: "Estou evoluindo de verdade?",
    description: "Accountability, ajustes de rota e evidências de evolução.",
    deliverable: { title: "RISE 90 ajustado + evidências", description: "Plano revisado e as evidências do que já mudou." },
    lessons: [
      { title: "Consistência & Accountability", kind: "aula", mentor: CM, duration: 35, description: "Como manter o ritmo e medir a evolução real.", topics: ["Accountability", "Evidências", "Ajuste de rota"] },
      { title: "RISE 90 CHECKPOINT", kind: "encontro", format: "1:1", mentor: CM, duration: 60, description: "Revisão do plano RISE 90 e ajustes.", topics: ["O que funcionou", "O que ajustar"] },
      { title: "Next Level Lab — Consistência", kind: "encontro", format: "Coletivo", mentor: CM, duration: 90, description: "Encontro coletivo de troca sobre consistência.", topics: ["Troca entre mentoradas", "Obstáculos comuns"] },
    ],
  },
  {
    month: 6,
    title: "Sustentação",
    pillar: "E",
    mentor: CM,
    question: "Como sustento o próximo nível?",
    description: "Sustentabilidade da evolução, revisão final e plano de continuidade.",
    deliverable: { title: "RISE 90 Review + Plano de Continuidade", description: "Balanço da jornada e os próximos passos." },
    lessons: [
      { title: "Sustentar a Evolução", kind: "aula", mentor: CM, duration: 38, description: "Como sustentar o próximo nível depois da mentoria.", topics: ["Sustentabilidade", "Hábitos", "Continuidade"] },
      { title: "RISE Board", kind: "encontro", format: "Coletivo", mentor: CM, duration: 90, description: "Apresentação da evolução para o grupo.", topics: ["Evolução", "Feedback do grupo"] },
      { title: "RISE 90 REVIEW", kind: "encontro", format: "1:1", mentor: CM, duration: 60, description: "Revisão final do plano RISE 90.", topics: ["Resultados", "Aprendizados"] },
      { title: "RISE Closing", kind: "encontro", format: "Coletivo", mentor: ALL, duration: 90, description: "Encerramento da jornada com as quatro mentoras.", topics: ["Celebração", "Próximos passos"] },
    ],
  },
];
