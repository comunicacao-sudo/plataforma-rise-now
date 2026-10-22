import { ArrowRight, CalendarDays, Clock3, Play, Video } from "lucide-react";

import type { NextJourneyStep } from "@/lib/journey.functions";

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metadata(step: NextJourneyStep) {
  if (step.format === "questionnaire" || step.format === "form") return [];
  const items: Array<{ icon: "video" | "clock" | "calendar"; label: string }> = [];
  if (
    step.format === "recorded_class" ||
    step.format === "collective_recording" ||
    step.format === "cohort_onboarding"
  )
    items.push({
      icon: "video",
      label:
        step.format === "cohort_onboarding"
          ? "Onboarding da sua turma"
          : step.format === "collective_recording"
            ? "Encontro coletivo gravado"
            : "Aula gravada",
    });
  if (step.format === "live_group") {
    const meet = step.resourceUrl?.includes("meet.google.com");
    items.push({
      icon: "video",
      label: meet ? "Reunião coletiva no Google Meet" : "Encontro coletivo ao vivo",
    });
  }
  if (step.format === "individual_1_1") {
    items.push({
      icon: "video",
      label: `Encontro individual 1:1${step.responsibleName ? ` com ${step.responsibleName}` : ""}`,
    });
  }
  if (step.durationMinutes)
    items.push({ icon: "clock", label: `Duração prevista: ${step.durationMinutes} min` });
  const when = formatDate(step.scheduledAt);
  if (when) items.push({ icon: "calendar", label: when });
  return items;
}

function MetaIcon({ type }: { type: "video" | "clock" | "calendar" }) {
  if (type === "clock") return <Clock3 size={24} aria-hidden="true" />;
  if (type === "calendar") return <CalendarDays size={24} aria-hidden="true" />;
  return <Video size={25} aria-hidden="true" />;
}

export function NextStepHero({
  step,
  onAction,
  busy = false,
  preview = false,
}: {
  step: NextJourneyStep;
  onAction?: () => void;
  busy?: boolean;
  preview?: boolean;
}) {
  if (step.state === "complete") {
    return (
      <section className="next-step-hero next-step-hero--message">
        <div className="next-step-hero__content page-width">
          <div className="next-step-hero__copy">
            <span className="next-step-hero__eyebrow">Jornada concluída</span>
            <h1>
              <strong>Você chegou até aqui.</strong>
              <span> Celebre a sua evolução.</span>
            </h1>
            <p>
              Sua jornada publicada foi concluída. Os conteúdos já realizados continuam disponíveis
              em Minha jornada.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (step.state === "no_enrollment") {
    return (
      <section className="next-step-hero next-step-hero--message">
        <div className="next-step-hero__content page-width">
          <div className="next-step-hero__copy">
            <span className="next-step-hero__eyebrow">RISE NOW</span>
            <h1>
              <strong>Sua jornada</strong>
              <span> está sendo preparada.</span>
            </h1>
            <p>
              Assim que a sua matrícula receber uma jornada publicada, o próximo passo aparecerá
              aqui.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (step.state === "error") {
    return (
      <section className="next-step-hero next-step-hero--message">
        <div className="next-step-hero__content page-width">
          <div className="next-step-hero__copy">
            <span className="next-step-hero__eyebrow">Sua jornada</span>
            <h1>
              <strong>Não foi possível carregar</strong>
              <span> o próximo passo.</span>
            </h1>
            <p>
              Tente novamente em instantes. Nenhuma etapa foi avançada ou marcada como concluída.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const meta = metadata(step);
  const unavailable =
    step.state === "blocked" || step.state === "waiting_resource" || !step.actionLabel;
  const waitCopy =
    step.state === "blocked"
      ? "Esta etapa ainda não foi liberada. Você receberá a orientação assim que chegar o momento."
      : "A equipe RISE está preparando o acesso desta etapa.";
  const hasImpactCopy = Boolean(step.impactLead || step.impactHighlight || step.impactTail);

  return (
    <section
      className="next-step-hero"
      aria-label={preview ? "Visualização prévia do próximo passo" : "Seu próximo passo"}
    >
      <div className="next-step-hero__art" aria-hidden="true">
        <span className="next-step-hero__glow" />
        <span className="next-step-hero__wave next-step-hero__wave--top" />
        <span className="next-step-hero__wave next-step-hero__wave--bottom" />
        <span className="next-step-hero__orbit" />
        <span className="next-step-hero__sprout">
          <i className="next-step-hero__stem" />
          <i className="next-step-hero__leaf next-step-hero__leaf--one" />
          <i className="next-step-hero__leaf next-step-hero__leaf--two" />
          <i className="next-step-hero__seed" />
          <i className="next-step-hero__star" />
        </span>
      </div>
      <div className="next-step-hero__content page-width">
        <div className="next-step-hero__copy">
          <span className="next-step-hero__eyebrow">
            {preview ? "Visualização prévia" : (step.pillarName ?? "Sua jornada")}
          </span>
          <h1 className={!hasImpactCopy ? "next-step-hero__title-fallback" : undefined}>
            {hasImpactCopy ? (
              <>
                {step.impactLead ? <span>{step.impactLead} </span> : null}
                {step.impactHighlight ? <strong>{step.impactHighlight}</strong> : null}
                {step.impactTail ? <span> {step.impactTail}</span> : null}
              </>
            ) : (
              <span>{step.title ?? "Seu próximo passo"}</span>
            )}
          </h1>
          <p>{step.description}</p>
          {meta.length ? (
            <div className="next-step-hero__meta">
              {meta.map((item, index) => (
                <span key={`${item.label}-${index}`}>
                  <MetaIcon type={item.icon} /> {item.label}
                </span>
              ))}
            </div>
          ) : null}
          {unavailable ? (
            <div className="next-step-hero__waiting" role="status">
              {waitCopy}
            </div>
          ) : (
            <button
              className="next-step-hero__button"
              type="button"
              onClick={onAction}
              disabled={busy || preview}
            >
              {busy ? "Abrindo…" : step.actionLabel}
              {["recorded_class", "collective_recording", "cohort_onboarding"].includes(
                step.format ?? "",
              ) ? (
                <Play size={22} fill="currentColor" />
              ) : (
                <ArrowRight size={25} />
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
