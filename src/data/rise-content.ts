export type JourneyStatus = "completed" | "current" | "upcoming";

export type JourneyMonth = {
  month: number;
  title: string;
  pillar: string;
  question: string;
  deliverable: string;
  status: JourneyStatus;
  accent: string;
};

export type LearningItem = {
  id: string;
  eyebrow: string;
  title: string;
  mentor: string;
  duration: string;
  progress: number;
  accent: string;
  description: string;
  type: "Aula" | "1:1" | "Coletivo" | "Entrega";
};

export const journey: JourneyMonth[] = [
  {
    month: 1,
    title: "Reflexão",
    pillar: "R",
    question: "Onde estou?",
    deliverable: "Mapa de Clareza RISE",
    status: "completed",
    accent: "#8f3544",
  },
  {
    month: 2,
    title: "Identidade + Segurança",
    pillar: "I · S",
    question: "Quem sou e como amplio minha capacidade?",
    deliverable: "Identidade, posicionamento e plano de IA",
    status: "current",
    accent: "#c99e58",
  },
  {
    month: 3,
    title: "Direção",
    pillar: "E",
    question: "Para onde vou?",
    deliverable: "Mapa de Direção",
    status: "upcoming",
    accent: "#6d3441",
  },
  {
    month: 4,
    title: "Execução",
    pillar: "E",
    question: "O que vou fazer?",
    deliverable: "RISE 90 — START",
    status: "upcoming",
    accent: "#58242f",
  },
  {
    month: 5,
    title: "Consistência",
    pillar: "E",
    question: "Estou evoluindo de verdade?",
    deliverable: "RISE 90 ajustado + evidências",
    status: "upcoming",
    accent: "#412029",
  },
  {
    month: 6,
    title: "Sustentação",
    pillar: "E",
    question: "Como sustento o próximo nível?",
    deliverable: "RISE 90 Review + continuidade",
    status: "upcoming",
    accent: "#321b22",
  },
];
export const continueLearning: LearningItem[] = [
  {
    id: "self-brand",
    eyebrow: "Mês 2 · Identidade",
    title: "Self Brand",
    mentor: "Gabriela Ribeiro",
    duration: "32 min",
    progress: 62,
    accent: "linear-gradient(135deg, #a34c61 0%, #3e111d 72%, #11070a 100%)",
    description:
      "Transforme competência em identidade, reconheça seus diferenciais e construa uma percepção de valor coerente.",
    type: "Aula",
  },
  {
    id: "identity-session",
    eyebrow: "Sessão individual",
    title: "Identity Session",
    mentor: "Gabriela Ribeiro",
    duration: "60 min",
    progress: 0,
    accent: "linear-gradient(135deg, #d3b173 0%, #78502d 45%, #1a1010 100%)",
    description:
      "Uma leitura 360º da sua identidade profissional, da percepção atual ao posicionamento que você quer ocupar.",
    type: "1:1",
  },
  {
    id: "novo-profissional",
    eyebrow: "Mês 2 · Segurança",
    title: "O Novo Profissional",
    mentor: "Luiza Mendes",
    duration: "41 min",
    progress: 0,
    accent: "linear-gradient(135deg, #7c6c8e 0%, #372d47 52%, #0f0b14 100%)",
    description:
      "Entenda a transformação do trabalho e combine IA, competências humanas, adaptabilidade e produtividade.",
    type: "Aula",
  },
  {
    id: "ia-pratica",
    eyebrow: "Encontro coletivo",
    title: "IA na Prática",
    mentor: "Luiza Mendes",
    duration: "90 min",
    progress: 0,
    accent: "linear-gradient(135deg, #9a4052 0%, #4b1826 55%, #14090d 100%)",
    description:
      "Aplicações reais de inteligência artificial para identificar oportunidades e ganhar produtividade no dia a dia.",
    type: "Coletivo",
  },
];

export const recommendations: LearningItem[] = [
  {
    id: "leitura-ambiente",
    eyebrow: "Revisite quando quiser",
    title: "Consciência & Leitura de Ambiente",
    mentor: "Camila Um",
    duration: "38 min",
    progress: 100,
    accent: "linear-gradient(135deg, #8f3544 0%, #461520 58%, #100608 100%)",
    description:
      "Autoconsciência, padrões de comportamento e leitura de contexto para decisões profissionais mais claras.",
    type: "Aula",
  },
  {
    id: "tomada-decisao",
    eyebrow: "Em breve · Mês 3",
    title: "Tomada de Decisão Profissional",
    mentor: "Camila Mariano",
    duration: "44 min",
    progress: 0,
    accent: "linear-gradient(135deg, #d0ac5c 0%, #79541f 46%, #181006 100%)",
    description:
      "Escolhas, riscos, trade-offs e o custo da não decisão para chegar ao próximo movimento com direção.",
    type: "Aula",
  },
  {
    id: "rise-decision-room",
    eyebrow: "Em breve · Mês 3",
    title: "RISE Decision Room",
    mentor: "As quatro mentoras",
    duration: "90 min",
    progress: 0,
    accent: "linear-gradient(135deg, #8f6670 0%, #432830 58%, #100a0c 100%)",
    description:
      "Dilemas reais, provocações e diferentes perspectivas para apoiar decisões de alto impacto.",
    type: "Coletivo",
  },
  {
    id: "competencias-proximo-nivel",
    eyebrow: "Em breve · Mês 4",
    title: "Competências do Próximo Nível",
    mentor: "Camila Mariano",
    duration: "36 min",
    progress: 0,
    accent: "linear-gradient(135deg, #74404e 0%, #331720 60%, #0b0608 100%)",
    description:
      "Comportamentos, liderança e capacidades que precisam evoluir para sustentar o seu próximo nível.",
    type: "Aula",
  },
];

export const mentors = [
  {
    name: "Camila Um",
    pillar: "Reflexão",
    initials: "CU",
    copy: "Escuta ativa para transformar dilemas em escolhas mais claras.",
    color: "#8f3544",
  },
  {
    name: "Gabriela Ribeiro",
    pillar: "Identidade",
    initials: "GR",
    copy: "Posicionamento e marca pessoal para tornar valor visível.",
    color: "#a85f70",
  },
  {
    name: "Luiza Mendes",
    pillar: "Segurança",
    initials: "LM",
    copy: "IA e produtividade traduzidas em ferramentas possíveis.",
    color: "#7c6c8e",
  },
  {
    name: "Camila Mariano",
    pillar: "Evolução",
    initials: "CM",
    copy: "Direção, liderança e execução para o próximo nível.",
    color: "#b48843",
  },
];

export const nextEvents = [
  {
    day: "08",
    month: "OUT",
    title: "Identity Session",
    meta: "1:1 com Gabriela Ribeiro · 14h",
    type: "Individual",
  },
  {
    day: "15",
    month: "OUT",
    title: "IA na Prática",
    meta: "Encontro coletivo · 19h",
    type: "Coletivo",
  },
  {
    day: "22",
    month: "OUT",
    title: "AI & Productivity Session",
    meta: "1:1 com Luiza Mendes · 16h",
    type: "Individual",
  },
];
