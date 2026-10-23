import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Layers3,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getDirectory } from "@/lib/admin.functions";
import {
  filterStageContents,
  paginate,
  stageMatchesFilters,
  summarizeStageContent,
  type AudienceFilter,
  type ContentSort,
  type ContentTypeFilter,
} from "@/lib/content-admin";
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

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
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

function ContentPreview({
  item,
  cohorts,
  mentees,
  onClose,
}: {
  item: StageContentItem;
  cohorts: Array<{ id: string; name: string }>;
  mentees: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const Icon = typeIcon[item.contentType];
  const externalUrl = safeExternalUrl(item.externalUrl);
  return (
    <div className="modal-backdrop content-admin-preview" role="presentation">
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Visualizar ${item.title}`}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">Prévia do conteúdo</span>
          <div className="content-admin-preview__heading">
            <span className={`content-admin-type-icon is-${item.contentType}`}>
              <Icon size={22} />
            </span>
            <div>
              <small>{typeLabel[item.contentType]}</small>
              <h2>{item.title}</h2>
            </div>
          </div>
          <p>{item.description || "Este conteúdo ainda não possui descrição."}</p>
          <dl className="content-admin-preview__details">
            <div>
              <dt>Destinatário</dt>
              <dd>{audienceLabel(item, cohorts, mentees)}</dd>
            </div>
            {item.durationMinutes ? (
              <div>
                <dt>Duração</dt>
                <dd>{item.durationMinutes} min</dd>
              </div>
            ) : null}
            {item.contentType === "questionnaire" ? (
              <div>
                <dt>Perguntas</dt>
                <dd>{item.questionnaire.questions.length}</dd>
              </div>
            ) : null}
            {item.mediaPath || item.filePath ? (
              <div>
                <dt>Armazenamento</dt>
                <dd>Arquivo privado vinculado</dd>
              </div>
            ) : null}
          </dl>
          <div className="content-modal__actions">
            <button className="button button--glass" type="button" onClick={onClose}>
              Fechar
            </button>
            {externalUrl ? (
              <a
                className="button button--primary"
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} /> Abrir conteúdo
              </a>
            ) : null}
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
  onBack,
}: {
  pillarId: string;
  step: JourneyDraftStep;
  items: StageContentItem[];
  cohorts: Array<{ id: string; name: string }>;
  mentees: Array<{ id: string; name: string }>;
  onBack: () => void;
}) {
  const deleteFn = useServerFn(deleteStageContent);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<StageContentItem | null | "new">(null);
  const [previewing, setPreviewing] = useState<StageContentItem | null>(null);
  const [newType, setNewType] = useState<StageContentItem["contentType"]>("video");
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<ContentTypeFilter>("all");
  const [sort, setSort] = useState<ContentSort>("position");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const counts = useMemo(() => summarizeStageContent(items), [items]);
  const filtered = useMemo(
    () =>
      filterStageContents(items, {
        search,
        cohortId: cohortFilter,
        audience: audienceFilter,
        contentType: typeFilter,
        sort,
      }),
    [audienceFilter, cohortFilter, items, search, sort, typeFilter],
  );
  const paged = useMemo(() => paginate(filtered, page, 8), [filtered, page]);

  useEffect(() => {
    if (page !== paged.page) setPage(paged.page);
  }, [page, paged.page]);

  function updateFilter(update: () => void) {
    update();
    setPage(1);
  }

  function startNew(type: StageContentItem["contentType"]) {
    setNewType(type);
    setEditing("new");
  }

  function clearFilters() {
    setSearch("");
    setCohortFilter("all");
    setAudienceFilter("all");
    setTypeFilter("all");
    setSort("position");
    setPage(1);
  }

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

  const coverUrl = step.coverUrlDark ?? step.coverUrl ?? step.coverUrlLight ?? null;

  return (
    <div className="content-admin-detail">
      <button className="content-admin-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} /> Conteúdos da jornada
      </button>
      <header className="content-admin-detail__header">
        <div>
          <span className="eyebrow eyebrow--gold">Conteúdos / etapa</span>
          <h1>{step.title || "Etapa sem título"}</h1>
          <p>
            Gerencie aulas, materiais e questionários desta etapa e defina quem recebe cada
            conteúdo.
          </p>
        </div>
        <details className="content-admin-add">
          <summary className="button button--primary">
            <Plus size={18} /> Adicionar conteúdo
          </summary>
          <div className="content-admin-add__menu">
            {(["video", "material", "questionnaire"] as const).map((type) => {
              const Icon = typeIcon[type];
              return (
                <button key={type} type="button" onClick={() => startNew(type)}>
                  <Icon size={17} /> {typeLabel[type]}
                </button>
              );
            })}
          </div>
        </details>
      </header>

      <section className="content-admin-type-tabs" aria-label="Filtrar por tipo de conteúdo">
        {(["video", "material", "questionnaire"] as const).map((type) => {
          const Icon = typeIcon[type];
          return (
            <button
              className={typeFilter === type ? "is-active" : ""}
              key={type}
              type="button"
              onClick={() =>
                updateFilter(() => setTypeFilter((current) => (current === type ? "all" : type)))
              }
            >
              <Icon size={20} />
              <span>{typeLabel[type]}</span>
              <strong>{counts[type]}</strong>
            </button>
          );
        })}
        <div className="content-admin-total">
          <strong>{counts.total}</strong>
          <span>conteúdos</span>
        </div>
      </section>

      <section className="content-admin-filters content-admin-filters--detail">
        <label className="content-admin-search">
          <Search size={18} />
          <span className="sr-only">Buscar conteúdo</span>
          <input
            type="search"
            placeholder="Buscar conteúdo por título ou descrição"
            value={search}
            onChange={(event) => updateFilter(() => setSearch(event.target.value))}
          />
        </label>
        <label>
          <span>Turma</span>
          <select
            value={cohortFilter}
            onChange={(event) => updateFilter(() => setCohortFilter(event.target.value))}
          >
            <option value="all">Todas</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Destinatário</span>
          <select
            value={audienceFilter}
            onChange={(event) =>
              updateFilter(() => setAudienceFilter(event.target.value as AudienceFilter))
            }
          >
            <option value="all">Todos</option>
            <option value="general">Todos os mentorados</option>
            <option value="cohort">Turma específica</option>
            <option value="mentee">Mentorado específico</option>
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select
            value={typeFilter}
            onChange={(event) =>
              updateFilter(() => setTypeFilter(event.target.value as ContentTypeFilter))
            }
          >
            <option value="all">Todos</option>
            <option value="video">Aula gravada</option>
            <option value="material">Material de apoio</option>
            <option value="questionnaire">Questionário</option>
          </select>
        </label>
        <label>
          <span>Ordenar</span>
          <select
            value={sort}
            onChange={(event) => updateFilter(() => setSort(event.target.value as ContentSort))}
          >
            <option value="position">Ordem da jornada</option>
            <option value="title">Título</option>
            <option value="type">Tipo</option>
          </select>
        </label>
        <button className="content-admin-clear" type="button" onClick={clearFilters}>
          Limpar
        </button>
      </section>

      {paged.total ? (
        <>
          <div className="content-admin-table-wrap">
            <table className="content-admin-table">
              <thead>
                <tr>
                  <th>Conteúdo</th>
                  <th>Tipo</th>
                  <th>Turma / destinatário</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((item) => {
                  const Icon = typeIcon[item.contentType];
                  return (
                    <tr key={item.id}>
                      <td data-label="Conteúdo">
                        <div className="content-admin-title-cell">
                          <span className={`content-admin-thumb is-${item.contentType}`}>
                            {coverUrl && item.contentType === "video" ? (
                              <img src={coverUrl} alt="" />
                            ) : (
                              <Icon size={22} />
                            )}
                          </span>
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.description || "Sem descrição"}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Tipo">
                        <span className={`content-admin-type-chip is-${item.contentType}`}>
                          <Icon size={15} /> {typeLabel[item.contentType]}
                        </span>
                      </td>
                      <td data-label="Destinatário">
                        <span className="content-admin-audience">
                          <UsersRound size={16} />
                          <span>
                            <strong>{audienceLabel(item, cohorts, mentees)}</strong>
                            <small>
                              {item.accessScope === "general"
                                ? "Todos os acessos ativos"
                                : item.accessScope === "cohort"
                                  ? "Somente esta turma"
                                  : "Somente este mentorado"}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td data-label="Ações">
                        <div className="content-admin-actions">
                          <button type="button" onClick={() => setPreviewing(item)}>
                            <Eye size={15} /> Visualizar
                          </button>
                          <button type="button" onClick={() => setEditing(item)}>
                            <Pencil size={15} /> Editar
                          </button>
                          <button
                            className="is-danger"
                            type="button"
                            onClick={() => void remove(item)}
                          >
                            <Trash2 size={15} /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className="content-admin-pagination">
            <span>
              Exibindo {(paged.page - 1) * 8 + 1} a {Math.min(paged.page * 8, paged.total)} de{" "}
              {paged.total} conteúdos
            </span>
            <div>
              <button
                type="button"
                disabled={paged.page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <strong>{paged.page}</strong>
              <button
                type="button"
                disabled={paged.page === paged.pageCount}
                onClick={() => setPage((current) => Math.min(paged.pageCount, current + 1))}
                aria-label="Próxima página"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        </>
      ) : (
        <div className="content-admin-empty">
          <Layers3 size={34} />
          <h2>{items.length ? "Nenhum conteúdo encontrado" : "Esta etapa ainda está vazia"}</h2>
          <p>
            {items.length
              ? "Ajuste ou limpe os filtros para visualizar outros conteúdos."
              : "Adicione a primeira aula, material ou questionário desta etapa."}
          </p>
          {items.length ? (
            <button className="button button--glass" type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          ) : (
            <button
              className="button button--primary"
              type="button"
              onClick={() => startNew("video")}
            >
              <Plus size={16} /> Adicionar conteúdo
            </button>
          )}
        </div>
      )}

      {message ? <p className="form-message">{message}</p> : null}

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
      {previewing ? (
        <ContentPreview
          item={previewing}
          cohorts={cohorts}
          mentees={mentees}
          onClose={() => setPreviewing(null)}
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
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [page, setPage] = useState(1);

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

  const steps = useMemo(() => journey.data?.steps ?? [], [journey.data?.steps]);
  const filteredSteps = useMemo(
    () =>
      steps.filter((step) =>
        stageMatchesFilters(step.title, byStep.get(step.stableKey) ?? [], {
          search,
          cohortId: cohortFilter,
          audience: audienceFilter,
        }),
      ),
    [audienceFilter, byStep, cohortFilter, search, steps],
  );
  const pagedSteps = useMemo(() => paginate(filteredSteps, page, 8), [filteredSteps, page]);

  useEffect(() => {
    if (page !== pagedSteps.page) setPage(pagedSteps.page);
  }, [page, pagedSteps.page]);

  function clearFilters() {
    setSearch("");
    setCohortFilter("all");
    setAudienceFilter("all");
    setPage(1);
  }

  if (selectedStep && selectedPillarId) {
    return (
      <main className="inner-page content-admin-page">
        <div className="page-width">
          <StageContentManager
            pillarId={selectedPillarId}
            step={selectedStep}
            items={byStep.get(selectedStep.stableKey) ?? []}
            cohorts={cohorts}
            mentees={mentees}
            onBack={() => setSelectedStep(null)}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="inner-page content-admin-page">
      <div className="page-intro page-width">
        <span className="eyebrow eyebrow--gold">Conteúdos / gerenciamento</span>
        <h1>Conteúdos da jornada</h1>
        <p>Organize aulas, materiais e questionários para cada etapa, turma ou mentorado.</p>
      </div>

      <section className="page-width content-admin-filters">
        <label className="content-admin-search">
          <Search size={18} />
          <span className="sr-only">Buscar etapa ou conteúdo</span>
          <input
            type="search"
            placeholder="Buscar etapa, aula ou material"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span>Pilar</span>
          <select
            value={journey.data?.selected?.id ?? ""}
            onChange={(event) => {
              setPillarId(event.target.value);
              setSelectedStep(null);
              setPage(1);
            }}
          >
            {(journey.data?.pillars ?? []).map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Turma</span>
          <select
            value={cohortFilter}
            onChange={(event) => {
              setCohortFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todas</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Público</span>
          <select
            value={audienceFilter}
            onChange={(event) => {
              setAudienceFilter(event.target.value as AudienceFilter);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            <option value="general">Todos os mentorados</option>
            <option value="cohort">Turma específica</option>
            <option value="mentee">Mentorado específico</option>
          </select>
        </label>
        <button className="content-admin-clear" type="button" onClick={clearFilters}>
          Limpar
        </button>
      </section>

      <section className="page-width content-admin-stages">
        <div className="content-admin-stages__heading">
          <div>
            <h2>Etapas</h2>
            <p>Acesse uma etapa para gerenciar seus conteúdos e destinatários.</p>
          </div>
          <span>{filteredSteps.length} etapas nesta visualização</span>
        </div>

        {journey.isLoading || contents.isLoading ? (
          <div className="content-admin-loading" role="status">
            <span /> Carregando conteúdos da jornada…
          </div>
        ) : journey.isError || contents.isError ? (
          <div className="content-admin-empty">
            <Layers3 size={34} />
            <h2>Não foi possível carregar os conteúdos</h2>
            <p>Atualize a página. Se o problema continuar, verifique sua conexão.</p>
          </div>
        ) : pagedSteps.total ? (
          <div className="content-admin-stage-list">
            {pagedSteps.items.map((step) => {
              const index = steps.findIndex((item) => item.stableKey === step.stableKey);
              const stageItems = byStep.get(step.stableKey) ?? [];
              const counts = summarizeStageContent(stageItems);
              const Icon = counts.video
                ? Play
                : counts.material
                  ? FileText
                  : counts.questionnaire
                    ? BookOpen
                    : Layers3;
              return (
                <article className="content-admin-stage-row" key={step.stableKey}>
                  <span className="content-admin-stage-row__icon">
                    <Icon size={24} />
                  </span>
                  <div className="content-admin-stage-row__copy">
                    <strong>{step.title || "Etapa sem título"}</strong>
                    <p>
                      Etapa {index + 1} · Mês {step.monthNumber}
                      <i /> {counts.video} {counts.video === 1 ? "aula" : "aulas"} <i />{" "}
                      {counts.material} {counts.material === 1 ? "material" : "materiais"} <i />{" "}
                      {counts.questionnaire}{" "}
                      {counts.questionnaire === 1 ? "questionário" : "questionários"}
                    </p>
                  </div>
                  <span className="content-admin-stage-row__count">
                    {counts.total} {counts.total === 1 ? "conteúdo" : "conteúdos"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStep(step);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Gerenciar <ChevronRight size={18} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="content-admin-empty">
            <Layers3 size={34} />
            <h2>Nenhuma etapa encontrada</h2>
            <p>Limpe os filtros ou tente outra busca.</p>
            <button className="button button--glass" type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
        )}

        {pagedSteps.total ? (
          <footer className="content-admin-pagination">
            <span>
              Exibindo {(pagedSteps.page - 1) * 8 + 1} a{" "}
              {Math.min(pagedSteps.page * 8, pagedSteps.total)} de {pagedSteps.total} etapas
            </span>
            <div>
              <button
                type="button"
                disabled={pagedSteps.page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <strong>{pagedSteps.page}</strong>
              <button
                type="button"
                disabled={pagedSteps.page === pagedSteps.pageCount}
                onClick={() => setPage((current) => Math.min(pagedSteps.pageCount, current + 1))}
                aria-label="Próxima página"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        ) : null}
      </section>
    </main>
  );
}
