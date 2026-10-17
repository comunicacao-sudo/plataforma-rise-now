import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ClipboardList,
  LockKeyhole,
  MessageCircleQuestion,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ASSESSMENT_QUESTIONS,
  FREQUENCY_OPTIONS,
  IMPORTANCE_OPTIONS,
  calculateAssessment,
  type CalculatedAssessmentResult,
} from "@/lib/assessment";
import {
  completeAssessment,
  getMentorAssessmentProfile,
  getMyAssessmentProfile,
  getMyAssessmentState,
  releaseAssessmentReport,
  saveAssessmentAnswer,
  saveAssessmentDevelopmentPlan,
  startAssessment,
} from "@/lib/assessment.functions";

type PublicResult = Partial<CalculatedAssessmentResult> & {
  summary?: CalculatedAssessmentResult["summary"];
};
type AttemptView = {
  id: string;
  status: string;
  completed_at?: string | null;
  assessment_version?: string | null;
  report_status?: string | null;
};
type DevelopmentPlanView = {
  id: string;
  priority_focus: string;
  objective: string;
  status: string;
  shared_with_mentee: boolean;
};

const tabs = [
  "Visão geral",
  "Mapeamento",
  "Liderança",
  "Competências",
  "Pontos a desenvolver",
  "Testes realizados",
  "Plano de desenvolvimento",
  "Leituras recomendadas",
] as const;
type ReportTab = (typeof tabs)[number];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ScoreBar({ value, natural }: { value: number; natural?: number | undefined }) {
  return (
    <div className="assessment-score" aria-label={`${value.toFixed(1)} de 5`}>
      <div>
        {natural !== undefined ? <i style={{ width: `${(natural / 5) * 100}%` }} /> : null}
        <span style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <strong>{value.toFixed(1)}</strong>
    </div>
  );
}

function EmptyAI({ type }: { type: "actions" | "questions" | "communication" | "books" }) {
  const content = {
    actions: [
      Target,
      "Plano de ação sugerido",
      "Sugestões aguardando análise da IA. A mentora poderá aceitar, adaptar ou ignorar antes de criar o plano oficial.",
    ],
    questions: [
      MessageCircleQuestion,
      "Perguntas para aprofundar",
      "Perguntas personalizadas serão geradas quando a integração de IA estiver disponível.",
    ],
    communication: [
      UsersRound,
      "Eficácia da comunicação",
      "Orientações de abordagem, feedback e negociação aguardando análise da IA.",
    ],
    books: [
      BookOpen,
      "Leituras recomendadas",
      "Recomendações aguardando análise da IA. Nenhum livro fictício será exibido.",
    ],
  } as const;
  const [Icon, title, copy] = content[type];
  return (
    <article className="assessment-ai-empty">
      <Icon size={24} />
      <div>
        <span>Integração preparada</span>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
    </article>
  );
}

function AssessmentReport({
  result,
  full,
  attempt,
  attempts = [],
  plans = [],
  mentor = false,
  enrollmentId,
  onChanged,
}: {
  result: PublicResult;
  full: boolean;
  attempt: AttemptView;
  attempts?: AttemptView[];
  plans?: DevelopmentPlanView[];
  mentor?: boolean;
  enrollmentId?: string | undefined;
  onChanged?: (() => void) | undefined;
}) {
  const [tab, setTab] = useState<ReportTab>("Visão geral");
  const [previewRelease, setPreviewRelease] = useState(false);
  const release = useServerFn(releaseAssessmentReport);
  const savePlan = useServerFn(saveAssessmentDevelopmentPlan);
  const [busy, setBusy] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [plan, setPlan] = useState({
    priorityFocus: "",
    objective: "",
    action: "",
    progressEvidence: "",
    dueDate: "",
    reviewDate: "",
    observations: "",
    status: "draft" as "draft" | "agreed" | "in_progress" | "completed",
    responsible: "",
    sharedWithMentee: false,
    internalNotes: "",
  });
  const isReleased = attempt?.report_status === "full_report_released";
  const visibleTabs = full
    ? tabs
    : ([
        "Visão geral",
        "Mapeamento",
        "Testes realizados",
        "Plano de desenvolvimento",
        "Leituras recomendadas",
      ] as const);
  const competencies = result.competencies ?? [];
  const maxDiff = [...(result.comparisons ?? [])].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  )[0];

  async function confirmRelease() {
    if (!enrollmentId) return;
    setBusy(true);
    try {
      await release({ data: { enrollmentId, attemptId: attempt.id } });
      setPreviewRelease(false);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }
  async function submitPlan() {
    if (
      !enrollmentId ||
      !plan.priorityFocus.trim() ||
      !plan.objective.trim() ||
      !plan.action.trim()
    )
      return;
    setBusy(true);
    try {
      await savePlan({
        data: {
          attemptId: attempt.id,
          enrollmentId,
          ...plan,
          dueDate: plan.dueDate || null,
          reviewDate: plan.reviewDate || null,
        },
      });
      setPlanOpen(false);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assessment-report">
      <div className="assessment-report__hero">
        <div>
          <span className="eyebrow eyebrow--gold">Mapeamento Comportamental RISE</span>
          <h2>{result.summary?.headline ?? "Resultado em construção"}</h2>
          <p>
            Aplicação de {formatDate(attempt?.completed_at)} · versão {attempt?.assessment_version}
          </p>
        </div>
        <span
          className={`assessment-release assessment-release--${isReleased ? "released" : "locked"}`}
        >
          {isReleased ? <CheckCircle2 size={17} /> : <LockKeyhole size={17} />}
          {isReleased
            ? "Completo liberado"
            : mentor
              ? "Completo bloqueado para mentorada"
              : "Resumo disponível"}
        </span>
      </div>
      {mentor && !isReleased ? (
        <div className="assessment-release-action">
          <div>
            <ShieldCheck size={21} />
            <span>
              <strong>Você está vendo o relatório completo.</strong>
              <small>A mentorada ainda vê somente o resumo inicial.</small>
            </span>
          </div>
          <button type="button" onClick={() => setPreviewRelease(true)}>
            Liberar mapeamento completo
          </button>
        </div>
      ) : null}
      <nav className="assessment-tabs" aria-label="Seções do mapeamento">
        {visibleTabs.map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? "is-active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "Visão geral" ? (
        <section className="assessment-section">
          <div className="assessment-overview-grid">
            <article>
              <span>Respostas</span>
              <strong>{result.responseCount ?? 50}</strong>
              <small>escala de 1 a 5</small>
            </article>
            <article>
              <span>Perspectivas</span>
              <strong>Natural × Adaptado</strong>
              <small>autorrelato exploratório</small>
            </article>
            <article>
              <span>Maior diferença</span>
              <strong>{maxDiff?.name ?? "Sem contraste"}</strong>
              <small>
                {maxDiff ? `${maxDiff.delta > 0 ? "+" : ""}${maxDiff.delta.toFixed(1)}` : "—"}
              </small>
            </article>
          </div>
          <div className="assessment-callout">
            <Sparkles size={22} />
            <div>
              <h3>Leitura inicial</h3>
              {result.summary?.highlights?.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                {result.summary?.relevantDifference ??
                  "Não apareceu contraste de 1 ponto ou mais entre as duas perspectivas."}
              </p>
            </div>
          </div>
          <div className="assessment-two-cols">
            <article>
              <h3>Motivadores em destaque</h3>
              <ul>
                {result.summary?.strongestMotivations?.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>Pontos fortes observados</h3>
              <ul>
                {result.strengths?.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <strong>{item.name}</strong>
                    <span>{item.behavior}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <p className="assessment-notice">{result.summary?.notice}</p>
        </section>
      ) : null}

      {tab === "Mapeamento" ? (
        <section className="assessment-section">
          <header>
            <h3>Perfil Natural × Perfil Adaptado</h3>
            <p>
              Natural representa a tendência espontânea relatada. Adaptado representa como a pessoa
              relata agir no trabalho.
            </p>
          </header>
          <div className="assessment-legend">
            <span>
              <i className="is-natural" />
              Natural
            </span>
            <span>
              <i className="is-adapted" />
              Adaptado
            </span>
          </div>
          <div className="assessment-comparison-list">
            {competencies.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.definition}</small>
                </div>
                <ScoreBar value={item.adapted} natural={item.natural} />
                <p>{item.explanation}</p>
              </article>
            ))}
          </div>
          <div className="assessment-limitations">
            <h3>Limites desta leitura</h3>
            {result.limitations?.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "Liderança" && full ? (
        <section className="assessment-section">
          <header>
            <h3>Como essa pessoa tende a liderar</h3>
            <p>
              Indicadores de desenvolvimento baseados nas práticas relatadas, sem classificar um
              estilo único.
            </p>
          </header>
          <div className="assessment-leadership-grid">
            {result.leadership?.map((item) => (
              <article key={item.id}>
                <span>{item.name}</span>
                <ScoreBar value={item.score} />
                <p>{item.reading}</p>
                <small>Evidências: {item.evidence.join(", ")}</small>
              </article>
            ))}
          </div>
          <div className="assessment-ai-grid">
            <EmptyAI type="questions" />
            <EmptyAI type="communication" />
          </div>
        </section>
      ) : null}

      {tab === "Competências" && full ? (
        <section className="assessment-section">
          <header>
            <h3>Mapa de competências RISE</h3>
            <p>
              Tendências observadas nas respostas; não comprovam competência profissional objetiva.
            </p>
          </header>
          <div className="assessment-competency-grid">
            {competencies.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.adapted.toFixed(1)}</span>
                </div>
                <ScoreBar value={item.adapted} natural={item.natural} />
                <p>{item.definition}</p>
                <small>Evidências: {item.evidence.join(", ")}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "Pontos a desenvolver" && full ? (
        <section className="assessment-section">
          <header>
            <h3>Pontos a desenvolver</h3>
            <p>Prioridades exploratórias para a conversa de mentoria.</p>
          </header>
          <div className="assessment-development-list">
            {result.development?.map((item) => (
              <article key={item.id}>
                <h4>{item.name}</h4>
                <p>{item.reason}</p>
                <strong>Pergunta de reflexão</strong>
                <p>{item.reflectionQuestion}</p>
                <strong>Prática possível</strong>
                <p>{item.developmentPractice}</p>
              </article>
            ))}
          </div>
          <EmptyAI type="actions" />
        </section>
      ) : null}

      {tab === "Plano de desenvolvimento" ? (
        <section className="assessment-section">
          <header className="assessment-section__actions">
            <div>
              <h3>Plano de desenvolvimento</h3>
              <p>Ações acordadas entre mentora e mentorada, com acompanhamento de progresso.</p>
            </div>
            {mentor ? (
              <button type="button" onClick={() => setPlanOpen(!planOpen)}>
                Criar plano acordado
              </button>
            ) : null}
          </header>
          {planOpen ? (
            <div className="assessment-plan-form">
              <h3>Plano acordado</h3>
              <div className="assessment-form-grid">
                <label>
                  <span>Foco prioritário</span>
                  <input
                    value={plan.priorityFocus}
                    onChange={(e) => setPlan({ ...plan, priorityFocus: e.target.value })}
                  />
                </label>
                <label>
                  <span>Responsável</span>
                  <input
                    value={plan.responsible}
                    onChange={(e) => setPlan({ ...plan, responsible: e.target.value })}
                  />
                </label>
                <label className="is-wide">
                  <span>Objetivo</span>
                  <textarea
                    value={plan.objective}
                    onChange={(e) => setPlan({ ...plan, objective: e.target.value })}
                  />
                </label>
                <label className="is-wide">
                  <span>Ação</span>
                  <textarea
                    value={plan.action}
                    onChange={(e) => setPlan({ ...plan, action: e.target.value })}
                  />
                </label>
                <label>
                  <span>Evidência de progresso</span>
                  <input
                    value={plan.progressEvidence}
                    onChange={(e) => setPlan({ ...plan, progressEvidence: e.target.value })}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={plan.status}
                    onChange={(e) =>
                      setPlan({ ...plan, status: e.target.value as typeof plan.status })
                    }
                  >
                    <option value="draft">Rascunho</option>
                    <option value="agreed">Acordado</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="completed">Concluído</option>
                  </select>
                </label>
                <label>
                  <span>Prazo</span>
                  <input
                    type="date"
                    value={plan.dueDate}
                    onChange={(e) => setPlan({ ...plan, dueDate: e.target.value })}
                  />
                </label>
                <label>
                  <span>Revisão</span>
                  <input
                    type="date"
                    value={plan.reviewDate}
                    onChange={(e) => setPlan({ ...plan, reviewDate: e.target.value })}
                  />
                </label>
                <label className="is-wide">
                  <span>Observações compartilháveis</span>
                  <textarea
                    value={plan.observations}
                    onChange={(e) => setPlan({ ...plan, observations: e.target.value })}
                  />
                </label>
                <label className="is-wide">
                  <span>Notas internas da mentora</span>
                  <textarea
                    value={plan.internalNotes}
                    onChange={(e) => setPlan({ ...plan, internalNotes: e.target.value })}
                  />
                </label>
              </div>
              <label className="assessment-checkbox">
                <input
                  type="checkbox"
                  checked={plan.sharedWithMentee}
                  onChange={(e) => setPlan({ ...plan, sharedWithMentee: e.target.checked })}
                />
                Compartilhar este plano com a mentorada
              </label>
              <button type="button" disabled={busy} onClick={() => void submitPlan()}>
                <Save size={16} />
                Salvar plano
              </button>
            </div>
          ) : null}
          {plans.length ? (
            <div className="assessment-plans">
              <h3>Planos registrados</h3>
              {plans.map((item) => (
                <article key={item.id}>
                  <strong>{item.priority_focus}</strong>
                  <span>{item.status}</span>
                  <p>{item.objective}</p>
                  <small>
                    {item.shared_with_mentee
                      ? "Compartilhado com a mentorada"
                      : "Visível somente para a mentoria"}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <div className="assessment-empty assessment-empty--compact">
              <Target size={28} />
              <h3>Nenhum plano compartilhado ainda</h3>
              <p>
                {mentor
                  ? "Crie o primeiro plano acordado para acompanhar ações e evidências de progresso."
                  : "Quando um plano for acordado e compartilhado, ele aparecerá aqui."}
              </p>
            </div>
          )}
        </section>
      ) : null}

      {tab === "Leituras recomendadas" ? (
        <section className="assessment-section">
          <header>
            <h3>Leituras recomendadas</h3>
            <p>Indicações personalizadas que exigem validação antes de serem exibidas.</p>
          </header>
          <EmptyAI type="books" />
        </section>
      ) : null}

      {tab === "Testes realizados" ? (
        <section className="assessment-section">
          <header>
            <h3>Testes realizados</h3>
            <p>Cada aplicação mantém sua versão e regra de cálculo original.</p>
          </header>
          {(attempts.length ? attempts : [attempt]).map((item) => (
            <article className="assessment-history-item" key={item.id}>
              <ClipboardList size={21} />
              <div>
                <strong>Mapeamento Comportamental RISE</strong>
                <span>
                  {formatDate(item.completed_at)} · versão {item.assessment_version}
                </span>
              </div>
              <span>{item.status === "completed" ? "Concluído" : "Em andamento"}</span>
            </article>
          ))}
        </section>
      ) : null}

      {previewRelease ? (
        <div className="assessment-release-preview" role="dialog" aria-modal="true">
          <div>
            <button
              type="button"
              className="assessment-close"
              onClick={() => setPreviewRelease(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow eyebrow--gold">Prévia de compartilhamento</span>
            <h3>Liberar relatório completo?</h3>
            <p>
              A mentorada passará a ver, além do resumo, as seções de liderança, competências,
              pontos fortes, pontos a desenvolver e planos marcados como compartilhados.
            </p>
            <ul>
              <li>Notas internas continuam privadas.</li>
              <li>A liberação não recalcula nem altera as pontuações.</li>
              <li>O histórico registra quem liberou e quando.</li>
            </ul>
            <button type="button" disabled={busy} onClick={() => void confirmRelease()}>
              {busy ? "Liberando…" : "Confirmar liberação"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssessmentIntro({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <section className="assessment-intro">
      <span className="eyebrow eyebrow--gold">Mapeamento Comportamental RISE</span>
      <h1>Antes de começar</h1>
      <div>
        <p>Este mapeamento possui duas perspectivas.</p>
        <p>
          Na primeira parte, queremos conhecer a forma como você tende a agir naturalmente. Responda
          pensando em quem você reconhece ter sido ao longo da sua vida — não somente no momento
          atual.
        </p>
        <p>
          Não escolha a alternativa que parece mais correta, mais bonita ou aquilo que gostaria de
          se tornar. Pense nos padrões que aparecem espontaneamente em você em diferentes fases e
          situações da sua vida.
        </p>
        <p>
          Na segunda parte, vamos olhar especificamente para a forma como você atua no ambiente
          profissional.
        </p>
        <strong>Não existem respostas certas ou erradas.</strong>
      </div>
      <ul>
        <li>
          <Check size={17} />
          Uma pergunta por vez
        </li>
        <li>
          <Check size={17} />
          50 respostas
        </li>
        <li>
          <Check size={17} />
          Seu progresso fica salvo
        </li>
      </ul>
      <button type="button" disabled={busy} onClick={onStart}>
        {busy ? "Preparando…" : "Começar meu mapeamento"}
        <ArrowRight size={18} />
      </button>
    </section>
  );
}

function AdaptedTransition({ onContinue }: { onContinue: () => void }) {
  return (
    <section className="assessment-intro assessment-transition">
      <span className="eyebrow eyebrow--gold">Segunda perspectiva</span>
      <h1>Agora pense no seu ambiente de trabalho.</h1>
      <p>
        A partir daqui, responda considerando como você costuma agir profissionalmente diante das
        situações apresentadas.
      </p>
      <p>
        Perfil Adaptado descreve como você relata que age no trabalho — não como deveria agir e nem
        o que acredita que esperam de você.
      </p>
      <button type="button" onClick={onContinue}>
        Continuar para o Perfil Adaptado <ArrowRight size={18} />
      </button>
    </section>
  );
}

export function RiseAssessmentExperience({
  stepKey,
  onBack,
}: {
  stepKey: string;
  onBack: () => void;
}) {
  const load = useServerFn(getMyAssessmentState);
  const start = useServerFn(startAssessment);
  const save = useServerFn(saveAssessmentAnswer);
  const complete = useServerFn(completeAssessment);
  const qc = useQueryClient();
  const state = useQuery({
    queryKey: ["rise-assessment-state"],
    queryFn: () => load(),
    retry: false,
  });
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [transitionSeen, setTransitionSeen] = useState(false);
  const [finished, setFinished] = useState(false);
  const answers = useMemo<Map<string, number>>(
    () =>
      new Map(
        ((state.data?.answers ?? []) as Array<{ itemId: string; value: number }>).map((item) => [
          item.itemId,
          item.value,
        ]),
      ),
    [state.data?.answers],
  );
  useEffect(() => {
    if (!state.data?.attempt) return;
    setAttemptId(state.data.attempt.id);
    setIndex(Math.min(state.data.attempt.current_index ?? 0, ASSESSMENT_QUESTIONS.length - 1));
    setFinished(state.data.attempt.status === "completed");
  }, [state.data]);
  useEffect(() => {
    if (attemptId && !finished) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [attemptId, finished, index, transitionSeen]);
  const question = ASSESSMENT_QUESTIONS[index]!;
  useEffect(() => setSelected(answers.get(question.id) ?? null), [answers, question.id]);

  async function begin() {
    setBusy(true);
    try {
      const attempt = await start();
      setAttemptId(attempt.id);
      setIndex(attempt.current_index);
      setFinished(false);
      setTransitionSeen(false);
      await state.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    if (!attemptId || selected === null) return;
    setBusy(true);
    try {
      await save({ data: { attemptId, itemId: question.id, value: selected } });
      if (index === ASSESSMENT_QUESTIONS.length - 1) {
        await complete({ data: { attemptId, stepKey } });
        setFinished(true);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["rise-assessment-profile"] }),
          qc.invalidateQueries({ queryKey: ["journey-content-library"] }),
        ]);
      } else {
        setIndex((value) => value + 1);
        setSelected(answers.get(ASSESSMENT_QUESTIONS[index + 1]!.id) ?? null);
      }
    } finally {
      setBusy(false);
    }
  }
  if (state.isLoading)
    return (
      <main className="inner-page assessment-page">
        <div className="assessment-loading">Carregando seu mapeamento…</div>
      </main>
    );
  if (finished)
    return <AssessmentProfilePage onBack={onBack} onRetake={() => void begin()} busy={busy} />;
  if (!attemptId)
    return (
      <main className="inner-page assessment-page">
        <div className="page-width">
          <button className="recorded-back" type="button" onClick={onBack}>
            <ArrowLeft size={17} />
            Minha jornada
          </button>
          <AssessmentIntro onStart={() => void begin()} busy={busy} />
        </div>
      </main>
    );
  if (index === 19 && !transitionSeen)
    return (
      <main className="inner-page assessment-page">
        <div className="page-width">
          <button className="recorded-back" type="button" onClick={onBack}>
            <ArrowLeft size={17} />
            Salvar e sair
          </button>
          <AdaptedTransition onContinue={() => setTransitionSeen(true)} />
        </div>
      </main>
    );
  const options = question.scale === "importance" ? IMPORTANCE_OPTIONS : FREQUENCY_OPTIONS;
  return (
    <main className="inner-page assessment-page">
      <div className="assessment-question-shell page-width">
        <button className="recorded-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          Salvar e sair
        </button>
        <div className="assessment-progress">
          <div>
            <span style={{ width: `${((index + 1) / ASSESSMENT_QUESTIONS.length) * 100}%` }} />
          </div>
          <small>
            {index + 1} de {ASSESSMENT_QUESTIONS.length}
          </small>
        </div>
        <section className="assessment-question">
          <span>{question.block}</span>
          <h1>{question.prompt}</h1>
          <p>{question.guidance}</p>
          <div className="assessment-options">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={selected === option.value ? "is-selected" : ""}
                onClick={() => setSelected(option.value)}
              >
                <strong>{option.value}</strong>
                <span>{option.label}</span>
                {selected === option.value ? <Check size={18} /> : null}
              </button>
            ))}
          </div>
          <footer>
            <button
              type="button"
              disabled={index === 0 || busy}
              onClick={() => {
                setIndex((value) => Math.max(0, value - 1));
                setTransitionSeen(true);
              }}
            >
              <ArrowLeft size={17} />
              Anterior
            </button>
            <span>
              <Save size={14} />
              Progresso salvo a cada resposta
            </span>
            <button type="button" disabled={selected === null || busy} onClick={() => void next()}>
              {busy
                ? "Salvando…"
                : index === ASSESSMENT_QUESTIONS.length - 1
                  ? "Concluir"
                  : "Continuar"}
              <ArrowRight size={17} />
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}

function AssessmentProfilePage({
  onBack,
  onRetake,
  busy = false,
}: {
  onBack?: (() => void) | undefined;
  onRetake?: (() => void) | undefined;
  busy?: boolean;
}) {
  const load = useServerFn(getMyAssessmentProfile);
  const query = useQuery({
    queryKey: ["rise-assessment-profile"],
    queryFn: () => load(),
    retry: false,
  });
  if (query.isLoading)
    return (
      <main className="inner-page assessment-page">
        <div className="assessment-loading">Carregando resultado…</div>
      </main>
    );
  const latest = query.data?.latest;
  return (
    <main className="inner-page assessment-page">
      <div className="page-width">
        {onBack ? (
          <button className="recorded-back" type="button" onClick={onBack}>
            <ArrowLeft size={17} />
            Voltar
          </button>
        ) : null}
        {latest?.calculated_result ? (
          <>
            <AssessmentReport
              result={latest.calculated_result as PublicResult}
              full={latest.report_status === "full_report_released"}
              attempt={latest}
              attempts={query.data?.attempts ?? []}
              plans={query.data?.plans ?? []}
            />
            {onRetake ? (
              <div className="assessment-retake">
                <div>
                  <strong>Nova aplicação</strong>
                  <p>O resultado anterior continuará preservado no histórico.</p>
                </div>
                <button type="button" disabled={busy} onClick={onRetake}>
                  {busy ? "Preparando…" : "Refazer mapeamento"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="assessment-empty">
            <BrainCircuit size={34} />
            <h2>Seu mapeamento aparecerá aqui</h2>
            <p>Conclua a etapa “Questionário do perfil comportamental” na sua jornada.</p>
          </div>
        )}
      </div>
    </main>
  );
}

export function AssessmentProfileModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-backdrop assessment-profile-modal"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="content-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Meu mapeamento"
      >
        <button className="modal-close" type="button" onClick={onClose}>
          <X size={21} />
        </button>
        <div className="content-modal__body">
          <AssessmentProfilePage />
        </div>
      </section>
    </div>
  );
}

export function AssessmentMentorDrawer({
  enrollmentId,
  name,
  onClose,
}: {
  enrollmentId: string;
  name: string;
  onClose: () => void;
}) {
  const load = useServerFn(getMentorAssessmentProfile);
  const query = useQuery({
    queryKey: ["mentor-assessment", enrollmentId],
    queryFn: () => load({ data: { enrollmentId } }),
    retry: false,
  });
  return (
    <div
      className="modal-backdrop assessment-profile-modal"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="content-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Mapeamento de ${name}`}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          <X size={21} />
        </button>
        <div className="content-modal__body">
          {query.isLoading ? (
            <div className="assessment-loading">Carregando mapeamento…</div>
          ) : query.data?.latest?.calculated_result ? (
            <AssessmentReport
              result={query.data.latest.calculated_result as PublicResult}
              full
              mentor
              enrollmentId={enrollmentId}
              attempt={query.data.latest}
              attempts={query.data.attempts ?? []}
              plans={query.data.plans ?? []}
              onChanged={() => void query.refetch()}
            />
          ) : (
            <div className="assessment-empty">
              <BrainCircuit size={34} />
              <h2>{name} ainda não concluiu o mapeamento</h2>
              <p>O resultado completo e o histórico aparecerão aqui após a conclusão.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** Development-only visual fixture. Never persists or represents a real mentorada. */
export function AssessmentVisualPreview() {
  const result = calculateAssessment(
    ASSESSMENT_QUESTIONS.map((question, index) => ({
      itemId: question.id,
      value:
        question.perspective === "natural"
          ? 2 + (index % 3)
          : question.perspective === "adapted"
            ? 3 + (index % 3)
            : 3 + (index % 2),
    })),
  );
  return (
    <main className="inner-page assessment-page">
      <div className="page-width">
        <div className="assessment-notice">Conteúdo de demonstração · dados fictícios</div>
        <AssessmentReport
          result={result}
          full
          mentor
          enrollmentId="00000000-0000-0000-0000-000000000000"
          attempt={{
            id: "00000000-0000-0000-0000-000000000001",
            status: "completed",
            completed_at: new Date().toISOString(),
            assessment_version: result.assessmentVersion,
            report_status: "full_report_locked",
          }}
        />
      </div>
    </main>
  );
}

/** Development-only questionnaire fixture for responsive visual inspection. */
export function AssessmentVisualQuestionPreview() {
  const [started, setStarted] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const question = ASSESSMENT_QUESTIONS[0]!;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [started]);
  if (!started)
    return (
      <main className="inner-page assessment-page">
        <div className="page-width">
          <div className="assessment-notice">Conteúdo de demonstração · nenhum dado será salvo</div>
          <AssessmentIntro onStart={() => setStarted(true)} busy={false} />
        </div>
      </main>
    );
  return (
    <main className="inner-page assessment-page">
      <div className="assessment-question-shell page-width">
        <div className="assessment-progress">
          <div>
            <span style={{ width: "2%" }} />
          </div>
          <small>1 de 50</small>
        </div>
        <section className="assessment-question">
          <span>{question.block}</span>
          <h1>{question.prompt}</h1>
          <p>{question.guidance}</p>
          <div className="assessment-options">
            {FREQUENCY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={selected === option.value ? "is-selected" : ""}
                onClick={() => setSelected(option.value)}
              >
                <strong>{option.value}</strong>
                <span>{option.label}</span>
                {selected === option.value ? <Check size={18} /> : null}
              </button>
            ))}
          </div>
          <footer>
            <button type="button" disabled>
              <ArrowLeft size={17} />
              Anterior
            </button>
            <span>
              <Save size={14} />
              Progresso salvo a cada resposta
            </span>
            <button type="button" disabled={selected === null}>
              Continuar
              <ArrowRight size={17} />
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
