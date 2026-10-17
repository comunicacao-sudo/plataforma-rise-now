import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { NextStepHero } from "@/components/journey-next-step";
import {
  confirmJourneyStep,
  getJourneyEditor,
  publishJourneyDraft,
  saveJourneyDraft,
  type JourneyDraftStep,
  type NextJourneyStep,
} from "@/lib/journey.functions";

const formatLabels: Record<JourneyDraftStep["format"], string> = {
  questionnaire: "Questionário",
  form: "Formulário",
  recorded_class: "Aula gravada",
  live_group: "Aula coletiva ao vivo",
  individual_1_1: "Encontro individual 1:1",
};

const completionLabels: Record<JourneyDraftStep["completionRule"], string> = {
  final_submission: "Envio final confirmado",
  player_ended: "Evento de término do player",
  mentor_confirmation: "Confirmação da mentora",
  verified_external: "Confirmação externa verificada",
};

function emptyStep(): JourneyDraftStep {
  return {
    stableKey: crypto.randomUUID(),
    title: "",
    format: "questionnaire",
    impactLead: "",
    impactHighlight: "",
    impactTail: "",
    description: "",
    responsibleName: null,
    durationMinutes: null,
    resourceType: null,
    resourceId: null,
    resourceUrl: null,
    scheduledAt: null,
    releaseAt: null,
    completionRule: "final_submission",
    required: true,
  };
}

function toLocal(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function StepForm({
  initial,
  onSave,
  onClose,
}: {
  initial: JourneyDraftStep;
  onSave: (step: JourneyDraftStep) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(initial);
  const update = <K extends keyof JourneyDraftStep>(key: K, value: JourneyDraftStep[K]) =>
    setStep((current) => ({ ...current, [key]: value }));
  const showMeeting = step.format === "live_group" || step.format === "individual_1_1";
  const showDuration = showMeeting || step.format === "recorded_class";

  function changeFormat(format: JourneyDraftStep["format"]) {
    setStep((current) => ({
      ...current,
      format,
      resourceType: null,
      resourceId: null,
      resourceUrl: null,
      scheduledAt: null,
      completionRule:
        format === "questionnaire" || format === "form"
          ? "final_submission"
          : format === "recorded_class"
            ? "mentor_confirmation"
            : "mentor_confirmation",
    }));
  }

  return (
    <div className="journey-editor-modal" role="dialog" aria-modal="true" aria-label="Editar etapa">
      <form
        className="journey-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(step);
        }}
      >
        <div className="journey-editor-form__head">
          <div>
            <span>Minha jornada</span>
            <h2>{initial.title ? "Editar etapa" : "Adicionar etapa"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <fieldset>
          <legend>Identificação</legend>
          <label>
            <span>Título da etapa</span>
            <input
              value={step.title}
              onChange={(e) => update("title", e.target.value)}
              maxLength={160}
            />
          </label>
          <label>
            <span>Formato</span>
            <select
              value={step.format}
              onChange={(e) => changeFormat(e.target.value as JourneyDraftStep["format"])}
            >
              {Object.entries(formatLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Conteúdo do destaque</legend>
          <p className="journey-field-help">
            Monte a frase com trechos claros e dourados, sem inserir HTML.
          </p>
          <label>
            <span>Trecho claro inicial</span>
            <input
              value={step.impactLead}
              onChange={(e) => update("impactLead", e.target.value)}
              maxLength={180}
            />
          </label>
          <label>
            <span>Trecho dourado</span>
            <input
              value={step.impactHighlight}
              onChange={(e) => update("impactHighlight", e.target.value)}
              maxLength={180}
            />
          </label>
          <label>
            <span>Trecho claro final</span>
            <input
              value={step.impactTail}
              onChange={(e) => update("impactTail", e.target.value)}
              maxLength={180}
            />
          </label>
          <label>
            <span>Breve descrição</span>
            <textarea
              value={step.description}
              onChange={(e) => update("description", e.target.value)}
              maxLength={1200}
              rows={5}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Atividade</legend>
          {showMeeting || step.format === "recorded_class" ? (
            <label>
              <span>Responsável</span>
              <input
                value={step.responsibleName ?? ""}
                onChange={(e) => update("responsibleName", e.target.value || null)}
              />
            </label>
          ) : null}
          {showDuration ? (
            <label>
              <span>Duração prevista em minutos</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={step.durationMinutes ?? ""}
                onChange={(e) =>
                  update("durationMinutes", e.target.value ? Number(e.target.value) : null)
                }
              />
            </label>
          ) : null}
          <label>
            <span>URL do recurso ou acesso</span>
            <input
              type="url"
              value={step.resourceUrl ?? ""}
              onChange={(e) => update("resourceUrl", e.target.value || null)}
              placeholder="https://"
            />
          </label>
          <p className="journey-field-help">
            O formato não cria perguntas, vídeos ou reservas. Vincule apenas um recurso real já
            disponível.
          </p>
          {showMeeting ? (
            <label>
              <span>Data e horário, quando global</span>
              <input
                type="datetime-local"
                value={toLocal(step.scheduledAt)}
                onChange={(e) => update("scheduledAt", toIso(e.target.value))}
              />
            </label>
          ) : null}
        </fieldset>

        <details>
          <summary>Percurso e regras avançadas</summary>
          <div className="journey-editor-form__details">
            <label>
              <span>Liberação a partir de</span>
              <input
                type="datetime-local"
                value={toLocal(step.releaseAt)}
                onChange={(e) => update("releaseAt", toIso(e.target.value))}
              />
            </label>
            <label>
              <span>Critério de conclusão</span>
              <select
                value={step.completionRule}
                onChange={(e) =>
                  update("completionRule", e.target.value as JourneyDraftStep["completionRule"])
                }
              >
                {Object.entries(completionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="journey-check">
              <input
                type="checkbox"
                checked={step.required}
                onChange={(e) => update("required", e.target.checked)}
              />
              <span>Etapa obrigatória</span>
            </label>
          </div>
        </details>

        <div className="journey-editor-form__actions">
          <button type="button" className="button button--glass" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button--primary">
            <Save size={17} /> Aplicar ao rascunho
          </button>
        </div>
      </form>
    </div>
  );
}

export function JourneyAdmin() {
  const load = useServerFn(getJourneyEditor);
  const save = useServerFn(saveJourneyDraft);
  const publish = useServerFn(publishJourneyDraft);
  const confirm = useServerFn(confirmJourneyStep);
  const qc = useQueryClient();
  const [pillarId, setPillarId] = useState<string>();
  const query = useQuery({
    queryKey: ["journey-editor", pillarId],
    queryFn: () => load({ data: pillarId ? { pillarId } : undefined }),
  });
  const [localSteps, setLocalSteps] = useState<JourneyDraftStep[] | null>(null);
  const [editing, setEditing] = useState<JourneyDraftStep | null>(null);
  const [preview, setPreview] = useState<JourneyDraftStep | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [applyActive, setApplyActive] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "publish" | string>("");
  const [message, setMessage] = useState("");
  const data = query.data;
  const steps = localSteps ?? data?.steps ?? [];

  const selectedPillarId = data?.selected?.id;
  const dirty = localSteps !== null;
  const previewStep = useMemo<NextJourneyStep | null>(
    () =>
      preview
        ? {
            state: preview.resourceUrl || preview.resourceId ? "ready" : "waiting_resource",
            pillarName: data?.selected?.name,
            ...preview,
            stepKey: preview.stableKey,
            actionLabel: formatLabels[preview.format],
          }
        : null,
    [preview, data?.selected?.name],
  );

  function move(from: number, to: number) {
    if (to < 0 || to >= steps.length || from === to) return;
    const copy = [...steps];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    setLocalSteps(copy);
  }

  function upsert(step: JourneyDraftStep) {
    const index = steps.findIndex((item) => item.stableKey === step.stableKey);
    const copy = [...steps];
    if (index >= 0) copy[index] = step;
    else copy.push(step);
    setLocalSteps(copy);
    setEditing(null);
  }

  async function saveNow() {
    if (!selectedPillarId || !data) return;
    setBusy("save");
    setMessage("");
    try {
      await save({ data: { pillarId: selectedPillarId, expectedRevision: data.revision, steps } });
      setLocalSteps(null);
      await qc.invalidateQueries({ queryKey: ["journey-editor"] });
      setMessage("Rascunho salvo. As mentoradas ainda não foram afetadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o rascunho.");
    } finally {
      setBusy("");
    }
  }

  async function publishNow() {
    if (!selectedPillarId || !data) return;
    setBusy("publish");
    setMessage("");
    try {
      let revision = data.revision;
      if (dirty) {
        const result = await save({
          data: { pillarId: selectedPillarId, expectedRevision: revision, steps },
        });
        revision = result.revision;
      }
      await publish({
        data: { pillarId: selectedPillarId, expectedRevision: revision, applyActive },
      });
      setLocalSteps(null);
      setPublishOpen(false);
      setApplyActive(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["journey-editor"] }),
        qc.invalidateQueries({ queryKey: ["next-journey-step"] }),
      ]);
      setMessage("Alterações publicadas com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível publicar.");
    } finally {
      setBusy("");
    }
  }

  async function confirmNow(enrollmentId: string, stepKey: string) {
    const operation = `confirm:${enrollmentId}:${stepKey}`;
    setBusy(operation);
    setMessage("");
    try {
      await confirm({ data: { enrollmentId, stepKey } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["journey-editor"] }),
        qc.invalidateQueries({ queryKey: ["next-journey-step"] }),
      ]);
      setMessage("Conclusão confirmada. O próximo passo da mentorada foi recalculado.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível confirmar a conclusão.",
      );
    } finally {
      setBusy("");
    }
  }

  if (query.isLoading)
    return (
      <main className="inner-page">
        <div className="page-width journey-editor-loading">Carregando sua jornada…</div>
      </main>
    );
  if (query.error)
    return (
      <main className="inner-page">
        <div className="page-width journey-editor-error">
          <h1>Não foi possível abrir Minha jornada.</h1>
          <p>A migration da jornada precisa estar aplicada no banco conectado.</p>
        </div>
      </main>
    );

  return (
    <main className="inner-page journey-editor-page">
      <div className="page-intro page-width">
        <span className="eyebrow eyebrow--gold">Administração da jornada</span>
        <h1>Minha jornada</h1>
        <p>Organize, revise e publique as etapas do seu pilar sem editar código.</p>
      </div>
      <section className="page-width journey-editor-toolbar">
        <div>
          <span>Pilar</span>
          {data?.isAdmin && (data.pillars?.length ?? 0) > 1 ? (
            <select
              value={selectedPillarId}
              onChange={(e) => {
                setPillarId(e.target.value);
                setLocalSteps(null);
              }}
            >
              {data.pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.name}
                </option>
              ))}
            </select>
          ) : (
            <strong>{data?.selected?.name ?? "Sem pilar vinculado"}</strong>
          )}
          <small>{data?.selected?.mentorName}</small>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => setEditing(emptyStep())}
          disabled={!data?.selected}
        >
          <Plus size={18} /> Adicionar etapa
        </button>
      </section>

      <section className="page-width journey-editor-list" aria-label="Etapas do rascunho">
        {!steps.length ? (
          <div className="journey-editor-empty">
            <h2>Seu rascunho ainda não tem etapas.</h2>
            <p>Adicione a primeira atividade. Nada será mostrado às mentoradas até a publicação.</p>
          </div>
        ) : (
          steps.map((step, index) => (
            <article
              key={step.stableKey}
              className="journey-step-row"
              draggable
              onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => move(Number(event.dataTransfer.getData("text/plain")), index)}
            >
              <span className="journey-step-row__number">{index + 1}</span>
              <GripVertical className="journey-step-row__grip" aria-hidden="true" />
              <div className="journey-step-row__copy">
                <strong>{step.title || "Etapa sem título"}</strong>
                <span>
                  {formatLabels[step.format]} ·{" "}
                  {step.resourceUrl || step.resourceId ? "Recurso vinculado" : "Aguardando recurso"}
                </span>
              </div>
              <span className="journey-step-row__status">Rascunho</span>
              <div className="journey-step-row__actions">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Mover ${step.title} para cima`}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === steps.length - 1}
                  aria-label={`Mover ${step.title} para baixo`}
                >
                  <ArrowDown size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(step)}
                  aria-label={`Pré-visualizar ${step.title}`}
                >
                  <Eye size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(step)}
                  aria-label={`Editar ${step.title}`}
                >
                  <Pencil size={17} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.confirm(
                      `Remover “${step.title}” do rascunho? O histórico publicado será preservado.`,
                    ) && setLocalSteps(steps.filter((item) => item.stableKey !== step.stableKey))
                  }
                  aria-label={`Remover ${step.title}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="page-width journey-editor-footer">
        <div>
          {message ? (
            <p role="status">{message}</p>
          ) : (
            <p>Salvar rascunho não altera a jornada publicada.</p>
          )}
        </div>
        <div>
          <button
            className="button button--glass"
            type="button"
            onClick={() => steps[0] && setPreview(steps[0])}
            disabled={!steps.length}
          >
            <Eye size={17} /> Pré-visualizar
          </button>
          <button
            className="button button--glass"
            type="button"
            onClick={() => void saveNow()}
            disabled={busy !== "" || !dirty}
          >
            <Save size={17} /> {busy === "save" ? "Salvando…" : "Salvar rascunho"}
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={busy !== "" || !steps.length}
          >
            <Send size={17} /> Publicar alterações
          </button>
        </div>
      </section>

      {(data?.confirmations?.length ?? 0) > 0 ? (
        <section
          className="page-width journey-confirmations"
          aria-labelledby="journey-confirmations-title"
        >
          <div>
            <span className="eyebrow eyebrow--gold">Validação humana</span>
            <h2 id="journey-confirmations-title">Conclusões para confirmar</h2>
            <p>Somente confirme depois de verificar que a atividade realmente aconteceu.</p>
          </div>
          <div className="journey-confirmations__list">
            {data.confirmations.map((item) => {
              const operation = `confirm:${item.enrollmentId}:${item.stepKey}`;
              return (
                <article key={operation}>
                  <div>
                    <strong>{item.menteeName}</strong>
                    <span>{item.stepTitle}</span>
                    <small>
                      {item.status === "awaiting_confirmation"
                        ? "Aguardando confirmação"
                        : "Etapa iniciada"}
                    </small>
                  </div>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => void confirmNow(item.enrollmentId, item.stepKey)}
                    disabled={busy !== ""}
                  >
                    {busy === operation ? "Confirmando…" : "Confirmar conclusão"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {editing ? (
        <StepForm initial={editing} onSave={upsert} onClose={() => setEditing(null)} />
      ) : null}
      {previewStep ? (
        <div
          className="journey-preview"
          role="dialog"
          aria-modal="true"
          aria-label="Pré-visualização"
        >
          <button
            className="journey-preview__close"
            type="button"
            onClick={() => setPreview(null)}
            aria-label="Fechar pré-visualização"
          >
            <X size={20} />
          </button>
          <NextStepHero step={previewStep} preview />
          <p>Prévia com o mesmo componente usado no Início. Nenhum progresso foi alterado.</p>
        </div>
      ) : null}
      {publishOpen ? (
        <div
          className="journey-editor-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Publicar alterações"
        >
          <div className="journey-publish-card">
            <button
              className="journey-publish-card__close"
              type="button"
              onClick={() => setPublishOpen(false)}
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
            <span className="eyebrow eyebrow--gold">Revisão da publicação</span>
            <h2>
              Publicar {steps.length} {steps.length === 1 ? "etapa" : "etapas"} em{" "}
              {data?.selected?.name}?
            </h2>
            <p>A nova versão será usada automaticamente por novas matrículas.</p>
            <label className="journey-check journey-check--boxed">
              <input
                type="checkbox"
                checked={applyActive}
                onChange={(e) => setApplyActive(e.target.checked)}
              />
              <span>Aplicar também às {data?.affectedActive ?? 0} matrículas ativas elegíveis</span>
            </label>
            <small>
              Ao aplicar às participantes ativas, a primeira etapa obrigatória pendente será
              recalculada. Conclusões existentes com a mesma identidade são preservadas.
            </small>
            <div className="journey-editor-form__actions">
              <button
                className="button button--glass"
                type="button"
                onClick={() => setPublishOpen(false)}
              >
                Voltar
              </button>
              <button
                className="button button--primary"
                type="button"
                onClick={() => void publishNow()}
                disabled={busy !== ""}
              >
                {busy === "publish" ? "Publicando…" : "Confirmar publicação"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
