import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  FileText,
  Link2,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getDirectory } from "@/lib/admin.functions";
import {
  createJourneyUpload,
  deleteStageContent,
  getStageContents,
  saveStageContent,
  type StageContentItem,
  type StageQuestion,
} from "@/lib/content.functions";
import { getJourneyEditor, type JourneyDraftStep } from "@/lib/journey.functions";
import { invalidateJourneyData, liveJourneyQueryOptions } from "@/lib/journey-sync";
import { deleteLessonFromR2, uploadLessonToR2 } from "@/lib/r2-worker";

const typeLabel: Record<StageContentItem["contentType"], string> = {
  video: "Aula gravada",
  material: "Material de apoio",
  questionnaire: "Questionário",
};

const typeIcon: Record<StageContentItem["contentType"], typeof Play> = {
  video: Play,
  material: FileText,
  questionnaire: BookOpen,
};

function audienceLabel(
  item: StageContentItem,
  cohorts: Array<{ id: string; name: string }>,
  mentees: Array<{ id: string; name: string }>,
) {
  if (item.accessScope === "cohort")
    return cohorts.find((c) => c.id === item.cohortId)?.name ?? "Turma específica";
  if (item.accessScope === "mentee")
    return mentees.find((m) => m.id === item.menteeId)?.name ?? "Mentorado específico";
  return "Todos os mentorados";
}

function newQuestion(): StageQuestion {
  return {
    id: crypto.randomUUID(),
    prompt: "",
    type: "long_text",
    required: true,
    options: [],
  };
}

function ContentForm({
  pillarId,
  step,
  initial,
  defaultType,
  cohorts,
  mentees,
  onDone,
}: {
  pillarId: string;
  step: JourneyDraftStep;
  initial: StageContentItem | null;
  defaultType?: StageContentItem["contentType"] | undefined;
  cohorts: Array<{ id: string; name: string }>;
  mentees: Array<{ id: string; name: string }>;
  onDone: () => void;
}) {
  const saveFn = useServerFn(saveStageContent);
  const createUpload = useServerFn(createJourneyUpload);
  const qc = useQueryClient();

  const [contentType, setContentType] = useState<StageContentItem["contentType"]>(
    initial?.contentType ?? defaultType ?? "video",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [duration, setDuration] = useState(
    initial?.durationMinutes ? String(initial.durationMinutes) : "",
  );
  const [mediaPath, setMediaPath] = useState(initial?.mediaPath ?? null);
  const [filePath, setFilePath] = useState(initial?.filePath ?? null);
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? "");
  const [accessScope, setAccessScope] = useState<StageContentItem["accessScope"]>(
    initial?.accessScope ?? "general",
  );
  const [cohortId, setCohortId] = useState(initial?.cohortId ?? "");
  const [menteeId, setMenteeId] = useState(initial?.menteeId ?? "");
  const [questions, setQuestions] = useState<StageQuestion[]>(
    initial?.questionnaire?.questions?.length ? initial.questionnaire.questions : [newQuestion()],
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadVideo(file: File) {
    setUploading(true);
    setMessage("");
    setProgress(0);
    try {
      const path = await uploadLessonToR2(file, (done, total) => {
        setProgress(total > 0 ? Math.round((done / total) * 100) : 0);
      });
      setMediaPath(path);
      setExternalUrl("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a aula.");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function uploadMaterial(file: File) {
    setUploading(true);
    setMessage("");
    try {
      const signed = await createUpload({
        data: {
          kind: "material",
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        },
      });
      const { error } = await supabase.storage
        .from("journey-content")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (error) throw error;
      setFilePath(signed.path);
      setExternalUrl("");
      if (!title.trim()) setTitle(file.name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o material.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setMessage("");
    const cleanTitle = title.trim();
    if (!cleanTitle) return setMessage("Informe um título.");
    if (accessScope === "cohort" && !cohortId) return setMessage("Selecione a turma.");
    if (accessScope === "mentee" && !menteeId) return setMessage("Selecione o mentorado.");

    if (contentType === "video" && !mediaPath && !externalUrl.trim())
      return setMessage("Envie a aula ou informe uma URL externa.");
    if (contentType === "material" && !filePath && !externalUrl.trim())
      return setMessage("Envie um arquivo ou informe um link.");
    if (contentType === "questionnaire" && !questions.some((question) => question.prompt.trim()))
      return setMessage("Adicione pelo menos uma pergunta.");

    setBusy(true);
    try {
      await saveFn({
        data: {
          id: initial?.id,
          pillarId,
          stepKey: step.stableKey,
          contentType,
          title: cleanTitle,
          description,
          durationMinutes: duration ? Number(duration) : null,
          mediaPath,
          filePath,
          externalUrl: externalUrl.trim() || null,
          accessScope,
          cohortId: accessScope === "cohort" ? cohortId : null,
          menteeId: accessScope === "mentee" ? menteeId : null,
          questionnaire: { questions },
          position: initial?.position ?? 0,
          active: true,
        },
      });

      if (initial?.mediaPath?.startsWith("r2:") && initial.mediaPath !== mediaPath) {
        await deleteLessonFromR2(initial.mediaPath);
      }
      if (initial?.filePath && initial.filePath !== filePath) {
        const { error: cleanupError } = await supabase.storage
          .from("journey-content")
          .remove([initial.filePath]);
        if (cleanupError) throw cleanupError;
      }

      await invalidateJourneyData(qc);
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Editar conteúdo"
      >
        <button className="modal-close" type="button" onClick={onDone} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">{step.title}</span>
          <h2>{initial ? "Editar conteúdo" : "Adicionar conteúdo"}</h2>

          <label className="ops-field">
            <span>Tipo de conteúdo</span>
            <select
              value={contentType}
              disabled={!!initial}
              onChange={(event) =>
                setContentType(event.target.value as StageContentItem["contentType"])
              }
            >
              <option value="video">Aula gravada</option>
              <option value="material">Material de apoio</option>
              <option value="questionnaire">Questionário</option>
            </select>
          </label>

          <label className="ops-field">
            <span>Título</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="ops-field">
            <span>Descrição (opcional)</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <fieldset className="ops-inline-form">
            <legend>Público</legend>
            <label className="ops-field">
              <span>Quem recebe este conteúdo?</span>
              <select
                value={accessScope}
                onChange={(event) => {
                  const scope = event.target.value as StageContentItem["accessScope"];
                  setAccessScope(scope);
                  if (scope !== "cohort") setCohortId("");
                  if (scope !== "mentee") setMenteeId("");
                }}
              >
                <option value="general">Todos</option>
                <option value="cohort">Uma turma específica</option>
                <option value="mentee">Um mentorado específico</option>
              </select>
            </label>
            {accessScope === "cohort" ? (
              <label className="ops-field">
                <span>Turma</span>
                <select value={cohortId} onChange={(event) => setCohortId(event.target.value)}>
                  <option value="">Selecione</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {accessScope === "mentee" ? (
              <label className="ops-field">
                <span>Mentorado</span>
                <select value={menteeId} onChange={(event) => setMenteeId(event.target.value)}>
                  <option value="">Selecione</option>
                  {mentees.map((mentee) => (
                    <option key={mentee.id} value={mentee.id}>
                      {mentee.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </fieldset>

          {contentType === "video" ? (
            <fieldset className="ops-inline-form">
              <legend>Aula</legend>
              <label className="ops-field">
                <span>Duração prevista em minutos</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </label>
              <label className="journey-upload">
                <Upload size={18} />
                <span>
                  {uploading
                    ? `Enviando para Cloudflare… ${progress ?? 0}%`
                    : mediaPath?.startsWith("r2:")
                      ? "Substituir aula no Cloudflare R2"
                      : "Enviar aula para Cloudflare R2"}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadVideo(file);
                  }}
                />
              </label>
              {mediaPath?.startsWith("r2:") ? (
                <p className="ops-muted">Vídeo privado armazenado no Cloudflare R2.</p>
              ) : null}
              <label className="ops-field">
                <span>URL externa alternativa (opcional)</span>
                <input
                  type="url"
                  placeholder="https://"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                />
              </label>
            </fieldset>
          ) : null}

          {contentType === "material" ? (
            <fieldset className="ops-inline-form">
              <legend>Material de apoio</legend>
              <label className="journey-upload">
                <Upload size={18} />
                <span>
                  {uploading
                    ? "Enviando arquivo…"
                    : filePath
                      ? "Substituir arquivo"
                      : "Adicionar arquivo"}
                </span>
                <input
                  type="file"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadMaterial(file);
                  }}
                />
              </label>
              {filePath ? <p className="ops-muted">Arquivo privado vinculado.</p> : null}
              <label className="ops-field">
                <span>Ou adicione um link</span>
                <input
                  type="url"
                  placeholder="https://"
                  value={externalUrl}
                  onChange={(event) => {
                    setExternalUrl(event.target.value);
                    if (event.target.value) setFilePath(null);
                  }}
                />
              </label>
            </fieldset>
          ) : null}

          {contentType === "questionnaire" ? (
            <fieldset className="ops-inline-form">
              <legend>Questionário</legend>
              <p className="ops-muted">O mentorado responde dentro da própria RISE.</p>
              {questions.map((question, index) => (
                <div className="admin-card" key={question.id}>
                  <div className="section-heading">
                    <strong>Pergunta {index + 1}</strong>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Remover pergunta"
                      onClick={() =>
                        setQuestions((current) => current.filter((item) => item.id !== question.id))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <label className="ops-field">
                    <span>Pergunta</span>
                    <textarea
                      rows={2}
                      value={question.prompt}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? { ...item, prompt: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="ops-field">
                    <span>Tipo de resposta</span>
                    <select
                      value={question.type}
                      onChange={(event) => {
                        const type = event.target.value as StageQuestion["type"];
                        setQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? {
                                  ...item,
                                  type,
                                  options: type === "single_choice" ? item.options : [],
                                }
                              : item,
                          ),
                        );
                      }}
                    >
                      <option value="short_text">Resposta curta</option>
                      <option value="long_text">Resposta longa</option>
                      <option value="single_choice">Múltipla escolha</option>
                    </select>
                  </label>
                  {question.type === "single_choice" ? (
                    <label className="ops-field">
                      <span>Opções, uma por linha</span>
                      <textarea
                        rows={4}
                        value={question.options.join("\n")}
                        onChange={(event) =>
                          setQuestions((current) =>
                            current.map((item) =>
                              item.id === question.id
                                ? {
                                    ...item,
                                    options: event.target.value
                                      .split("\n")
                                      .map((value) => value.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  ) : null}
                  <label className="journey-check">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? { ...item, required: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    <span>Resposta obrigatória</span>
                  </label>
                </div>
              ))}
              <button
                className="button button--glass"
                type="button"
                onClick={() => setQuestions((current) => [...current, newQuestion()])}
              >
                <Plus size={16} /> Adicionar pergunta
              </button>
            </fieldset>
          ) : null}

          {message ? <p className="form-message">{message}</p> : null}
          <div className="content-modal__actions">
            <button className="button button--glass" type="button" onClick={onDone} disabled={busy}>
              Cancelar
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => void save()}
              disabled={busy || uploading}
            >
              <Save size={16} /> {busy ? "Salvando…" : "Salvar conteúdo"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StageContentManager({
  pillarId,
  step,
  items,
  cohorts,
  mentees,
  onClose,
}: {
  pillarId: string;
  step: JourneyDraftStep;
  items: StageContentItem[];
  cohorts: Array<{ id: string; name: string }>;
  mentees: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const deleteFn = useServerFn(deleteStageContent);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<StageContentItem | null | "new">(null);
  const [newType, setNewType] = useState<StageContentItem["contentType"]>("video");
  const [message, setMessage] = useState("");

  async function remove(item: StageContentItem) {
    if (!window.confirm(`Remover “${item.title}” desta etapa?`)) return;
    setMessage("");
    try {
      if (item.mediaPath?.startsWith("r2:")) {
        await deleteLessonFromR2(item.mediaPath);
      }
      await deleteFn({ data: { id: item.id } });
      await invalidateJourneyData(qc);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover.");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="content-modal ops-modal" role="dialog" aria-modal="true">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">Conteúdos da etapa</span>
          <h2>{step.title}</h2>
          <p className="ops-muted">Mês {step.monthNumber}</p>

          <div className="ops-row">
            {(["video", "material", "questionnaire"] as const).map((type) => (
              <button
                key={type}
                className="button button--glass"
                type="button"
                onClick={() => {
                  setNewType(type);
                  setEditing("new");
                }}
              >
                <Plus size={16} /> {typeLabel[type]}
              </button>
            ))}
          </div>

          {items.length ? (
            <div className="ops-list">
              {items.map((item) => {
                const Icon = typeIcon[item.contentType];
                return (
                  <article className="admin-card" key={item.id}>
                    <div className="section-heading">
                      <div>
                        <small className="ops-muted">{typeLabel[item.contentType]}</small>
                        <strong>{item.title}</strong>
                        <p>
                          <UsersRound size={13} /> {audienceLabel(item, cohorts, mentees)}
                        </p>
                      </div>
                      <Icon size={20} />
                    </div>
                    <div className="ops-actions">
                      <button type="button" onClick={() => setEditing(item)}>
                        <Pencil size={15} /> Editar
                      </button>
                      <button type="button" onClick={() => void remove(item)}>
                        <Trash2 size={15} /> Excluir
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="ops-empty">Nenhum conteúdo cadastrado nesta etapa.</p>
          )}

          {message ? <p className="form-message">{message}</p> : null}
        </div>
      </section>

      {editing ? (
        <ContentForm
          pillarId={pillarId}
          step={step}
          initial={editing === "new" ? null : editing}
          defaultType={editing === "new" ? newType : undefined}
          cohorts={cohorts}
          mentees={mentees}
          onDone={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

export function JourneyContentAdmin() {
  const loadJourney = useServerFn(getJourneyEditor);
  const loadContents = useServerFn(getStageContents);
  const loadDirectory = useServerFn(getDirectory);
  const [pillarId, setPillarId] = useState<string>();
  const [selectedStep, setSelectedStep] = useState<JourneyDraftStep | null>(null);

  const journey = useQuery({
    queryKey: ["journey-content-structure", pillarId],
    queryFn: () => loadJourney({ data: pillarId ? { pillarId } : undefined }),
    ...liveJourneyQueryOptions,
  });
  const selectedPillarId = journey.data?.selected?.id;

  const contents = useQuery({
    queryKey: ["stage-contents", selectedPillarId],
    enabled: !!selectedPillarId,
    queryFn: () => loadContents({ data: { pillarId: selectedPillarId! } }),
    ...liveJourneyQueryOptions,
  });

  const directory = useQuery({
    queryKey: ["directory", "content-admin"],
    queryFn: () => loadDirectory(),
  });

  const cohorts = (directory.data?.cohorts ?? []).map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
  }));
  const mentees = (directory.data?.enrollments ?? []).map((enrollment) => ({
    id: enrollment.menteeId,
    name: enrollment.name,
  }));

  const byStep = useMemo(() => {
    const map = new Map<string, StageContentItem[]>();
    for (const item of contents.data?.items ?? []) {
      const list = map.get(item.stepKey) ?? [];
      list.push(item);
      map.set(item.stepKey, list);
    }
    return map;
  }, [contents.data?.items]);

  const steps = journey.data?.steps ?? [];

  return (
    <main className="inner-page">
      <div className="page-intro page-width">
        <span className="eyebrow eyebrow--gold">Conteúdos</span>
        <h1>Conteúdos da jornada</h1>
        <p>
          As etapas são um espelho da Minha jornada. Aqui você adiciona aulas, materiais e
          questionários e define quem recebe cada conteúdo.
        </p>
      </div>

      <section className="page-width ops-section">
        <label className="ops-field">
          <span>Pilar</span>
          <select
            value={journey.data?.selected?.id ?? ""}
            onChange={(event) => {
              setPillarId(event.target.value);
              setSelectedStep(null);
            }}
          >
            {(journey.data?.pillars ?? []).map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="page-width ops-section">
        <div className="section-heading">
          <div>
            <h2>Etapas</h2>
            <p>Clique em uma etapa para gerenciar os conteúdos vinculados a ela.</p>
          </div>
        </div>

        <div className="ops-list">
          {steps.map((step, index) => {
            const stageItems = byStep.get(step.stableKey) ?? [];
            const counts = {
              video: stageItems.filter((item) => item.contentType === "video").length,
              material: stageItems.filter((item) => item.contentType === "material").length,
              questionnaire: stageItems.filter((item) => item.contentType === "questionnaire")
                .length,
            };
            return (
              <article className="admin-card" key={step.stableKey}>
                <div className="section-heading">
                  <div>
                    <small className="ops-muted">
                      Etapa {index + 1} · Mês {step.monthNumber}
                    </small>
                    <strong>{step.title || "Etapa sem título"}</strong>
                    <p className="ops-muted">
                      {counts.video} aula(s) · {counts.material} material(is) ·{" "}
                      {counts.questionnaire} questionário(s)
                    </p>
                  </div>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => setSelectedStep(step)}
                  >
                    Gerenciar conteúdos
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {selectedStep && selectedPillarId ? (
        <StageContentManager
          pillarId={selectedPillarId}
          step={selectedStep}
          items={byStep.get(selectedStep.stableKey) ?? []}
          cohorts={cohorts}
          mentees={mentees}
          onClose={() => setSelectedStep(null)}
        />
      ) : null}
    </main>
  );
}
