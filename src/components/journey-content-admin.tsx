import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  ImagePlus,
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
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { RecordedPlayer } from "@/components/recorded-lessons";
import { GoogleDriveCard } from "@/components/google-drive-card";
import { QuestionnaireEditor } from "@/components/questionnaire-editor";
import { confirmProtectedOperation } from "@/lib/protected-dialog";
import { readLocalVideoDuration, videoDurationLabel } from "@/lib/video-duration";
import { driveFileId } from "../../supabase/functions/_shared/video-media";

import { supabase } from "@/integrations/supabase/client";
import { getDirectory } from "@/lib/admin.functions";
import {
  filterStageContents,
  groupByModule,
  moduleNames,
  moveModule,
  moveWithinModule,
  paginate,
  placeInModule,
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
  getMentorContentOverview,
  inspectStageVideo,
  getStageVideoPlayback,
  getStageVideoEngagement,
  updateStageVideoMetadata,
  saveStageContent,
  orderStageContents,
  renameStageModule,
  assignStageModule,
  type StageContentItem,
  type StageQuestion,
} from "@/lib/content.functions";
import { getJourneyEditor, type JourneyDraftStep } from "@/lib/journey.functions";
import { invalidateJourneyData, liveJourneyQueryOptions } from "@/lib/journey-sync";
import { prepareJourneyCover } from "@/lib/prepare-journey-cover";
import { uploadLessonToR2, getR2PlaybackUrl } from "@/lib/r2-worker";

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
    return mentees.find((m) => m.id === item.menteeId)?.name ?? "Participante específico";
  return "Todas as pessoas";
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

const NEW_MODULE = "__novo_modulo__";

const TYPE_CARDS: Array<{ id: StageContentItem["contentType"]; description: string }> = [
  { id: "video", description: "Vídeo com capa, resumo e temas" },
  { id: "questionnaire", description: "Perguntas na sequência da etapa" },
  { id: "material", description: "PDF, planilha ou link para baixar" },
];

const shortTitle = (value: string) =>
  value.length > 48 ? value.slice(0, 46).trimEnd() + "…" : value;

function ContentForm({
  pillarId,
  step,
  initial,
  defaultType,
  nextPosition = 0,
  cohorts,
  mentees,
  modules = [],
  defaultModule = "",
  stageItems = [],
  onDone,
}: {
  pillarId: string;
  step: JourneyDraftStep;
  initial: StageContentItem | null;
  defaultType?: StageContentItem["contentType"] | undefined;
  nextPosition?: number;
  cohorts: Array<{ id: string; name: string }>;
  mentees: Array<{ id: string; name: string }>;
  modules?: string[];
  defaultModule?: string;
  /** Todos os conteúdos da etapa (posição na etapa e material ligado a uma aula). */
  stageItems?: StageContentItem[];
  onDone: () => void;
}) {
  const saveFn = useServerFn(saveStageContent);
  const inspectVideo = useServerFn(inspectStageVideo);
  const createUpload = useServerFn(createJourneyUpload);
  const qc = useQueryClient();

  const [contentType, setContentType] = useState<StageContentItem["contentType"]>(
    initial?.contentType ?? defaultType ?? "video",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [moduleTitle, setModuleTitle] = useState(initial?.moduleTitle ?? defaultModule);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [lessonId, setLessonId] = useState(initial?.lessonId ?? "");
  const [reflectionPrompt, setReflectionPrompt] = useState(initial?.reflectionPrompt ?? "");
  const [coverPath, setCoverPath] = useState<string | null>(initial?.coverPath ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.coverUrl ?? null);
  const [coverUploading, setCoverUploading] = useState(false);
  const reorderFn = useServerFn(orderStageContents);
  const lessons = stageItems.filter((entry) => entry.contentType === "video");
  const [topics, setTopics] = useState<string[]>(initial?.topics ?? []);
  const [topicDraft, setTopicDraft] = useState("");
  const [creatingModule, setCreatingModule] = useState(
    !!moduleTitle && !modules.includes(moduleTitle),
  );
  const [placement, setPlacement] = useState(initial ? "keep" : "end");
  const [linkMode, setLinkMode] = useState(!!initial?.externalUrl);
  const [dragging, setDragging] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const moduleKey = moduleTitle.replace(/\s+/g, " ").trim();
  const siblings =
    groupByModule(stageItems.filter((entry) => entry.id !== initial?.id)).find(
      (group) => group.title === moduleKey,
    )?.items ?? [];

  function addTopic() {
    const topic = topicDraft.replace(/\s+/g, " ").replace(/,$/, "").trim();
    if (!topic) return setTopicDraft("");
    setTopics((current) =>
      current.some((entry) => entry.toLowerCase() === topic.toLowerCase()) || current.length >= 12
        ? current
        : [...current, topic],
    );
    setTopicDraft("");
  }

  async function uploadCover(file: File) {
    setCoverUploading(true);
    setMessage("");
    try {
      const prepared = await prepareJourneyCover(file);
      const signed = await createUpload({
        data: {
          kind: "cover",
          fileName: prepared.name,
          contentType: prepared.type || "application/octet-stream",
          size: prepared.size,
        },
      });
      const { error } = await supabase.storage
        .from("journey-content")
        .uploadToSignedUrl(signed.path, signed.token, prepared, {
          contentType: prepared.type,
          cacheControl: "31536000",
        });
      if (error) throw error;
      setCoverPath(signed.path);
      setCoverPreview(URL.createObjectURL(prepared));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a capa.");
    } finally {
      setCoverUploading(false);
    }
  }
  const [duration, setDuration] = useState(
    initial?.durationMinutes ? String(initial.durationMinutes) : "",
  );
  const [durationSeconds, setDurationSeconds] = useState<number | null>(
    initial?.durationSeconds ?? null,
  );
  const [detectingDuration, setDetectingDuration] = useState(false);
  const [mediaPath, setMediaPath] = useState(initial?.mediaPath ?? null);
  const [filePath, setFilePath] = useState(initial?.filePath ?? null);
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? "");
  const [accessScope, setAccessScope] = useState<StageContentItem["accessScope"]>(
    initial?.accessScope ?? "general",
  );
  const [cohortId, setCohortId] = useState(initial?.cohortId ?? "");
  const [menteeId, setMenteeId] = useState(initial?.menteeId ?? "");
  const [questions, setQuestions] = useState<StageQuestion[]>(() =>
    initial?.questionnaire?.questions?.length ? initial.questionnaire.questions : [newQuestion()],
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDetectingDuration(false);
    if (contentType !== "video" || !driveFileId(externalUrl)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setDetectingDuration(true);
      void inspectVideo({ data: { sourceUrl: externalUrl } })
        .then((result) => {
          if (!active) return;
          setDurationSeconds(result.durationSeconds);
          if (result.durationSeconds) setDuration(String(Math.ceil(result.durationSeconds / 60)));
        })
        .catch((error) => {
          if (active)
            setMessage(
              error instanceof Error ? error.message : "Não foi possível detectar a duração.",
            );
        })
        .finally(() => {
          if (active) setDetectingDuration(false);
        });
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [contentType, externalUrl, inspectVideo]);

  async function uploadVideo(file: File) {
    setUploadName(file.name);
    setLinkMode(false);
    setUploading(true);
    setMessage("");
    setProgress(0);
    const metadata = readLocalVideoDuration(file);
    try {
      const path = await uploadLessonToR2(file, (done, total) => {
        setProgress(total > 0 ? Math.round((done / total) * 100) : 0);
      });
      setMediaPath(path);
      setExternalUrl("");
      const seconds = await metadata;
      setDurationSeconds(seconds);
      setDuration(seconds ? String(Math.ceil(seconds / 60)) : "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a aula.");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function uploadMaterial(file: File) {
    setUploadName(file.name);
    setLinkMode(false);
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
    if (accessScope === "mentee" && !menteeId)
      return setMessage("Selecione a pessoa participante.");

    if (contentType === "video" && !mediaPath && !externalUrl.trim())
      return setMessage("Envie a aula ou informe uma URL externa.");
    if (contentType === "material" && !filePath && !externalUrl.trim())
      return setMessage("Envie um arquivo ou informe um link.");
    if (contentType === "questionnaire" && !questions.some((question) => question.prompt.trim()))
      return setMessage("Adicione pelo menos uma pergunta.");

    setBusy(true);
    try {
      const result = await saveFn({
        data: {
          id: initial?.id,
          pillarId,
          stepKey: step.stableKey,
          contentType,
          title: cleanTitle,
          description,
          durationMinutes: duration ? Number(duration) : null,
          durationSeconds,
          mediaPath,
          filePath,
          externalUrl: externalUrl.trim() || null,
          accessScope,
          cohortId: accessScope === "cohort" ? cohortId : null,
          menteeId: accessScope === "mentee" ? menteeId : null,
          questionnaire: { questions },
          moduleTitle: moduleTitle.replace(/\s+/g, " ").trim() || null,
          ...(contentType === "video"
            ? {
                topics,
                reflectionPrompt: reflectionPrompt.trim() || null,
                coverPath,
              }
            : {}),
          ...(contentType === "material" ? { lessonId: lessonId || null } : {}),
          position: initial?.position ?? nextPosition,
          active: true,
        },
      });

      const saved = result?.item as StageContentItem | undefined;
      if (saved && placement !== "keep") {
        const current = [
          ...stageItems.map((entry) => (entry.id === saved.id ? saved : entry)),
          ...(stageItems.some((entry) => entry.id === saved.id) ? [] : [saved]),
        ];
        const expected = [...current]
          .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
          .map((entry) => entry.id);
        const ids = placeInModule(
          current,
          saved.id,
          placement === "start" || placement === "end"
            ? placement
            : { after: placement.replace(/^after:/, "") },
        );
        if (ids && ids.join() !== expected.join()) {
          try {
            await reorderFn({
              data: { pillarId, stepKey: step.stableKey, expectedIds: expected, ids },
            });
          } catch {
            await invalidateJourneyData(qc);
            setMessage(
              "Conteúdo salvo, mas não foi possível ajustar a posição. Use as setas da lista.",
            );
            return;
          }
        }
      }
      await invalidateJourneyData(qc);
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  if (contentType === "questionnaire") {
    return (
      <QuestionnaireEditor
        value={{ title, description, accessScope, cohortId, menteeId, questions }}
        onChange={(patch) => {
          if (patch.title !== undefined) setTitle(patch.title);
          if (patch.description !== undefined) setDescription(patch.description);
          if (patch.accessScope !== undefined) setAccessScope(patch.accessScope);
          if (patch.cohortId !== undefined) setCohortId(patch.cohortId ?? "");
          if (patch.menteeId !== undefined) setMenteeId(patch.menteeId ?? "");
          if (patch.questions !== undefined) setQuestions(patch.questions);
        }}
        stepTitle={step.title}
        editing={!!initial}
        cohorts={cohorts}
        mentees={mentees}
        busy={busy}
        message={message}
        onSave={() => void save()}
        onClose={onDone}
      />
    );
  }

  const isVideo = contentType === "video";
  const hasTitle = title.trim().length > 0;
  const videoReady = !!mediaPath || !!externalUrl.trim();
  const fileReady = !!filePath || !!externalUrl.trim();
  const checks = isVideo
    ? [
        {
          ok: videoReady && !uploading,
          optional: false,
          label: uploading
            ? `Vídeo enviando… ${progress ?? 0}%`
            : videoReady
              ? "Vídeo enviado"
              : "Falta o vídeo",
        },
        { ok: hasTitle, optional: false, label: hasTitle ? "Título" : "Falta o título" },
        { ok: !!coverPath, optional: true, label: coverPath ? "Capa" : "Capa (opcional)" },
      ]
    : [
        {
          ok: fileReady && !uploading,
          optional: false,
          label: uploading
            ? "Arquivo enviando…"
            : fileReady
              ? "Arquivo ou link"
              : "Falta o arquivo",
        },
        { ok: hasTitle, optional: false, label: hasTitle ? "Título" : "Falta o título" },
      ];
  const canSave =
    !busy &&
    !uploading &&
    !coverUploading &&
    !detectingDuration &&
    checks.every((check) => check.optional || check.ok);
  const stepCover = step.coverUrlDark ?? step.coverUrl ?? step.coverUrlLight ?? null;
  const previewCover = coverPreview ?? stepCover;
  const fileHandlers = (onFile: (file: File) => void) => ({
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
  });

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="content-modal ops-modal content-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-editor-title"
      >
        <header className="content-editor__head">
          <div>
            <span className="eyebrow eyebrow--gold">{step.title}</span>
            <h2 id="content-editor-title">
              {initial ? `Editar ${typeLabel[contentType].toLowerCase()}` : "Adicionar conteúdo"}
            </h2>
          </div>
          <button className="modal-close" type="button" onClick={onDone} aria-label="Fechar">
            <X size={21} />
          </button>
        </header>

        <div className="content-editor__scroll">
          <div className="content-editor__types" role="radiogroup" aria-label="Tipo de conteúdo">
            {TYPE_CARDS.map((card) => {
              const Icon = typeIcon[card.id];
              return (
                <button
                  key={card.id}
                  type="button"
                  role="radio"
                  aria-checked={contentType === card.id}
                  className={contentType === card.id ? "is-active" : undefined}
                  disabled={!!initial && contentType !== card.id}
                  onClick={() => setContentType(card.id)}
                >
                  <span className="content-editor__type-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span>
                    <strong>{typeLabel[card.id]}</strong>
                    <small>{card.description}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="content-editor__body">
            <div className="content-editor__main">
              <section className="content-editor__section" aria-labelledby="content-editor-s1">
                <h3 id="content-editor-s1">
                  <span className="content-editor__step">1</span>
                  {isVideo ? "Vídeo da aula" : "Arquivo"}
                </h3>
                {uploading ? (
                  <div className="content-editor__progress" role="status">
                    <div>
                      <strong>{uploadName || (isVideo ? "Vídeo" : "Arquivo")}</strong>
                      <span>{isVideo ? `${progress ?? 0}%` : "Enviando…"}</span>
                    </div>
                    <span className="content-editor__bar">
                      <span style={{ width: `${isVideo ? (progress ?? 0) : 60}%` }} />
                    </span>
                    <small>
                      Enviando para o servidor seguro. Você pode preencher o resto enquanto isso.
                    </small>
                  </div>
                ) : (isVideo ? mediaPath : filePath) && !linkMode ? (
                  <div className="content-editor__done">
                    <span className="content-editor__done-icon" aria-hidden="true">
                      <Check size={20} />
                    </span>
                    <span>
                      <strong>
                        {uploadName || (isVideo ? "Vídeo da aula" : "Arquivo do material")}
                      </strong>
                      <small>
                        {isVideo
                          ? duration
                            ? `Vídeo enviado · duração: ${duration} min`
                            : "Vídeo enviado"
                          : "Arquivo privado vinculado"}
                      </small>
                    </span>
                    <label className="button button--glass content-editor__swap">
                      {isVideo ? "Trocar vídeo" : "Trocar arquivo"}
                      <input
                        className="content-editor__file"
                        type="file"
                        accept={isVideo ? "video/mp4,video/webm,video/quicktime" : undefined}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void (isVideo ? uploadVideo(file) : uploadMaterial(file));
                        }}
                      />
                    </label>
                  </div>
                ) : !linkMode ? (
                  <label
                    className={`content-editor__drop${dragging ? " is-dragging" : ""}`}
                    {...fileHandlers(
                      (file) => void (isVideo ? uploadVideo(file) : uploadMaterial(file)),
                    )}
                  >
                    <span className="content-editor__drop-icon" aria-hidden="true">
                      <Upload size={24} />
                    </span>
                    <strong>
                      {isVideo
                        ? "Arraste o vídeo aqui ou clique para escolher"
                        : "Arraste o arquivo aqui ou clique para escolher"}
                    </strong>
                    <small>
                      {isVideo
                        ? "MP4, MOV ou WebM · a duração é lida sozinha"
                        : "PDF, documento, planilha, imagem ou áudio · até 100 MB"}
                    </small>
                    <input
                      className="content-editor__file"
                      type="file"
                      accept={isVideo ? "video/mp4,video/webm,video/quicktime" : undefined}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void (isVideo ? uploadVideo(file) : uploadMaterial(file));
                      }}
                    />
                  </label>
                ) : null}
                {!uploading ? (
                  <button
                    className="content-editor__link-toggle"
                    type="button"
                    onClick={() => setLinkMode((value) => !value)}
                  >
                    {linkMode
                      ? "Voltar para envio de arquivo"
                      : isVideo
                        ? "Prefere usar um link do Google Drive?"
                        : "Prefere adicionar um link?"}
                  </button>
                ) : null}
                {linkMode ? (
                  <label className="ops-field">
                    <span>{isVideo ? "Link do vídeo (Google Drive)" : "Link do material"}</span>
                    <input
                      type="url"
                      placeholder="https://"
                      value={externalUrl}
                      onChange={(event) => {
                        setExternalUrl(event.target.value);
                        if (isVideo) {
                          setDurationSeconds(null);
                          if (event.target.value.trim()) setMediaPath(null);
                        } else if (event.target.value) setFilePath(null);
                      }}
                    />
                  </label>
                ) : null}
                {isVideo && detectingDuration ? (
                  <p className="ops-muted" role="status">
                    Lendo a duração do vídeo…
                  </p>
                ) : null}
                {isVideo && videoReady && !uploading ? (
                  <label className="content-editor__duration">
                    <span>Duração (min)</span>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={duration}
                      onChange={(event) => {
                        setDuration(event.target.value);
                        setDurationSeconds(null);
                      }}
                    />
                  </label>
                ) : null}
              </section>

              <section className="content-editor__section" aria-labelledby="content-editor-s2">
                <h3 id="content-editor-s2">
                  <span className="content-editor__step">2</span>
                  {isVideo ? "Sobre a aula" : "Sobre o material"}
                </h3>
                <label className="ops-field">
                  <span>{isVideo ? "Título da aula *" : "Título *"}</span>
                  <input
                    value={title}
                    maxLength={180}
                    placeholder={
                      isVideo
                        ? "Ex.: Preparo, insegurança e círculo de controle"
                        : "Ex.: Círculo de Controle — O que depende de mim?"
                    }
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <div className="content-editor__two">
                  <label className="ops-field">
                    <span>Módulo</span>
                    <select
                      value={creatingModule ? NEW_MODULE : moduleTitle}
                      onChange={(event) => {
                        if (event.target.value === NEW_MODULE) {
                          setCreatingModule(true);
                          setModuleTitle("");
                        } else {
                          setCreatingModule(false);
                          setModuleTitle(event.target.value);
                        }
                        setPlacement(initial ? "keep" : "end");
                      }}
                    >
                      <option value="">Sem módulo</option>
                      {modules.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value={NEW_MODULE}>+ Criar novo módulo</option>
                    </select>
                  </label>
                  <label className="ops-field">
                    <span>Posição na etapa</span>
                    <select
                      value={placement}
                      onChange={(event) => setPlacement(event.target.value)}
                    >
                      {initial ? <option value="keep">Manter onde está</option> : null}
                      <option value="start">
                        {moduleKey ? "No início do módulo" : "No início da etapa"}
                      </option>
                      {siblings.map((sibling) => (
                        <option key={sibling.id} value={`after:${sibling.id}`}>
                          Depois de “{shortTitle(sibling.title)}”
                        </option>
                      ))}
                      <option value="end">
                        {moduleKey ? "No fim do módulo" : "No fim da etapa"}
                      </option>
                    </select>
                  </label>
                </div>
                {creatingModule ? (
                  <label className="ops-field">
                    <span>Nome do novo módulo</span>
                    <input
                      maxLength={120}
                      placeholder="Ex.: Módulo 1 — Autoconsciência"
                      value={moduleTitle}
                      onChange={(event) => setModuleTitle(event.target.value)}
                    />
                  </label>
                ) : null}
                <label className="ops-field">
                  <span>
                    {isVideo ? "Resumo · aparece logo abaixo do vídeo" : "Descrição (opcional)"}
                  </span>
                  <textarea
                    rows={isVideo ? 4 : 3}
                    placeholder={
                      isVideo ? "Em 2 ou 3 frases, o que a pessoa vai aprender nesta aula." : ""
                    }
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                {!isVideo ? (
                  <label className="ops-field">
                    <span>Aparece em</span>
                    <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
                      <option value="">Todas as aulas da etapa</option>
                      {lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          Só na aula “{shortTitle(lesson.title)}”
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </section>

              {isVideo ? (
                <section
                  className="content-editor__section is-optional"
                  aria-labelledby="content-editor-s3"
                >
                  <h3 id="content-editor-s3">
                    <span className="content-editor__step is-outline">3</span>
                    Para aprofundar
                    <small>opcional</small>
                  </h3>
                  <div className="ops-field">
                    <span id="content-editor-topics">Principais temas</span>
                    <div className="content-editor__chips" aria-labelledby="content-editor-topics">
                      {topics.map((topic) => (
                        <span className="content-editor__chip" key={topic}>
                          {topic}
                          <button
                            type="button"
                            aria-label={`Remover tema ${topic}`}
                            onClick={() =>
                              setTopics((current) => current.filter((entry) => entry !== topic))
                            }
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      {topics.length < 12 ? (
                        <input
                          aria-label="Novo tema"
                          value={topicDraft}
                          placeholder={
                            topics.length ? "Outro tema + Enter" : "Digite um tema e aperte Enter"
                          }
                          onChange={(event) => setTopicDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === ",") {
                              event.preventDefault();
                              addTopic();
                            } else if (event.key === "Backspace" && !topicDraft && topics.length)
                              setTopics((current) => current.slice(0, -1));
                          }}
                          onBlur={addTopic}
                        />
                      ) : null}
                    </div>
                  </div>
                  <label className="ops-field">
                    <span>Pergunta para levar para a semana</span>
                    <input
                      maxLength={300}
                      placeholder="Ex.: Que situação desta semana está fora do seu controle?"
                      value={reflectionPrompt}
                      onChange={(event) => setReflectionPrompt(event.target.value)}
                    />
                  </label>
                </section>
              ) : null}
            </div>

            <aside className="content-editor__side">
              {isVideo ? (
                <section className="content-editor__card" aria-labelledby="content-editor-cover">
                  <h3 id="content-editor-cover">Capa da aula</h3>
                  {coverPreview ? (
                    <>
                      <img
                        className="content-editor__cover"
                        src={coverPreview}
                        alt="Capa atual da aula"
                      />
                      <div className="content-editor__cover-actions">
                        <label className="button button--glass">
                          {coverUploading ? "Enviando…" : "Trocar"}
                          <input
                            className="content-editor__file"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={coverUploading}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadCover(file);
                            }}
                          />
                        </label>
                        <button
                          className="button button--glass"
                          type="button"
                          onClick={() => {
                            setCoverPath(null);
                            setCoverPreview(null);
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    </>
                  ) : (
                    <label
                      className={`content-editor__drop is-cover${dragging ? " is-dragging" : ""}`}
                      {...fileHandlers((file) => void uploadCover(file))}
                    >
                      <span className="content-editor__drop-icon" aria-hidden="true">
                        <ImagePlus size={22} />
                      </span>
                      <strong>{coverUploading ? "Enviando capa…" : "Enviar capa"}</strong>
                      <small>16:9 · ideal 1280×720</small>
                      <input
                        className="content-editor__file"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={coverUploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadCover(file);
                        }}
                      />
                    </label>
                  )}
                  <small className="ops-muted">Sem capa, a aula usa a capa da etapa.</small>
                </section>
              ) : null}

              {isVideo ? (
                <section
                  className="content-editor__preview"
                  aria-labelledby="content-editor-preview"
                >
                  <h3 id="content-editor-preview">Como aparece para quem participa</h3>
                  <div className="content-editor__next">
                    {previewCover ? (
                      <img src={previewCover} alt="" />
                    ) : (
                      <span className="content-editor__next-empty" aria-hidden="true">
                        <Play size={16} />
                      </span>
                    )}
                    <span>
                      <small>A seguir · aula</small>
                      <strong>{hasTitle ? title : "O título da aula aparece aqui"}</strong>
                      <em>{duration ? `${duration} min` : "duração aparece depois do envio"}</em>
                    </span>
                  </div>
                </section>
              ) : null}

              <section className="content-editor__card" aria-labelledby="content-editor-audience">
                <h3 id="content-editor-audience">Quem recebe</h3>
                <div
                  className="content-editor__segmented"
                  role="radiogroup"
                  aria-label="Quem recebe"
                >
                  {(
                    [
                      ["general", "Todos"],
                      ["cohort", "Uma turma"],
                      ["mentee", "Uma pessoa"],
                    ] as const
                  ).map(([scope, label]) => (
                    <button
                      key={scope}
                      type="button"
                      role="radio"
                      aria-checked={accessScope === scope}
                      className={accessScope === scope ? "is-active" : undefined}
                      onClick={() => {
                        setAccessScope(scope);
                        if (scope !== "cohort") setCohortId("");
                        if (scope !== "mentee") setMenteeId("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {accessScope === "cohort" ? (
                  <select
                    aria-label="Turma"
                    value={cohortId}
                    onChange={(event) => setCohortId(event.target.value)}
                  >
                    <option value="">Selecione a turma</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {accessScope === "mentee" ? (
                  <select
                    aria-label="Participante"
                    value={menteeId}
                    onChange={(event) => setMenteeId(event.target.value)}
                  >
                    <option value="">Selecione a pessoa</option>
                    {mentees.map((mentee) => (
                      <option key={mentee.id} value={mentee.id}>
                        {mentee.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </section>
            </aside>
          </div>
        </div>

        <footer className="content-editor__foot">
          <ul className="content-editor__checks" aria-label="O que falta">
            {checks.map((check) => (
              <li key={check.label} className={check.ok ? "is-ok" : undefined}>
                {check.ok ? <Check size={13} aria-hidden="true" /> : null} {check.label}
              </li>
            ))}
          </ul>
          {message ? (
            <p className="form-message" role="alert">
              {message}
            </p>
          ) : null}
          <div className="content-editor__actions">
            <button className="button button--glass" type="button" onClick={onDone} disabled={busy}>
              Cancelar
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
            >
              <Save size={16} />{" "}
              {busy
                ? "Salvando…"
                : isVideo
                  ? initial
                    ? "Salvar aula"
                    : "Salvar aula"
                  : "Salvar material"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

const ignorePlayerEvent = () => undefined;
function StageVideoPreview({ item }: { item: StageContentItem }) {
  const load = useServerFn(getStageVideoPlayback);
  const updateMetadata = useServerFn(updateStageVideoMetadata);
  const qc = useQueryClient();
  const detected = useRef<number | null>(null);
  const query = useQuery({
    queryKey: ["stage-video-preview", item.id, item.sourceRevision],
    queryFn: async () => {
      const result = await load({ data: { contentId: item.id } });
      return result.r2 ? (await getR2PlaybackUrl(result.contentId)).url : result.url;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
  if (query.isError)
    return (
      <div className="recorded-player__empty" role="status">
        <p>{query.error.message}</p>
        <button type="button" className="button button--glass" onClick={() => void query.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  if (!query.data) return <p role="status">Preparando a prévia do vídeo…</p>;
  return (
    <>
      <div className="recorded-player">
        <RecordedPlayer
          url={query.data}
          onEnded={ignorePlayerEvent}
          onTime={ignorePlayerEvent}
          onController={ignorePlayerEvent}
          onDuration={(value) => {
            const seconds = Math.round(value);
            if (
              !Number.isFinite(seconds) ||
              seconds <= 0 ||
              seconds === item.durationSeconds ||
              detected.current === seconds
            )
              return;
            detected.current = seconds;
            void updateMetadata({
              data: {
                contentId: item.id,
                revision: item.sourceRevision ?? 1,
                durationSeconds: seconds,
              },
            })
              .then(() => qc.invalidateQueries({ queryKey: ["stage-contents"] }))
              .catch(() => {
                detected.current = null;
              });
          }}
        />
      </div>
      <p className="ops-muted">
        Prévia da mentora: esta reprodução não conta no progresso de quem participa.
      </p>
    </>
  );
}

function VideoEngagement({ item, onClose }: { item: StageContentItem; onClose: () => void }) {
  const load = useServerFn(getStageVideoEngagement);
  const query = useQuery({
    queryKey: ["stage-video-engagement", item.id, item.sourceRevision],
    queryFn: () => load({ data: { contentId: item.id } }),
    retry: false,
    staleTime: 30000,
  });
  const viewers = query.data?.viewers ?? [];
  return (
    <div className="modal-backdrop content-admin-preview" role="presentation">
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Acompanhamento de ${item.title}`}
      >
        <button className="modal-close" type="button" aria-label="Fechar" onClick={onClose}>
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">Acompanhamento da aula</span>
          <h2>{item.title}</h2>
          <p className="ops-muted">
            Participantes com acesso liberado ao vídeo atual. O progresso mostra a maior posição
            alcançada; a prévia da mentora não entra nos registros.
          </p>
          {query.isLoading ? (
            <p role="status">Carregando acompanhamento…</p>
          ) : query.isError ? (
            <div role="status">
              <p>Não foi possível carregar o acompanhamento.</p>
              <button
                type="button"
                className="button button--glass"
                onClick={() => void query.refetch()}
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <p>
                {viewers.filter((v) => v.first_viewed_at).length} iniciaram ·{" "}
                {viewers.filter((v) => v.completed).length} concluíram · {viewers.length} com acesso
              </p>
              {viewers.length ? (
                <div className="content-admin-table-wrap">
                  <table className="content-admin-table">
                    <thead>
                      <tr>
                        <th>Participante</th>
                        <th>Situação</th>
                        <th>Progresso</th>
                        <th>Última reprodução</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewers.map((v) => {
                        const percent = v.duration_seconds
                          ? Math.min(100, Math.round((v.max_seconds / v.duration_seconds) * 100))
                          : null;
                        return (
                          <tr key={v.enrollment_id}>
                            <td data-label="Participante">{v.display_name}</td>
                            <td data-label="Situação">
                              {v.completed
                                ? "Concluído"
                                : v.first_viewed_at
                                  ? "Em andamento"
                                  : "Não iniciado"}
                            </td>
                            <td data-label="Progresso">
                              {percent === null ? (
                                "—"
                              ) : (
                                <>
                                  <progress
                                    className="content-admin-video-progress"
                                    max={100}
                                    value={percent}
                                    aria-label={`Progresso de ${v.display_name}`}
                                  />
                                  <small>{percent}%</small>
                                </>
                              )}
                            </td>
                            <td data-label="Última reprodução">
                              {v.updated_at ? new Date(v.updated_at).toLocaleString("pt-BR") : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Ninguém tem acesso liberado a esta gravação no momento.</p>
              )}
            </>
          )}
          <button type="button" className="button button--glass" onClick={onClose}>
            Fechar
          </button>
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
          {item.contentType === "video" ? <StageVideoPreview item={item} /> : null}
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
            {externalUrl && item.contentType !== "video" ? (
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
  const reorder = useServerFn(orderStageContents);
  const [reordering, setReordering] = useState(false);
  const renameFn = useServerFn(renameStageModule);
  const assignFn = useServerFn(assignStageModule);
  const ordered = [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const allGroups = useMemo(() => groupByModule(items), [items]);
  const modules = useMemo(() => moduleNames(items), [items]);
  const hasModules = modules.length > 0;
  /** Primeiro/último de cada módulo: limita as setas ao próprio módulo. */
  const edges = useMemo(() => {
    const map = new Map<string, { first: boolean; last: boolean }>();
    for (const group of allGroups)
      group.items.forEach((item, index) =>
        map.set(item.id, { first: index === 0, last: index === group.items.length - 1 }),
      );
    return map;
  }, [allGroups]);

  async function applyOrder(ids: string[] | null) {
    if (!ids) return;
    setReordering(true);
    setMessage("");
    try {
      await reorder({
        data: { pillarId, stepKey: step.stableKey, expectedIds: ordered.map((i) => i.id), ids },
      });
      await invalidateJourneyData(qc);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar a ordem.");
    } finally {
      setReordering(false);
    }
  }
  const moveContent = (id: string, direction: number) =>
    applyOrder(moveWithinModule(items, id, direction));
  const moveWholeModule = (title: string, direction: number) =>
    applyOrder(moveModule(items, title, direction));

  const [renaming, setRenaming] = useState<{ from: string; value: string } | null>(null);
  async function saveRename() {
    if (!renaming) return;
    setReordering(true);
    setMessage("");
    try {
      await renameFn({
        data: { pillarId, stepKey: step.stableKey, from: renaming.from, to: renaming.value },
      });
      setRenaming(null);
      await invalidateJourneyData(qc);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível renomear o módulo.");
    } finally {
      setReordering(false);
    }
  }

  const [selected, setSelected] = useState<string[]>([]);
  const [targetModule, setTargetModule] = useState("");
  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  async function assignSelected() {
    if (!selected.length) return;
    setReordering(true);
    setMessage("");
    try {
      await assignFn({
        data: { pillarId, stepKey: step.stableKey, ids: selected, moduleTitle: targetModule },
      });
      setSelected([]);
      setTargetModule("");
      await invalidateJourneyData(qc);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível mover para o módulo.");
    } finally {
      setReordering(false);
    }
  }
  const qc = useQueryClient();
  const [newModule, setNewModule] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [editing, setEditing] = useState<StageContentItem | null | "new">(null);
  const [previewing, setPreviewing] = useState<StageContentItem | null>(null);
  const [tracking, setTracking] = useState<StageContentItem | null>(null);
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
        module: moduleFilter,
      }),
    [audienceFilter, cohortFilter, items, moduleFilter, search, sort, typeFilter],
  );
  const paged = useMemo(() => paginate(filtered, page, 8), [filtered, page]);
  // Com módulos e "Ordem da jornada", a lista aparece separada por módulo (sem paginação).
  const groupedView = hasModules && sort === "position";
  const visibleGroups = useMemo(() => groupByModule(filtered), [filtered]);

  useEffect(() => {
    if (page !== paged.page) setPage(paged.page);
  }, [page, paged.page]);

  function updateFilter(update: () => void) {
    update();
    setPage(1);
  }

  function startNew(type: StageContentItem["contentType"], module = "") {
    setNewType(type);
    setNewModule(module);
    setEditing("new");
  }

  function clearFilters() {
    setSearch("");
    setModuleFilter("all");
    setCohortFilter("all");
    setAudienceFilter("all");
    setTypeFilter("all");
    setSort("position");
    setPage(1);
  }

  async function remove(item: StageContentItem) {
    const proof = await confirmProtectedOperation({
      scope: { type: "content", id: item.id, operation: "delete" },
      title: "Excluir conteúdo?",
      description: `“${item.title}” deixará de aparecer na etapa e ficará na lixeira. O arquivo e o acompanhamento serão preservados.`,
    });
    if (!proof) return;
    setMessage("");
    try {
      await deleteFn({ data: { id: item.id, proof } });
      await invalidateJourneyData(qc);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover.");
    }
  }

  const coverUrl = step.coverUrlDark ?? step.coverUrl ?? step.coverUrlLight ?? null;

  function renderRow(item: StageContentItem) {
    const Icon = typeIcon[item.contentType];
    return (
      <tr key={item.id}>
        <td data-label="Conteúdo">
          <div className="content-admin-title-cell">
            <input
              className="content-admin-check"
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggleSelected(item.id)}
              aria-label={`Selecionar ${item.title}`}
            />
            <span className={`content-admin-thumb is-${item.contentType}`}>
              {(item.coverUrl ?? coverUrl) && item.contentType === "video" ? (
                <img src={item.coverUrl ?? coverUrl ?? undefined} alt="" />
              ) : (
                <Icon size={22} />
              )}
            </span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.description || "Sem descrição"}</small>
              {item.contentType === "video" ? (
                <small>
                  {videoDurationLabel(item.durationSeconds, item.durationMinutes)}
                  {item.engagement
                    ? ` · Concluíram ${item.engagement.completed} de ${item.engagement.eligible}`
                    : ""}
                </small>
              ) : null}
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
                    : "Somente esta pessoa"}
              </small>
            </span>
          </span>
        </td>
        <td data-label="Ações">
          <div className="content-admin-actions">
            <button
              type="button"
              disabled={reordering || edges.get(item.id)?.first !== false}
              onClick={() => void moveContent(item.id, -1)}
              aria-label={`Mover ${item.title} para cima`}
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              disabled={reordering || edges.get(item.id)?.last !== false}
              onClick={() => void moveContent(item.id, 1)}
              aria-label={`Mover ${item.title} para baixo`}
            >
              <ArrowDown size={15} />
            </button>
            <button type="button" onClick={() => setPreviewing(item)}>
              <Eye size={15} /> Visualizar
            </button>
            {item.contentType === "video" ? (
              <button type="button" onClick={() => setTracking(item)}>
                <UsersRound size={15} /> Acompanhamento
              </button>
            ) : null}
            <button type="button" onClick={() => setEditing(item)}>
              <Pencil size={15} /> Editar
            </button>
            <button className="is-danger" type="button" onClick={() => void remove(item)}>
              <Trash2 size={15} /> Excluir
            </button>
          </div>
        </td>
      </tr>
    );
  }

  function renderTable(rows: StageContentItem[]) {
    return (
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
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      </div>
    );
  }

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

      <section
        className={`content-admin-filters content-admin-filters--detail${hasModules ? " has-modules" : ""}`}
      >
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
        {hasModules ? (
          <label>
            <span>Módulo</span>
            <select
              value={moduleFilter}
              onChange={(event) => updateFilter(() => setModuleFilter(event.target.value))}
            >
              <option value="all">Todos</option>
              {modules.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {allGroups.some((group) => !group.title) ? (
                <option value="">Sem módulo</option>
              ) : null}
            </select>
          </label>
        ) : null}
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
            <option value="general">Todas as pessoas</option>
            <option value="cohort">Turma específica</option>
            <option value="mentee">Pessoa específica</option>
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

      {!hasModules && items.length > 1 ? (
        <p className="content-admin-hint">
          <FolderOpen size={16} /> Para separar as aulas por módulo, marque as aulas na lista e use
          “Mover para módulo”, ou preencha o campo Módulo ao editar uma aula.
        </p>
      ) : null}

      {selected.length ? (
        <section className="content-admin-bulk" aria-label="Mover conteúdos para um módulo">
          <strong>
            {selected.length === 1
              ? "1 conteúdo selecionado"
              : `${selected.length} conteúdos selecionados`}
          </strong>
          <label>
            <span>Mover para módulo</span>
            <input
              list="stage-module-bulk-options"
              maxLength={120}
              placeholder="Nome do módulo (vazio = sem módulo)"
              value={targetModule}
              onChange={(event) => setTargetModule(event.target.value)}
            />
            <datalist id="stage-module-bulk-options">
              {modules.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <button
            className="button button--primary"
            type="button"
            disabled={reordering}
            onClick={() => void assignSelected()}
          >
            <FolderOpen size={16} /> Aplicar
          </button>
          <button className="button button--glass" type="button" onClick={() => setSelected([])}>
            Cancelar
          </button>
        </section>
      ) : null}

      {paged.total ? (
        groupedView ? (
          <div className="content-admin-modules">
            {visibleGroups.map((group) => {
              const groupIndex = allGroups.findIndex((entry) => entry.title === group.title);
              const isRenaming = renaming && renaming.from === group.title;
              return (
                <section className="content-admin-module" key={group.title || "__sem-modulo"}>
                  <header className="content-admin-module__header">
                    {isRenaming ? (
                      <form
                        className="content-admin-module__rename"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveRename();
                        }}
                      >
                        <input
                          autoFocus
                          maxLength={120}
                          value={renaming.value}
                          onChange={(event) =>
                            setRenaming({ from: group.title, value: event.target.value })
                          }
                          aria-label="Novo nome do módulo"
                        />
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={reordering}
                        >
                          <Save size={15} /> Salvar
                        </button>
                        <button
                          className="button button--glass"
                          type="button"
                          onClick={() => setRenaming(null)}
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <div>
                        <span className="eyebrow eyebrow--gold">
                          {group.title ? `Módulo ${groupIndex + 1}` : "Fora dos módulos"}
                        </span>
                        <h2>{group.title || "Sem módulo"}</h2>
                        <small>
                          {group.items.length === 1
                            ? "1 conteúdo"
                            : `${group.items.length} conteúdos`}
                        </small>
                      </div>
                    )}
                    {!isRenaming ? (
                      <div className="content-admin-actions">
                        <button
                          type="button"
                          disabled={reordering || groupIndex <= 0}
                          onClick={() => void moveWholeModule(group.title, -1)}
                          aria-label={`Subir o módulo ${group.title || "Sem módulo"}`}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={reordering || groupIndex >= allGroups.length - 1}
                          onClick={() => void moveWholeModule(group.title, 1)}
                          aria-label={`Descer o módulo ${group.title || "Sem módulo"}`}
                        >
                          <ArrowDown size={15} />
                        </button>
                        {group.title ? (
                          <button
                            type="button"
                            onClick={() => setRenaming({ from: group.title, value: group.title })}
                          >
                            <Pencil size={15} /> Renomear
                          </button>
                        ) : null}
                        <button type="button" onClick={() => startNew("video", group.title)}>
                          <Plus size={15} /> Aula neste módulo
                        </button>
                      </div>
                    ) : null}
                  </header>
                  {renderTable(group.items)}
                </section>
              );
            })}
          </div>
        ) : (
          <>
            {renderTable(paged.items)}
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
        )
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
          nextPosition={Math.max(-1, ...items.map((i) => i.position)) + 1}
          defaultType={editing === "new" ? newType : undefined}
          cohorts={cohorts}
          mentees={mentees}
          modules={modules}
          defaultModule={editing === "new" ? newModule : ""}
          stageItems={items}
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
      {tracking ? <VideoEngagement item={tracking} onClose={() => setTracking(null)} /> : null}
    </div>
  );
}

export function JourneyContentAdmin() {
  const loadOverview = useServerFn(getMentorContentOverview);
  const loadJourney = useServerFn(getJourneyEditor);
  const loadContents = useServerFn(getStageContents);
  const loadDirectory = useServerFn(getDirectory);
  const overview = useQuery({
    queryKey: ["stage-contents", "overview"],
    queryFn: () => loadOverview(),
    ...liveJourneyQueryOptions,
  });
  const directory = useQuery({
    queryKey: ["directory", "content-admin"],
    queryFn: () => loadDirectory(),
  });
  const [selection, setSelection] = useState<{ pillarId: string; stepKey: string } | null>(null);
  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const journey = useQuery({
    queryKey: ["journey-content-structure", selection?.pillarId],
    enabled: !!selection,
    queryFn: () => loadJourney({ data: { pillarId: selection!.pillarId } }),
    ...liveJourneyQueryOptions,
  });
  const contents = useQuery({
    queryKey: ["stage-contents", selection?.pillarId],
    enabled: !!selection,
    queryFn: () => loadContents({ data: { pillarId: selection!.pillarId } }),
    ...liveJourneyQueryOptions,
  });
  const cohorts = (directory.data?.cohorts ?? []).map((c) => ({ id: c.id, name: c.name }));
  const mentees = (directory.data?.enrollments ?? []).map((e) => ({
    id: e.menteeId,
    name: e.name,
  }));
  const selectedStep = journey.data?.steps.find((s) => s.stableKey === selection?.stepKey);
  const groups = (overview.data?.pillars ?? [])
    .filter((p) => pillarFilter === "all" || p.id === pillarFilter)
    .map((p) => ({
      ...p,
      steps: p.steps.filter((s) =>
        stageMatchesFilters(s.title, s.items, {
          search,
          cohortId: cohortFilter,
          audience: audienceFilter,
        }),
      ),
    }))
    .filter((p) => p.steps.length > 0);
  const clear = () => {
    setSearch("");
    setPillarFilter("all");
    setCohortFilter("all");
    setAudienceFilter("all");
  };
  if (selection) {
    return (
      <main className="inner-page content-admin-page">
        <div className="page-width">
          {journey.isLoading || contents.isLoading ? (
            <p role="status">Carregando conteúdos da etapa…</p>
          ) : journey.isError || contents.isError || !selectedStep ? (
            <div className="content-admin-empty">
              <h2>Não foi possível carregar esta etapa.</h2>
              <button
                className="button button--glass"
                type="button"
                onClick={() => setSelection(null)}
              >
                Voltar para conteúdos
              </button>
            </div>
          ) : (
            <StageContentManager
              pillarId={selection.pillarId}
              step={selectedStep}
              items={(contents.data?.items ?? []).filter(
                (i) => i.stepKey === selectedStep.stableKey,
              )}
              cohorts={cohorts}
              mentees={mentees}
              onBack={() => setSelection(null)}
            />
          )}
        </div>
      </main>
    );
  }
  const formatNames: Record<string, string> = {
    cohort_onboarding: "Onboarding da turma",
    recorded_class: "Aula gravada",
    collective_recording: "Encontro coletivo gravado",
    live_group: "Encontro coletivo",
    individual_1_1: "Encontro 1:1",
    questionnaire: "Questionário",
    form: "Formulário",
  };
  return (
    <main className="inner-page content-admin-page mentor-content-overview">
      <div className="page-intro page-width">
        <span className="eyebrow eyebrow--gold">Conteúdos</span>
        <h1>Conteúdos da jornada</h1>
        <p>
          Organize aulas e materiais para cada etapa, turma ou participante. Datas e etapas se
          editam em Jornada.
        </p>
      </div>
      <div className="page-width">
        <GoogleDriveCard />
      </div>
      <section className="page-width content-admin-filters">
        <label className="content-admin-search">
          <Search size={18} />
          <span className="sr-only">Buscar etapa ou conteúdo</span>
          <input
            type="search"
            placeholder="Buscar etapa, aula ou material"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span>Pilar</span>
          <select value={pillarFilter} onChange={(e) => setPillarFilter(e.target.value)}>
            <option value="all">Todos</option>
            {(overview.data?.pillars ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Turma</span>
          <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}>
            <option value="all">Todas</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Público</span>
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value as AudienceFilter)}
          >
            <option value="all">Todos</option>
            <option value="general">Todas as pessoas</option>
            <option value="cohort">Turma específica</option>
            <option value="mentee">Pessoa específica</option>
          </select>
        </label>
        <button className="content-admin-clear" type="button" onClick={clear}>
          Limpar
        </button>
      </section>
      <div className="page-width mentor-content-groups">
        {overview.isLoading ? (
          <p className="content-admin-loading" role="status">
            Carregando conteúdos da jornada…
          </p>
        ) : overview.isError ? (
          <div className="content-admin-empty">
            <h2>Não foi possível carregar os conteúdos.</h2>
            <button
              className="button button--glass"
              type="button"
              onClick={() => void overview.refetch()}
            >
              Tentar novamente
            </button>
          </div>
        ) : !groups.length ? (
          <div className="content-admin-empty">
            <h2>Nenhuma etapa encontrada</h2>
            <p>Limpe os filtros ou tente outra busca.</p>
            <button className="button button--glass" type="button" onClick={clear}>
              Limpar filtros
            </button>
          </div>
        ) : (
          groups.map((p) => (
            <section className="mentor-content-group" key={p.id} aria-label={p.name}>
              <h2>{p.name}</h2>
              <div className="content-admin-stage-list">
                {p.steps.map((s) => {
                  const counts = summarizeStageContent(s.items);
                  const Icon = counts.video
                    ? Play
                    : counts.material
                      ? FileText
                      : counts.questionnaire
                        ? BookOpen
                        : Layers3;
                  const when = s.scheduledAt || s.releaseAt;
                  return (
                    <article className="content-admin-stage-row" key={s.stableKey}>
                      <span className="content-admin-stage-row__icon">
                        <Icon size={24} />
                      </span>
                      <div className="content-admin-stage-row__copy">
                        <strong>{s.title || "Etapa sem título"}</strong>
                        <p>
                          {when ? new Date(when).toLocaleDateString("pt-BR") : "Data a definir"} ·{" "}
                          {formatNames[s.format] ?? "Etapa"} · {counts.video} aula(s) ·{" "}
                          {counts.material} material(is)
                          {counts.questionnaire ? " · questionário" : ""}
                        </p>
                      </div>
                      <span className="content-admin-stage-row__count">
                        {counts.total} {counts.total === 1 ? "conteúdo" : "conteúdos"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelection({ pillarId: p.id, stepKey: s.stableKey });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Gerenciar <ChevronRight size={18} />
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
