import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { NextStepHero } from "@/components/journey-next-step";
import { supabase } from "@/integrations/supabase/client";
import { getDirectory } from "@/lib/admin.functions";
import { createJourneyUpload } from "@/lib/content.functions";
import { uploadLessonToR2 } from "@/lib/r2-worker";
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
  collective_recording: "Encontro coletivo gravado",
  cohort_onboarding: "Onboarding por turma",
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
    monthNumber: 1,
    coverPath: null,
    coverUrl: null,
    coverPathLight: null,
    coverUrlLight: null,
    coverPathDark: null,
    coverUrlDark: null,
    mediaPath: null,
    summary: "",
    topics: [],
    materials: [],
    accessScope: "general",
    cohortId: null,
    menteeId: null,
  };
}

function toLocal(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function draftStepSignature(step: JourneyDraftStep) {
  const {
    coverUrl: _coverUrl,
    coverUrlLight: _coverUrlLight,
    coverUrlDark: _coverUrlDark,
    ...stableFields
  } = step;
  return JSON.stringify(stableFields);
}

function StepForm({
  initial,
  cohorts,
  mentees,
  onSave,
  onClose,
}: {
  initial: JourneyDraftStep;
  cohorts: Array<{ id: string; name: string }>;
  mentees: Array<{ id: string; name: string }>;
  onSave: (step: JourneyDraftStep) => void;
  onClose: () => void;
}) {
  const createUpload = useServerFn(createJourneyUpload);
  const [step, setStep] = useState(initial);
  const [uploading, setUploading] = useState<
    "" | "cover-light" | "cover-dark" | "media" | "material"
  >("");
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [removedCovers, setRemovedCovers] = useState({ light: false, dark: false });
  const previewObjects = useRef<{ light: string | null; dark: string | null }>({
    light: null,
    dark: null,
  });
  const update = <K extends keyof JourneyDraftStep>(key: K, value: JourneyDraftStep[K]) =>
    setStep((current) => ({ ...current, [key]: value }));
  const showMeeting = step.format === "live_group" || step.format === "individual_1_1";
  const showVideo = [
    "recorded_class",
    "collective_recording",
    "cohort_onboarding",
    "individual_1_1",
  ].includes(step.format);
  const showDuration = showMeeting || showVideo;
  const lightCoverUrl = removedCovers.light
    ? null
    : (step.coverUrlLight ?? (!step.coverUrlDark ? (step.coverUrl ?? null) : null));
  const darkCoverUrl = removedCovers.dark
    ? null
    : (step.coverUrlDark ?? (!step.coverUrlLight ? (step.coverUrl ?? null) : null));

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
          : ["recorded_class", "collective_recording", "cohort_onboarding"].includes(format)
            ? "player_ended"
            : "mentor_confirmation",
    }));
  }

  async function upload(
    file: File,
    kind: "cover-light" | "cover-dark" | "media" | "material",
  ) {
    setUploading(kind);
    setUploadError("");
    try {
      if (kind === "media") {
        setUploadProgress(0);
        const mediaPath = await uploadLessonToR2(file, (uploadedBytes, totalBytes) => {
          const percentage =
            totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
          setUploadProgress(Math.max(0, Math.min(100, percentage)));
        });
        setStep((current) => ({
          ...current,
          mediaPath,
          resourceType: "r2",
          resourceUrl: null,
        }));
        return;
      }

      const signed = await createUpload({
        data: {
          kind: kind === "cover-light" || kind === "cover-dark" ? "cover" : kind,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        },
      });

      const { error } = await supabase.storage
        .from("journey-content")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw error;
      if (kind === "cover-light" || kind === "cover-dark") {
        const theme = kind === "cover-light" ? "light" : "dark";
        const previous = previewObjects.current[theme];
        if (previous) URL.revokeObjectURL(previous);
        const preview = URL.createObjectURL(file);
        previewObjects.current[theme] = preview;
        setRemovedCovers((current) => ({ ...current, [theme]: false }));
        setStep((current) =>
          theme === "light"
            ? {
                ...current,
                coverPathLight: signed.path,
                coverUrlLight: preview,
                coverPath: current.coverPath ?? signed.path,
                coverUrl: current.coverUrl ?? preview,
              }
            : {
                ...current,
                coverPathDark: signed.path,
                coverUrlDark: preview,
                coverPath: current.coverPath ?? signed.path,
                coverUrl: current.coverUrl ?? preview,
              },
        );
      } else {
        setStep((current) => ({
          ...current,
          materials: [
            ...current.materials,
            {
              id: crypto.randomUUID(),
              title: file.name,
              url: null,
              filePath: signed.path,
            },
          ],
        }));
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    } finally {
      if (kind === "media") setUploadProgress(null);
      setUploading("");
    }
  }

  function removeAsset(kind: "cover-light" | "cover-dark" | "media") {
    if (kind === "cover-light") {
      setRemovedCovers((current) => ({ ...current, light: true }));
      if (previewObjects.current.light) {
        URL.revokeObjectURL(previewObjects.current.light);
        previewObjects.current.light = null;
      }
      setStep((current) => {
        const removedPath = current.coverPathLight;
        const legacyWasRemoved = !!removedPath && current.coverPath === removedPath;
        return {
          ...current,
          coverPathLight: null,
          coverUrlLight: null,
          coverPath: legacyWasRemoved ? (current.coverPathDark ?? null) : current.coverPath,
          coverUrl: legacyWasRemoved ? (current.coverUrlDark ?? null) : current.coverUrl,
        };
      });
    } else if (kind === "cover-dark") {
      setRemovedCovers((current) => ({ ...current, dark: true }));
      if (previewObjects.current.dark) {
        URL.revokeObjectURL(previewObjects.current.dark);
        previewObjects.current.dark = null;
      }
      setStep((current) => {
        const removedPath = current.coverPathDark;
        const legacyWasRemoved = !!removedPath && current.coverPath === removedPath;
        return {
          ...current,
          coverPathDark: null,
          coverUrlDark: null,
          coverPath: legacyWasRemoved ? (current.coverPathLight ?? null) : current.coverPath,
          coverUrl: legacyWasRemoved ? (current.coverUrlLight ?? null) : current.coverUrl,
        };
      });
    } else {
      setStep((current) => ({ ...current, mediaPath: null, resourceType: null }));
    }
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
          <label>
            <span>Pilar / mês</span>
            <select
              value={step.monthNumber}
              onChange={(e) => update("monthNumber", Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((month) => (
                <option key={month} value={month}>
                  Mês {month}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset className="journey-cover-fieldset">
          <legend>Capas do card</legend>
          <p className="journey-field-help">
            Cadastre uma arte para cada tema. A plataforma exibe automaticamente a capa correspondente
            ao tema claro ou escuro escolhido por mentorados e mentoras. PNG, JPG ou WebP.
          </p>

          <div className="journey-theme-cover">
            <div className="journey-theme-cover__head">
              <strong>Tema claro</strong>
              <span>Usada quando a plataforma estiver no tema claro</span>
            </div>
            {lightCoverUrl ? (
              <div className="journey-cover-preview">
                <img
                  src={lightCoverUrl}
                  alt={`Prévia da capa clara de ${step.title || "etapa"}`}
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeAsset("cover-light");
                  }}
                  disabled={uploading !== ""}
                >
                  Remover capa clara
                </button>
              </div>
            ) : null}
            <label className="journey-upload">
              <ImagePlus size={18} />
              <span>
                {uploading === "cover-light"
                  ? "Enviando capa clara…"
                  : "Selecionar ou substituir capa clara"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading !== ""}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file, "cover-light");
                }}
              />
            </label>
          </div>

          <div className="journey-theme-cover">
            <div className="journey-theme-cover__head">
              <strong>Tema escuro</strong>
              <span>Usada quando a plataforma estiver no tema escuro</span>
            </div>
            {darkCoverUrl ? (
              <div className="journey-cover-preview">
                <img
                  src={darkCoverUrl}
                  alt={`Prévia da capa escura de ${step.title || "etapa"}`}
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeAsset("cover-dark");
                  }}
                  disabled={uploading !== ""}
                >
                  Remover capa escura
                </button>
              </div>
            ) : null}
            <label className="journey-upload">
              <ImagePlus size={18} />
              <span>
                {uploading === "cover-dark"
                  ? "Enviando capa escura…"
                  : "Selecionar ou substituir capa escura"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading !== ""}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file, "cover-dark");
                }}
              />
            </label>
          </div>
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
          <label>
            <span>Resumo executivo</span>
            <textarea
              value={step.summary}
              onChange={(e) => update("summary", e.target.value)}
              maxLength={4000}
              rows={5}
              placeholder="Resumo exibido abaixo do vídeo"
            />
          </label>
          <label>
            <span>Principais temas</span>
            <textarea
              value={step.topics.join("\n")}
              onChange={(e) =>
                update(
                  "topics",
                  e.target.value
                    .split("\n")
                    .map((topic) => topic.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                )
              }
              rows={5}
              placeholder="Um tema por linha"
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
          {step.format === "questionnaire" || step.format === "form" ? (
            <label>
              <span>URL do questionário</span>
              <input
                type="url"
                value={step.resourceUrl ?? ""}
                onChange={(e) => update("resourceUrl", e.target.value || null)}
                placeholder="https://"
              />
            </label>
          ) : showVideo ? (
            <div className="journey-upload-group">
              <label className="journey-upload">
                <Plus size={18} />
                <span>
                  {uploading === "media"
                    ? `Enviando aula para Cloudflare… ${uploadProgress ?? 0}%`
                    : step.mediaPath?.startsWith("r2:")
                      ? "Substituir vídeo no Cloudflare R2"
                      : "Enviar vídeo para Cloudflare R2"}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  disabled={uploading !== ""}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file, "media");
                  }}
                />
              </label>
              {uploading === "media" && uploadProgress !== null ? (
                <div
                  className="journey-upload-progress"
                  role="progressbar"
                  aria-label="Progresso do envio da aula"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                >
                  <span style={{ width: `${uploadProgress}%` }} />
                  <small>{uploadProgress}% enviado</small>
                </div>
              ) : null}
              {step.mediaPath?.startsWith("r2:") ? (
                <div className="journey-uploaded-file">
                  <span>Vídeo privado armazenado no Cloudflare R2</span>
                  <button type="button" onClick={() => removeAsset("media")} disabled={uploading !== ""}>
                    Remover vídeo
                  </button>
                </div>
              ) : null}
              <p className="journey-field-help">
                A aula fica no bucket privado da RISE. O mentorado recebe acesso temporário somente
                depois que a plataforma valida a permissão dele para esta etapa.
              </p>
              <label>
                <span>URL externa alternativa (opcional)</span>
                <input
                  type="url"
                  value={step.resourceUrl ?? ""}
                  onChange={(e) => update("resourceUrl", e.target.value || null)}
                  placeholder="https://"
                />
              </label>
            </div>
          ) : (
            <p className="journey-field-help">
              Questionários abrem dentro da plataforma.
            </p>
          )}
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

        <fieldset>
          <legend>Materiais de apoio</legend>
          <label className="journey-upload">
            <Plus size={18} />
            <span>{uploading === "material" ? "Enviando material…" : "Adicionar arquivo"}</span>
            <input
              type="file"
              disabled={uploading !== ""}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file, "material");
              }}
            />
          </label>
          <button
            className="journey-add-link"
            type="button"
            onClick={() =>
              update("materials", [
                ...step.materials,
                { id: crypto.randomUUID(), title: "Novo link", url: "https://", filePath: null },
              ])
            }
          >
            <Plus size={16} /> Adicionar link
          </button>
          <div className="journey-material-editor">
            {step.materials.map((material, index) => (
              <div key={material.id}>
                <input
                  aria-label={`Título do material ${index + 1}`}
                  value={material.title}
                  onChange={(event) =>
                    update(
                      "materials",
                      step.materials.map((item) =>
                        item.id === material.id ? { ...item, title: event.target.value } : item,
                      ),
                    )
                  }
                />
                {material.url !== null ? (
                  <input
                    type="url"
                    aria-label={`URL do material ${index + 1}`}
                    value={material.url}
                    onChange={(event) =>
                      update(
                        "materials",
                        step.materials.map((item) =>
                          item.id === material.id ? { ...item, url: event.target.value } : item,
                        ),
                      )
                    }
                  />
                ) : (
                  <span>Arquivo privado</span>
                )}
                <button
                  type="button"
                  aria-label={`Remover ${material.title}`}
                  onClick={() =>
                    update(
                      "materials",
                      step.materials.filter((item) => item.id !== material.id),
                    )
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          {uploadError ? <p className="journey-upload-error">{uploadError}</p> : null}
        </fieldset>

        <details>
          <summary>Percurso e regras avançadas</summary>
          <div className="journey-editor-form__details">
            <label>
              <span>Visibilidade</span>
              <select
                value={step.accessScope}
                onChange={(e) => {
                  const accessScope = e.target.value as JourneyDraftStep["accessScope"];
                  setStep((current) => ({
                    ...current,
                    accessScope,
                    cohortId: accessScope === "cohort" ? current.cohortId : null,
                    menteeId: accessScope === "mentee" ? current.menteeId : null,
                  }));
                }}
              >
                <option value="general">Geral para mentorados autorizados</option>
                <option value="cohort">Turma específica</option>
                <option value="mentee">Mentorado específico</option>
              </select>
            </label>
            {step.accessScope === "cohort" ? (
              <label>
                <span>Turma autorizada</span>
                <select
                  value={step.cohortId ?? ""}
                  onChange={(e) => update("cohortId", e.target.value || null)}
                  required
                >
                  <option value="">Selecione a turma</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {step.accessScope === "mentee" ? (
              <label>
                <span>Mentorado autorizado</span>
                <select
                  value={step.menteeId ?? ""}
                  onChange={(e) => update("menteeId", e.target.value || null)}
                  required
                >
                  <option value="">Selecione o mentorado</option>
                  {mentees.map((mentee) => (
                    <option key={mentee.id} value={mentee.id}>
                      {mentee.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
  const loadDirectory = useServerFn(getDirectory);
  const save = useServerFn(saveJourneyDraft);
  const publish = useServerFn(publishJourneyDraft);
  const confirm = useServerFn(confirmJourneyStep);
  const qc = useQueryClient();
  const [pillarId, setPillarId] = useState<string>();
  const query = useQuery({
    queryKey: ["journey-editor", pillarId],
    queryFn: () => load({ data: pillarId ? { pillarId } : undefined }),
  });
  const directoryQuery = useQuery({
    queryKey: ["directory", "journey-content"],
    queryFn: () => loadDirectory(),
  });
  const [localSteps, setLocalSteps] = useState<JourneyDraftStep[] | null>(null);
  const [editing, setEditing] = useState<JourneyDraftStep | null>(null);
  const [preview, setPreview] = useState<JourneyDraftStep | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [applyActive, setApplyActive] = useState(true);
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
            ...(data?.selected?.name ? { pillarName: data.selected.name } : {}),
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
    if (!item) return;
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

  function getStepStatus(step: JourneyDraftStep) {
    if (step.releaseAt && new Date(step.releaseAt).getTime() > Date.now()) return "Agendado";
    const original = data?.steps.find((item) => item.stableKey === step.stableKey);
    const unchangedLocally = !original || draftStepSignature(original) === draftStepSignature(step);
    return unchangedLocally && (data?.publishedStepKeys ?? []).includes(step.stableKey)
      ? "Publicado"
      : "Rascunho";
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
      setApplyActive(true);
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
        <h1>Gestão de conteúdos</h1>
        <p>Organize etapas, capas, aulas, questionários e públicos sem editar código.</p>
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
        <div className="journey-editor-toolbar__actions">
          <button
            className="button button--glass"
            type="button"
            onClick={() => setEditing(emptyStep())}
            disabled={!data?.selected}
          >
            <Plus size={18} /> Adicionar etapa
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={busy !== "" || !steps.length}
          >
            <Send size={17} /> Publicar este pilar
          </button>
        </div>
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
                  {step.resourceUrl || step.resourceId || step.mediaPath
                    ? `Mês ${step.monthNumber} · Recurso vinculado`
                    : `Mês ${step.monthNumber} · Aguardando recurso`}
                </span>
              </div>
              <span
                className={`journey-step-row__status journey-step-row__status--${getStepStatus(step).toLowerCase()}`}
              >
                {getStepStatus(step)}
              </span>
              <div className="journey-step-row__actions">
                <button
                  type="button"
                  onClick={() => {
                    const copy = {
                      ...step,
                      stableKey: crypto.randomUUID(),
                      title: `${step.title}, cópia`,
                    };
                    const next = [...steps];
                    next.splice(index + 1, 0, copy);
                    setLocalSteps(next);
                  }}
                  aria-label={`Duplicar ${step.title}`}
                >
                  <Copy size={17} />
                </button>
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
                  aria-label={`Visualizar ${step.title}`}
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
            <Eye size={17} /> Visualizar
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
            {(data?.confirmations ?? []).map((item) => {
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
        <StepForm
          initial={editing}
          cohorts={(directoryQuery.data?.cohorts ?? []).map((cohort) => ({
            id: cohort.id,
            name: cohort.name,
          }))}
          mentees={(directoryQuery.data?.enrollments ?? []).map((enrollment) => ({
            id: enrollment.menteeId,
            name: enrollment.name,
          }))}
          onSave={upsert}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {previewStep ? (
        <div
          className="journey-preview"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização prévia"
        >
          <button
            className="journey-preview__close"
            type="button"
            onClick={() => setPreview(null)}
            aria-label="Fechar visualização"
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
