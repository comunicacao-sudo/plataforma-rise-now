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
  type AIAssessmentInterpretation,
  type AIAssessmentView,
  type CalculatedAssessmentResult,
} from "@/lib/assessment";
import {
  completeAssessment,
  generateAssessmentInterpretation,
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
export type AssessmentMentorSection = Extract<
  ReportTab,
  "Mapeamento" | "Testes realizados" | "Plano de desenvolvimento" | "Leituras recomendadas"
>;

function formatDate(value?: string | null) {
  if (!value) return "Não informado";
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

function DiscProfile({ result }: { result: CalculatedAssessmentResult["disc"] }) {
  const perspectives = [result.natural, result.adapted];
  return (
    <section className="assessment-disc" aria-labelledby="assessment-disc-title">
      <header>
        <span>RISE inspirado no modelo DISC</span>
        <h3 id="assessment-disc-title">Seu perfil comportamental</h3>
        <p>{result.scaleExplanation}</p>
      </header>
      <div className="assessment-disc__grid">
        {perspectives.map((perspective) => (
          <article key={perspective.perspective}>
            <div className="assessment-disc__heading">
              <div>
                <span>Perfil {perspective.perspective === "natural" ? "Natural" : "Adaptado"}</span>
                <strong>{perspective.label}</strong>
              </div>
              {perspective.balanced ? <em>Equilibrado</em> : null}
            </div>
            <div className="assessment-disc__factors">
              {perspective.factors.map((factor) => (
                <div
                  key={factor.factor}
                  className={`assessment-disc__factor is-${factor.factor.toLowerCase()}`}
                >
                  <b>{factor.factor}</b>
                  <span>{factor.name}</span>
                  <div aria-label={`${factor.name}: ${factor.score}%`}>
                    <i style={{ width: `${factor.score}%` }} />
                  </div>
                  <strong>{factor.score}%</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <small>
        Natural representa tendências espontâneas relatadas. Adaptado representa como você relata
        agir no contexto profissional. Empates e combinações são preservados, sem forçar um único
        rótulo.
      </small>
    </section>
  );
}

function AIListCard({
  icon: Icon,
  title,
  items,
  emptyCopy,
  privateToMentor = false,
}: {
  icon: typeof Sparkles;
  title: string;
  items: string[];
  emptyCopy: string;
  privateToMentor?: boolean;
}) {
  return (
    <article className={`assessment-ai-card${items.length ? "" : " is-empty"}`}>
      <Icon size={24} />
      <div>
        <span>
          {privateToMentor ? "Orientação privada da mentoria" : "Interpretação personalizada"}
        </span>
        <h3>{title}</h3>
        {items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>{emptyCopy}</p>
        )}
      </div>
    </article>
  );
}

function AIInterpretationPanel({
  analysis,
  mentor,
  busy,
  onGenerate,
}: {
  analysis?: AIAssessmentView | null;
  mentor: boolean;
  busy: boolean;
  onGenerate: (force: boolean) => void;
}) {
  const output = analysis?.output as Partial<AIAssessmentInterpretation> | null | undefined;
  if (!analysis || analysis.status === "unavailable")
    return (
      <section className="assessment-ai-panel assessment-ai-panel--pending">
        <Sparkles size={24} />
        <div>
          <span>Interpretação RISE</span>
          <h3>Análise pronta para ser gerada</h3>
          <p>
            As pontuações determinísticas já estão preservadas. A interpretação usa somente esse
            resultado.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => onGenerate(false)}>
          {busy ? "Gerando…" : "Gerar interpretação"}
        </button>
      </section>
    );
  if (analysis.status === "pending")
    return (
      <section className="assessment-ai-panel assessment-ai-panel--pending">
        <Sparkles size={24} />
        <div>
          <span>Interpretação RISE</span>
          <h3>Análise em processamento</h3>
          <p>O mapeamento já está concluído e suas pontuações não serão alteradas.</p>
        </div>
      </section>
    );
  if (analysis.status === "failed" && !output?.summary_for_mentee)
    return (
      <section className="assessment-ai-panel assessment-ai-panel--failed">
        <Sparkles size={24} />
        <div>
          <span>Interpretação RISE</span>
          <h3>A análise detalhada continua pendente</h3>
          <p>
            O resultado matemático foi salvo normalmente.
            {analysis.fallbackPromptVersion
              ? ` A interpretação anterior (${analysis.fallbackPromptVersion}) permanece visível abaixo enquanto a versão completa é gerada.`
              : " Nenhum texto substituto foi criado."}
          </p>
        </div>
        {analysis.canRetry ? (
          <button type="button" disabled={busy} onClick={() => onGenerate(false)}>
            {busy ? "Tentando…" : "Tentar novamente"}
          </button>
        ) : null}
      </section>
    );
  if (!output?.summary_for_mentee) return null;

  return (
    <>
      {analysis.status === "failed" ? (
        <section className="assessment-ai-panel assessment-ai-panel--failed">
          <Sparkles size={24} />
          <div>
            <span>Interpretação RISE</span>
            <h3>A versão mais completa continua pendente</h3>
            <p>
              A interpretação anterior ({analysis.fallbackPromptVersion}) permanece disponível e
              nenhuma pontuação foi alterada.
            </p>
          </div>
          {analysis.canRetry ? (
            <button type="button" disabled={busy} onClick={() => onGenerate(false)}>
              {busy ? "Tentando…" : "Tentar novamente"}
            </button>
          ) : null}
        </section>
      ) : null}
      <section className="assessment-ai-panel assessment-ai-panel--generated">
        <header>
          <div>
            <Sparkles size={24} />
            <span>
              Interpretação RISE · {analysis.fallbackPromptVersion ?? analysis.promptVersion}
            </span>
          </div>
          {mentor && analysis.canRetry ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onGenerate(analysis.status === "generated")}
            >
              {busy
                ? analysis.status === "generated"
                  ? "Regenerando…"
                  : "Tentando…"
                : analysis.status === "generated"
                  ? "Regenerar interpretação"
                  : "Tentar novamente"}
            </button>
          ) : null}
        </header>
        <h3>{output.profile_essence ? "Leitura integrada do perfil" : "Leitura personalizada"}</h3>
        {output.profile_essence ? (
          <p className="assessment-ai-panel__essence">{output.profile_essence}</p>
        ) : null}
        <div className="assessment-ai-panel__summary">
          <strong>Resumo para compartilhamento</strong>
          <p>{output.summary_for_mentee}</p>
        </div>
        <small className="assessment-ai-panel__hint">
          A análise detalhada está organizada nas abas abaixo para facilitar a leitura.
        </small>
        {mentor && output.evidence_notes?.length ? (
          <details>
            <summary>Evidências para revisão da equipe</summary>
            {output.evidence_notes.map((item) => (
              <p key={`${item.note}-${item.evidence_ids.join("-")}`}>
                {item.note} <small>{item.evidence_ids.join(", ")}</small>
              </p>
            ))}
          </details>
        ) : null}
      </section>
    </>
  );
}

function AssessmentReport({
  result,
  full,
  attempt,
  attempts = [],
  plans = [],
  aiAnalysis,
  mentor = false,
  enrollmentId,
  onChanged,
  activeTab,
  hideTabs = false,
}: {
  result: PublicResult;
  full: boolean;
  attempt: AttemptView;
  attempts?: AttemptView[];
  plans?: DevelopmentPlanView[];
  aiAnalysis?: AIAssessmentView | null;
  mentor?: boolean;
  enrollmentId?: string | undefined;
  onChanged?: (() => void) | undefined;
  activeTab?: ReportTab | undefined;
  hideTabs?: boolean | undefined;
}) {
  const [internalTab, setInternalTab] = useState<ReportTab>("Visão geral");
  const tab = activeTab ?? internalTab;
  const [previewRelease, setPreviewRelease] = useState(false);
  const release = useServerFn(releaseAssessmentReport);
  const generateAI = useServerFn(generateAssessmentInterpretation);
  const savePlan = useServerFn(saveAssessmentDevelopmentPlan);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
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
    : (["Visão geral", "Mapeamento", "Testes realizados", "Plano de desenvolvimento"] as const);
  const competencies = result.competencies ?? [];
  const aiOutput = aiAnalysis?.output as Partial<AIAssessmentInterpretation> | null | undefined;
  const naturalProfileInsights = aiOutput?.natural_profile_insights?.filter(Boolean) ?? [];
  const adaptedProfileInsights = aiOutput?.adapted_profile_insights?.filter(Boolean) ?? [];
  const adaptationDynamics = aiOutput?.adaptation_dynamics?.filter(Boolean) ?? [];
  const aiStrengths = aiOutput?.strengths?.filter(Boolean) ?? [];
  const aiCompetencies = aiOutput?.competencies?.filter(Boolean) ?? [];
  const leadershipInsights = aiOutput?.leadership_insights?.filter(Boolean) ?? [];
  const developmentPoints = aiOutput?.development_points?.filter(Boolean) ?? [];
  const attentionPoints = aiOutput?.attention_points?.filter(Boolean) ?? [];
  const behaviorPatterns = aiOutput?.behavior_patterns?.filter(Boolean) ?? [];
  const reflectionQuestions =
    aiOutput?.reflection_questions?.filter(Boolean) ??
    result.development?.map((item) => item.reflectionQuestion).filter(Boolean) ??
    [];
  const communicationGuidance = [
    ...(aiOutput?.communication_guidance?.filter(Boolean) ?? []),
    ...(mentor ? (aiOutput?.mentor_guidance?.filter(Boolean) ?? []) : []),
  ].filter((item, index, collection) => collection.indexOf(item) === index);
  const actionSuggestions = aiOutput?.development_recommendations?.filter(Boolean) ?? [];
  const mentorConversationAgenda = mentor
    ? (aiOutput?.mentor_conversation_agenda?.filter(Boolean) ?? [])
    : [];
  const recommendedReadings = aiOutput?.recommended_readings ?? [];
  const showReportContext = !hideTabs || tab === "Mapeamento";
  const showLeadership = full && (tab === "Liderança" || (hideTabs && tab === "Mapeamento"));
  const showCompetencies = full && (tab === "Competências" || (hideTabs && tab === "Mapeamento"));
  const showDevelopment =
    full && (tab === "Pontos a desenvolver" || (hideTabs && tab === "Mapeamento"));
  const maxDiff = [...(result.comparisons ?? [])].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  )[0];

  async function confirmRelease() {
    if (!enrollmentId) return;
    setBusy(true);
    setActionMessage("");
    try {
      await release({ data: { enrollmentId, attemptId: attempt.id } });
      setPreviewRelease(false);
      setActionMessage("O mapeamento completo foi liberado para a mentorada.");
      onChanged?.();
    } catch {
      setActionMessage("Não foi possível liberar o mapeamento. Tente novamente.");
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
    setActionMessage("");
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
      setActionMessage("Plano de desenvolvimento salvo com sucesso.");
      onChanged?.();
    } catch {
      setActionMessage("Não foi possível salvar o plano. Revise os campos e tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function generateInterpretation(force: boolean) {
    if (
      force &&
      !window.confirm(
        "Gerar novamente esta interpretação? A versão atual será substituída, sem alterar nenhuma pontuação.",
      )
    )
      return;
    setAiBusy(true);
    setActionMessage("");
    try {
      const analysis = await generateAI({ data: { attemptId: attempt.id, force } });
      setActionMessage(
        analysis?.status === "pending"
          ? "A interpretação foi iniciada. Esta tela será atualizada automaticamente."
          : analysis?.status === "generated"
            ? "A interpretação personalizada foi atualizada."
            : "A nova interpretação ainda não foi concluída. A versão anterior permanece disponível sem alteração dos scores.",
      );
      onChanged?.();
    } catch {
      setActionMessage(
        "A interpretação não pôde ser gerada agora. Nenhum resultado falso foi criado.",
      );
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="assessment-report">
      {showReportContext ? (
        <div className="assessment-report__hero">
          <div>
            <span className="eyebrow eyebrow--gold">Mapeamento Comportamental RISE</span>
            <h2>{result.summary?.headline ?? "Resultado em construção"}</h2>
            <p>
              Aplicação de {formatDate(attempt?.completed_at)} · versão{" "}
              {attempt?.assessment_version}
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
      ) : null}
      {showReportContext && mentor && !isReleased ? (
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
      {showReportContext && result.disc ? (
        <DiscProfile result={result.disc as CalculatedAssessmentResult["disc"]} />
      ) : showReportContext ? (
        <section className="assessment-disc assessment-disc--legacy">
          <h3>Resultado histórico preservado</h3>
          <p>
            Esta aplicação foi concluída antes da versão DISC 2.0. O resultado original continua
            disponível sem recálculo ou alteração silenciosa.
          </p>
        </section>
      ) : null}
      {showReportContext ? (
        <AIInterpretationPanel
          analysis={aiAnalysis ?? null}
          mentor={mentor}
          busy={aiBusy}
          onGenerate={(force) => void generateInterpretation(force)}
        />
      ) : null}
      {actionMessage ? (
        <p className="form-message" role="status">
          {actionMessage}
        </p>
      ) : null}
      {!hideTabs ? (
        <nav className="assessment-tabs" aria-label="Seções do mapeamento">
          {visibleTabs.map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? "is-active" : ""}
              onClick={() => setInternalTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      ) : null}

      {tab === "Visão geral" ? (
        <section className="assessment-section assessment-section--overview">
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
                {maxDiff
                  ? `${maxDiff.delta > 0 ? "+" : ""}${maxDiff.delta.toFixed(1)}`
                  : "Não informado"}
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
          {aiStrengths.length || behaviorPatterns.length || attentionPoints.length ? (
            <div className="assessment-ai-grid assessment-ai-grid--overview">
              <AIListCard
                icon={Sparkles}
                title="Forças em contexto"
                items={aiStrengths}
                emptyCopy="A interpretação atual ainda não detalhou as forças em contexto."
              />
              <AIListCard
                icon={BrainCircuit}
                title="Padrões observáveis"
                items={behaviorPatterns}
                emptyCopy="A interpretação atual ainda não detalhou os padrões observáveis."
              />
              <AIListCard
                icon={ShieldCheck}
                title="Pontos de atenção"
                items={attentionPoints}
                emptyCopy="A interpretação atual ainda não detalhou os pontos de atenção."
              />
            </div>
          ) : null}
          <p className="assessment-notice">{result.summary?.notice}</p>
        </section>
      ) : null}

      {tab === "Mapeamento" ? (
        <section className="assessment-section assessment-section--mapping">
          <header>
            <span className="assessment-section__eyebrow">Leitura comparativa</span>
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
          {naturalProfileInsights.length ||
          adaptedProfileInsights.length ||
          adaptationDynamics.length ? (
            <div className="assessment-ai-grid assessment-ai-grid--mapping">
              <AIListCard
                icon={BrainCircuit}
                title="Leitura do perfil Natural"
                items={naturalProfileInsights}
                emptyCopy="A interpretação atual ainda não contém esta leitura."
              />
              <AIListCard
                icon={UsersRound}
                title="Leitura do perfil Adaptado"
                items={adaptedProfileInsights}
                emptyCopy="A interpretação atual ainda não contém esta leitura."
              />
              <AIListCard
                icon={ArrowRight}
                title="Dinâmica de adaptação"
                items={adaptationDynamics}
                emptyCopy="A interpretação atual ainda não contém esta comparação."
              />
            </div>
          ) : null}
          <div className="assessment-limitations">
            <h3>Limites desta leitura</h3>
            {result.limitations?.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}

      {showLeadership ? (
        <section className="assessment-section assessment-section--leadership">
          <header>
            <span className="assessment-section__eyebrow">Liderança</span>
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
          {leadershipInsights.length ? (
            <AIListCard
              icon={BrainCircuit}
              title="Leitura integrada de liderança"
              items={leadershipInsights}
              emptyCopy="A interpretação atual ainda não contém esta leitura."
            />
          ) : null}
          <div className="assessment-ai-grid">
            <AIListCard
              icon={MessageCircleQuestion}
              title="Perguntas para aprofundar"
              items={reflectionQuestions}
              emptyCopy="Esta versão da interpretação ainda não contém perguntas personalizadas."
            />
            <AIListCard
              icon={UsersRound}
              title="Eficácia da comunicação"
              items={communicationGuidance}
              emptyCopy="Esta versão da interpretação ainda não contém orientações de comunicação."
              privateToMentor={mentor}
            />
          </div>
        </section>
      ) : null}

      {showCompetencies ? (
        <section className="assessment-section assessment-section--competencies">
          <header>
            <span className="assessment-section__eyebrow">Competências</span>
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
                  <span>Natural × Adaptado</span>
                </div>
                <ScoreBar value={item.adapted} natural={item.natural} />
                <p>{item.definition}</p>
                <small>Evidências: {item.evidence.join(", ")}</small>
              </article>
            ))}
          </div>
          {aiCompetencies.length || aiStrengths.length ? (
            <div className="assessment-ai-grid">
              <AIListCard
                icon={Target}
                title="Competências em contexto"
                items={aiCompetencies}
                emptyCopy="A interpretação atual ainda não detalhou as competências."
              />
              <AIListCard
                icon={Sparkles}
                title="Como potencializar as forças"
                items={aiStrengths}
                emptyCopy="A interpretação atual ainda não detalhou as forças."
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {showDevelopment ? (
        <section className="assessment-section assessment-section--development">
          <header>
            <span className="assessment-section__eyebrow">Desenvolvimento</span>
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
          <div className="assessment-ai-grid">
            <AIListCard
              icon={BrainCircuit}
              title="Hipóteses de desenvolvimento"
              items={developmentPoints}
              emptyCopy="Esta versão da interpretação ainda não contém hipóteses aprofundadas."
            />
            <AIListCard
              icon={ShieldCheck}
              title="Sinais para observar"
              items={attentionPoints}
              emptyCopy="Esta versão da interpretação ainda não contém sinais personalizados."
            />
            <AIListCard
              icon={Target}
              title="Plano de ação sugerido"
              items={actionSuggestions}
              emptyCopy="Esta versão da interpretação ainda não contém ações sugeridas."
            />
            <AIListCard
              icon={MessageCircleQuestion}
              title="Perguntas para a conversa"
              items={reflectionQuestions}
              emptyCopy="Esta versão da interpretação ainda não contém perguntas personalizadas."
            />
          </div>
        </section>
      ) : null}

      {tab === "Plano de desenvolvimento" ? (
        <section className="assessment-section assessment-section--plan">
          <header className="assessment-section__actions">
            <div>
              <span className="assessment-section__eyebrow">Acompanhamento</span>
              <h3>Plano de desenvolvimento</h3>
              <p>Ações acordadas entre mentora e mentorada, com acompanhamento de progresso.</p>
            </div>
            {mentor ? (
              <button type="button" onClick={() => setPlanOpen(!planOpen)}>
                Criar plano acordado
              </button>
            ) : null}
          </header>
          {mentorConversationAgenda.length ? (
            <AIListCard
              icon={ClipboardList}
              title="Roteiro sugerido para a devolutiva"
              items={mentorConversationAgenda}
              emptyCopy="A interpretação atual ainda não contém um roteiro de conversa."
              privateToMentor
            />
          ) : null}
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
        <section className="assessment-section assessment-section--readings">
          <header>
            <span className="assessment-section__eyebrow">Curadoria personalizada</span>
            <h3>Leituras recomendadas</h3>
            <p>Indicações personalizadas que exigem validação antes de serem exibidas.</p>
          </header>
          {recommendedReadings.length ? (
            <div className="assessment-reading-grid">
              {recommendedReadings.map((reading) => (
                <article key={`${reading.title}-${reading.author}`}>
                  <BookOpen size={22} />
                  <div>
                    <h3>{reading.title}</h3>
                    <span>{reading.author}</span>
                    <p>{reading.rationale}</p>
                    <div className="assessment-reading-sources">
                      {reading.sources.map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="assessment-reading-empty">
              <AIListCard
                icon={BookOpen}
                title="Leituras recomendadas"
                items={[]}
                emptyCopy="Nenhuma leitura foi validada nesta versão da interpretação. Gere a versão atual para pesquisar recomendações verificáveis."
              />
              {mentor ? (
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => void generateInterpretation(Boolean(aiAnalysis))}
                >
                  <Sparkles size={17} />
                  {aiBusy ? "Pesquisando…" : "Pesquisar e gerar leituras"}
                </button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {tab === "Testes realizados" ? (
        <section className="assessment-section assessment-section--history">
          <header>
            <span className="assessment-section__eyebrow">Histórico preservado</span>
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
              <span className={`assessment-history-status is-${item.status}`}>
                {item.status === "completed" ? "Concluído" : "Em andamento"}
              </span>
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
          pensando em quem você reconhece ter sido ao longo da sua vida, não somente no momento
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
        Perfil Adaptado descreve como você relata que age no trabalho, não como deveria agir e nem o
        que acredita que esperam de você.
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
    refetchInterval: (current) =>
      current.state.data?.aiAnalysis?.status === "pending" ? 5_000 : false,
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
              aiAnalysis={query.data?.aiAnalysis ?? null}
              onChanged={() => void query.refetch()}
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

export function AssessmentMentorContent({
  enrollmentId,
  name,
  activeTab,
  hideTabs = false,
}: {
  enrollmentId: string;
  name: string;
  activeTab?: AssessmentMentorSection | undefined;
  hideTabs?: boolean | undefined;
}) {
  const load = useServerFn(getMentorAssessmentProfile);
  const query = useQuery({
    queryKey: ["mentor-assessment", enrollmentId],
    queryFn: () => load({ data: { enrollmentId } }),
    retry: false,
    refetchInterval: (current) =>
      current.state.data?.aiAnalysis?.status === "pending" ? 5_000 : false,
  });
  return (
    <div className="mentee-profile-assessment">
      {query.isLoading ? (
        <div className="assessment-loading">Carregando mapeamento…</div>
      ) : query.isError ? (
        <div className="assessment-empty">
          <BrainCircuit size={34} />
          <h2>Não foi possível carregar o acompanhamento</h2>
          <p>A conexão não foi concluída. Tente novamente sem sair desta página.</p>
          <button type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : query.data?.latest?.calculated_result ? (
        <AssessmentReport
          result={query.data.latest.calculated_result as PublicResult}
          full
          mentor
          enrollmentId={enrollmentId}
          attempt={query.data.latest}
          attempts={query.data.attempts ?? []}
          plans={query.data.plans ?? []}
          aiAnalysis={query.data.aiAnalysis ?? null}
          activeTab={activeTab}
          hideTabs={hideTabs}
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
          <AssessmentMentorContent enrollmentId={enrollmentId} name={name} />
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
          aiAnalysis={null}
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

