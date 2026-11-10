import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LockKeyhole,
  MessageCircle,
  NotebookPen,
  Play,
  UsersRound,
  Video,
} from "lucide-react";
import { useState } from "react";

import { SectionHero } from "@/components/section-hero";
import { NextMeetingMini } from "@/components/rise-ops";
import type { Trail, TrailLesson } from "@/components/rise-trail";
import type { JourneyContentItem, JourneyResume, NotebookEntry } from "@/lib/content.functions";
import {
  buildJourneyTimelineItems,
  isJourneyTimelineItemDisabled,
  resolveJourneyTimelineTarget,
  type JourneyTimelineItem,
} from "@/lib/journey-navigation";

type StepKind = "video" | "live" | "one" | "quiz";

function stepKind(item: JourneyTimelineItem): StepKind {
  const format = item.content?.format;
  if (format === "individual_1_1") return "one";
  if (format === "live_group" || format === "cohort_onboarding") return "live";
  if (format === "questionnaire" || format === "form") return "quiz";
  if (item.content?.resourceType === "rise_assessment") return "quiz";
  if (!item.content && item.lesson && item.lesson.kind !== "aula") return "live";
  return "video";
}

const KIND_LABEL: Record<StepKind, string> = {
  video: "Aulas gravadas",
  live: "Ao vivo com a turma",
  one: "Encontro 1:1",
  quiz: "Questionário",
};

function KindIcon({ kind }: { kind: StepKind }) {
  if (kind === "live") return <UsersRound size={20} aria-hidden="true" />;
  if (kind === "one") return <MessageCircle size={20} aria-hidden="true" />;
  if (kind === "quiz") return <ClipboardList size={20} aria-hidden="true" />;
  return <Video size={20} aria-hidden="true" />;
}

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

type StepView = {
  item: JourneyTimelineItem;
  kind: StepKind;
  meta: string;
  status: "done" | "progress" | "scheduled" | "todo" | "available" | "locked";
  statusLabel: string;
  action: { label: string; primary: boolean; run: () => void } | null;
  progress: number | null;
};

export function JourneyHub({
  trail,
  journeyItems,
  resume,
  recentNotes,
  onOpen,
  onOpenContent,
  onAgenda,
}: {
  trail: Trail;
  journeyItems: JourneyContentItem[];
  resume: JourneyResume | null | undefined;
  recentNotes: NotebookEntry[] | undefined;
  onOpen: (lesson: TrailLesson) => void;
  onOpenContent: (stepKey: string, contentId?: string | null) => void;
  onAgenda: () => void;
}) {
  const months = trail.phases.map((phase) => ({
    phase,
    items: buildJourneyTimelineItems(phase.month, phase.lessons, journeyItems),
  }));
  const allItems = months.flatMap((month) => month.items);
  const completed = allItems.filter((item) => item.completed).length;
  const progress = allItems.length ? Math.round((completed / allItems.length) * 100) : 0;
  const currentPhase =
    trail.phases.find((phase) => phase.month === trail.currentMonth) ?? trail.phases[0];
  const [selectedMonth, setSelectedMonth] = useState(currentPhase?.month ?? 1);
  const selected = months.find((month) => month.phase.month === selectedMonth) ?? months[0];

  const open = (item: JourneyTimelineItem, contentId?: string | null) => {
    const target = resolveJourneyTimelineTarget(item);
    if (target?.type === "content") onOpenContent(target.stepKey, contentId);
    else if (target?.type === "lesson") onOpen(target.lesson);
  };

  const describe = (item: JourneyTimelineItem): StepView => {
    const kind = stepKind(item);
    const disabled =
      isJourneyTimelineItemDisabled(item, trail.currentMonth) ||
      !resolveJourneyTimelineTarget(item);
    const content = item.content;
    const videos = content?.videos ?? [];
    const watched = videos.filter((video) => video.completed).length;
    const scheduled = content?.scheduledAt ?? null;
    const future = scheduled ? Date.parse(scheduled) > Date.now() : false;
    const minutes = videos.reduce((sum, video) => sum + (video.durationMinutes ?? 0), 0);
    const meta =
      kind === "video" && videos.length > 1
        ? `${videos.length} aulas${minutes ? ` · cerca de ${minutes} min` : ""}`
        : kind === "video" && content?.durationMinutes
          ? `${content.durationMinutes} min`
          : kind === "one"
            ? scheduled
              ? `Sessão com sua mentora · ${shortDate(scheduled)}`
              : "Sessão com sua mentora"
            : kind === "live"
              ? scheduled
                ? `Encontro da turma · ${shortDate(scheduled)}`
                : "Encontro da turma"
              : item.label;
    if (item.completed)
      return {
        item,
        kind,
        meta,
        status: "done",
        statusLabel: "Concluída",
        progress: null,
        action: disabled
          ? null
          : {
              label: kind === "quiz" ? "Ver resultado" : "Rever",
              primary: false,
              run: () => open(item),
            },
      };
    if (disabled) {
      const when = content?.releaseAt ?? content?.scheduledAt;
      return {
        item,
        kind,
        meta,
        status: "locked",
        statusLabel: when ? `Libera em ${shortDate(when)}` : "Em breve",
        progress: null,
        action: null,
      };
    }
    if (kind === "video" && videos.length > 1 && watched > 0)
      return {
        item,
        kind,
        meta,
        status: "progress",
        statusLabel: `${watched} de ${videos.length} aulas`,
        progress: Math.round((watched / videos.length) * 100),
        action: {
          label: "Continuar",
          primary: true,
          run: () => open(item, videos.find((video) => !video.completed)?.id ?? null),
        },
      };
    if (kind === "one" && !future)
      return {
        item,
        kind,
        meta,
        status: "todo",
        statusLabel: "Falta agendar",
        progress: null,
        action: { label: "Agendar 1:1", primary: true, run: onAgenda },
      };
    if ((kind === "one" || kind === "live") && future)
      return {
        item,
        kind,
        meta,
        status: "scheduled",
        statusLabel: "Agendado",
        progress: null,
        action: { label: "Ver na agenda", primary: false, run: onAgenda },
      };
    return {
      item,
      kind,
      meta,
      status: "available",
      statusLabel: "Disponível",
      progress: null,
      action: {
        label: kind === "quiz" ? "Responder" : kind === "video" ? "Começar" : "Abrir",
        primary: true,
        run: () => open(item),
      },
    };
  };

  // "Falta você fazer": o primeiro 1:1 liberado, não concluído e sem horário marcado.
  const pendingOneToOne = allItems
    .map(describe)
    .find((step) => step.kind === "one" && step.status === "todo");
  // Sem aula para retomar: a próxima etapa liberada.
  const nextStep = allItems.map(describe).find((step) => step.action && step.status !== "done");
  const resumeItem = resume
    ? allItems.find((item) => item.content?.stepKey === resume.stepKey)
    : undefined;
  const resumePct =
    resume && resume.durationSeconds
      ? Math.min(100, Math.round((resume.currentSeconds / resume.durationSeconds) * 100))
      : 0;
  const remaining =
    resume && resume.durationSeconds && resume.currentSeconds
      ? Math.max(1, Math.round((resume.durationSeconds - resume.currentSeconds) / 60))
      : null;

  return (
    <main className="inner-page inner-page--section-hero mentee-journey-page">
      <SectionHero
        section="Minha jornada"
        phrase="Cada etapa revela a força que sustenta a sua evolução"
      />
      <div className="page-width journey-hub">
        <section className="journey-hub__intro" aria-label="Seu avanço na jornada">
          <span className="eyebrow eyebrow--gold">
            Mês {trail.currentMonth} de {trail.phases.length}
            {currentPhase ? ` · Pilar ${currentPhase.pillar}` : ""}
          </span>
          <h2>
            {completed === allItems.length && allItems.length
              ? "Jornada concluída"
              : "Vamos seguir?"}
          </h2>
          <p>
            Você concluiu {completed} de {allItems.length} etapas da jornada.
          </p>
          <div className="journey-hub__bar">
            <progress
              value={completed}
              max={Math.max(1, allItems.length)}
              aria-label="Etapas concluídas"
            />
            <span>{progress}% da jornada</span>
          </div>
        </section>

        <section className="journey-hub__next" aria-label="Seu próximo passo">
          {resume ? (
            <button
              className="journey-resume"
              type="button"
              onClick={() =>
                resumeItem
                  ? open(resumeItem, resume.contentId)
                  : onOpenContent(resume.stepKey, resume.contentId)
              }
            >
              <span className="journey-resume__media" aria-hidden="true">
                <span className="journey-resume__play">
                  <Play size={28} />
                </span>
                {resumePct > 0 ? (
                  <span className="journey-resume__track">
                    <span style={{ width: `${resumePct}%` }} />
                  </span>
                ) : null}
                {remaining ? <em>faltam {remaining} min</em> : null}
              </span>
              <span className="journey-resume__body">
                <small>
                  {resume.currentSeconds > 0 ? "Continue de onde parou" : "Sua próxima aula"}
                </small>
                <strong>{resume.title}</strong>
                <span>
                  Aula {resume.index} de {resume.total} · {resume.stageTitle}
                  {resume.durationMinutes ? ` · ${resume.durationMinutes} min` : ""}
                </span>
                <span className="button button--primary">
                  {resume.currentSeconds > 0
                    ? `Continuar de ${clock(resume.currentSeconds)}`
                    : "Começar aula"}{" "}
                  <ArrowRight size={17} />
                </span>
              </span>
            </button>
          ) : nextStep ? (
            <div className="journey-resume journey-resume--step">
              <span className="journey-resume__body">
                <small>Sua próxima etapa</small>
                <strong>{nextStep.item.title}</strong>
                <span>
                  {KIND_LABEL[nextStep.kind]} · {nextStep.meta}
                </span>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={nextStep.action!.run}
                >
                  {nextStep.action!.label} <ArrowRight size={17} />
                </button>
              </span>
            </div>
          ) : (
            <div className="journey-resume journey-resume--step">
              <span className="journey-resume__body">
                <small>Sua jornada</small>
                <strong>Tudo em dia por aqui.</strong>
                <span>Assim que a próxima etapa for liberada, ela aparece neste espaço.</span>
              </span>
            </div>
          )}
          <div className="journey-hub__side">
            <NextMeetingMini onAgenda={onAgenda} />
            {pendingOneToOne ? (
              <article className="journey-side-card journey-side-card--todo">
                <span className="journey-side-card__eyebrow">
                  <Clock3 size={16} aria-hidden="true" /> Falta você fazer
                </span>
                <strong>Agendar seu 1:1 de {pendingOneToOne.item.title}</strong>
                <span className="journey-side-card__meta">Escolha um horário com sua mentora.</span>
                <div className="journey-side-card__actions">
                  <button className="button button--primary" type="button" onClick={onAgenda}>
                    Escolher horário
                  </button>
                </div>
              </article>
            ) : null}
          </div>
        </section>

        <section className="journey-map" aria-labelledby="journey-map-title">
          <div className="journey-map__head">
            <div>
              <h2 id="journey-map-title">Seu mapa da jornada</h2>
              <p>Escolha um mês para ver as etapas.</p>
            </div>
            <ul className="journey-map__legend" aria-label="Legenda">
              <li>
                <span className="is-done" /> Concluído
              </li>
              <li>
                <span className="is-progress" /> Em andamento
              </li>
              <li>
                <span className="is-locked" /> Em breve
              </li>
            </ul>
          </div>
          <div className="journey-map__months">
            {months.map(({ phase, items }) => {
              const done = items.filter((item) => item.completed).length;
              const pct = items.length ? Math.round((done / items.length) * 100) : 0;
              const state =
                items.length && done === items.length
                  ? "done"
                  : phase.month === trail.currentMonth
                    ? "current"
                    : phase.month < trail.currentMonth
                      ? "open"
                      : "upcoming";
              return (
                <button
                  key={phase.month}
                  type="button"
                  className={`journey-map__month is-${state}${phase.month === selectedMonth ? " is-selected" : ""}`}
                  aria-pressed={phase.month === selectedMonth}
                  onClick={() => setSelectedMonth(phase.month)}
                >
                  <small>Mês {phase.month}</small>
                  <strong>{phase.pillar}</strong>
                  <span className="journey-map__track">
                    <span style={{ width: `${state === "upcoming" ? 0 : Math.max(pct, 4)}%` }} />
                  </span>
                  <em>
                    {state === "done"
                      ? "Concluído"
                      : state === "upcoming"
                        ? "Em breve"
                        : `${done} de ${items.length} etapas${state === "current" ? " · agora" : ""}`}
                  </em>
                </button>
              );
            })}
          </div>
        </section>

        {selected ? (
          <section className="journey-month" aria-labelledby="journey-month-title">
            <div className="journey-month__intro">
              <span className="eyebrow eyebrow--gold">
                Mês {selected.phase.month} · {selected.phase.pillar}
              </span>
              <h2 id="journey-month-title">{selected.phase.title}</h2>
              {selected.phase.question ? <p>{selected.phase.question}</p> : null}
            </div>
            <ul className="journey-steps">
              {selected.items.map((item) => {
                const step = describe(item);
                return (
                  <li key={item.key} className={`journey-step is-${step.status}`}>
                    <span className="journey-step__icon">
                      {step.status === "locked" ? (
                        <LockKeyhole size={20} aria-hidden="true" />
                      ) : step.status === "done" ? (
                        <CheckCircle2 size={20} aria-hidden="true" />
                      ) : (
                        <KindIcon kind={step.kind} />
                      )}
                    </span>
                    <span className="journey-step__body">
                      <small>{KIND_LABEL[step.kind]}</small>
                      <strong>{item.title}</strong>
                      <span>{step.meta}</span>
                      {step.progress !== null ? (
                        <span className="journey-step__track" aria-hidden="true">
                          <span style={{ width: `${step.progress}%` }} />
                        </span>
                      ) : null}
                    </span>
                    <span className="journey-step__side">
                      <span className={`journey-pill is-${step.status}`}>{step.statusLabel}</span>
                      {step.action ? (
                        <button
                          type="button"
                          className={
                            step.action.primary ? "button button--primary" : "button button--glass"
                          }
                          onClick={step.action.run}
                        >
                          {step.action.label}
                        </button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {recentNotes?.length ? (
          <section className="journey-notes" aria-labelledby="journey-notes-title">
            <div className="journey-map__head">
              <div>
                <h2 id="journey-notes-title">Do seu caderno</h2>
                <p>Suas últimas anotações, para retomar o raciocínio antes da próxima aula.</p>
              </div>
            </div>
            <div className="journey-notes__grid">
              {recentNotes.slice(0, 4).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="journey-note"
                  onClick={() => onOpenContent(entry.stepKey, entry.contentId)}
                >
                  <small>
                    <NotebookPen size={14} aria-hidden="true" />{" "}
                    {entry.lessonTitle ?? entry.stageTitle}
                    {entry.kind === "marker" && entry.seconds !== null
                      ? ` · em ${clock(entry.seconds)}`
                      : ""}
                  </small>
                  <span>{entry.text}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
