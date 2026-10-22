import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileQuestion,
  FileText,
  LockKeyhole,
  NotebookPen,
  Play,
  Plus,
  VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { RecordedPlayer, type PlayerController } from "@/components/recorded-lessons";
import { RiseAssessmentExperience } from "@/components/rise-assessment";
import { getR2PlaybackUrl } from "@/lib/r2-worker";
import {
  addJourneyContentMarker,
  getJourneyContent,
  getJourneyContentLibrary,
  getJourneyStudyState,
  saveJourneyContentNote,
  saveJourneyContentProgress,
  getStageQuestionnaireResponse,
  submitStageQuestionnaire,
  type JourneyContentItem,
  type StageQuestion,
} from "@/lib/content.functions";

type JourneyMarker = {
  id: string;
  timestamp_seconds: number;
  reflection: string;
  created_at: string;
};

function isVideo(item: JourneyContentItem) {
  return (
    item.resourceType === "r2" ||
    !!item.mediaUrl ||
    ["recorded_class", "collective_recording", "cohort_onboarding", "individual_1_1"].includes(
      item.format,
    )
  );
}

function typeLabel(item: JourneyContentItem) {
  if (item.format === "cohort_onboarding") return "Onboarding da turma";
  if (item.format === "collective_recording") return "Encontro coletivo";
  if (item.format === "individual_1_1") return "Encontro individual 1:1";
  if (item.format === "questionnaire" || item.format === "form") return "Questionário";
  return "Aula gravada";
}

function availabilityLabel(item: JourneyContentItem) {
  if (item.completed) return "Concluída";
  if (item.availability === "coming_soon") return "Em breve";
  if (item.availability === "missing_resource") return "Aguardando publicação";
  return "Disponível";
}

function formatTime(value: number) {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function StageQuestionnaire({
  contentId,
  questions,
}: {
  contentId: string;
  questions: StageQuestion[];
}) {
  const load = useServerFn(getStageQuestionnaireResponse);
  const submit = useServerFn(submitStageQuestionnaire);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["stage-questionnaire", contentId],
    queryFn: () => load({ data: { contentId } }),
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.data?.answers) setAnswers(query.data.answers);
  }, [query.data?.answers]);

  async function send() {
    setBusy(true);
    setMessage("");
    try {
      await submit({ data: { contentId, answers } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["stage-questionnaire", contentId] }),
        qc.invalidateQueries({ queryKey: ["journey-study"] }),
        qc.invalidateQueries({ queryKey: ["journey-content-library"] }),
      ]);
      setMessage("Questionário enviado com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o questionário.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="lesson-summary">
      <h2>
        <FileQuestion size={22} /> Questionário
      </h2>
      <div className="ops-form">
        {questions.map((question, index) => (
          <label className="ops-field" key={question.id}>
            <span>
              {index + 1}. {question.prompt}
              {question.required ? " *" : ""}
            </span>
            {question.type === "long_text" ? (
              <textarea
                rows={5}
                value={answers[question.id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
              />
            ) : question.type === "single_choice" ? (
              <select
                value={answers[question.id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
              >
                <option value="">Selecione</option>
                {question.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={answers[question.id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
              />
            )}
          </label>
        ))}
        {message ? <p className="form-message">{message}</p> : null}
        <button
          className="button button--primary"
          type="button"
          onClick={() => void send()}
          disabled={busy}
        >
          {busy ? "Enviando…" : query.data?.submitted ? "Atualizar respostas" : "Enviar respostas"}
        </button>
      </div>
    </section>
  );
}

export function useJourneyContentLibrary(enabled = true) {
  const load = useServerFn(getJourneyContentLibrary);
  return useQuery({
    queryKey: ["journey-content-library"],
    queryFn: () => load(),
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

function ContentCover({ item }: { item: JourneyContentItem }) {
  const lightCoverUrl = item.coverUrlLight ?? (!item.coverUrlDark ? (item.coverUrl ?? null) : null);
  const darkCoverUrl = item.coverUrlDark ?? (!item.coverUrlLight ? (item.coverUrl ?? null) : null);
  const hasCover = !!(lightCoverUrl || darkCoverUrl);

  return (
    <div className="journey-content-cover">
      {hasCover ? (
        <>
          {lightCoverUrl ? (
            <img
              className="journey-content-cover__image journey-content-cover__image--light"
              src={lightCoverUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : null}
          {darkCoverUrl ? (
            <img
              className="journey-content-cover__image journey-content-cover__image--dark"
              src={darkCoverUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : null}
        </>
      ) : (
        <div aria-hidden="true" />
      )}
      {item.availability !== "available" ? (
        <span>{availabilityLabel(item)}</span>
      ) : item.resourceType === "r2" || item.mediaUrl ? (
        <Play size={25} fill="currentColor" aria-hidden="true" />
      ) : item.questionnaireId || item.format === "questionnaire" || item.format === "form" ? (
        <FileQuestion size={25} aria-hidden="true" />
      ) : !hasCover && item.materials.length ? (
        <FileText size={25} aria-hidden="true" />
      ) : null}
    </div>
  );
}

function ContentCard({
  item,
  onOpen,
}: {
  item: JourneyContentItem;
  onOpen: (item: JourneyContentItem) => void;
}) {
  const disabled = item.availability !== "available";
  return (
    <article className={`journey-content-card ${disabled ? "is-disabled" : ""}`}>
      <button type="button" disabled={disabled} onClick={() => onOpen(item)}>
        <ContentCover item={item} />
        <span className="journey-content-card__meta">
          Mês {item.monthNumber} · {item.pillarName}
        </span>
        <strong>{item.title}</strong>
        <small>
          {typeLabel(item)}
          {item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}
        </small>
      </button>
    </article>
  );
}

export function ContinueJourneySection({ onOpen }: { onOpen: (item: JourneyContentItem) => void }) {
  const query = useJourneyContentLibrary(true);
  const items = query.data?.items.slice(0, 4) ?? [];
  if (query.isError || (!query.isLoading && !items.length)) return null;
  return (
    <section
      className="content-section page-width continue-journey"
      aria-labelledby="continue-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="continue-title">Continue sua jornada</h2>
          <p>Encontros, conteúdos e descobertas da sua jornada.</p>
        </div>
      </div>
      {query.isLoading ? (
        <div className="journey-content-loading">Carregando suas próximas etapas…</div>
      ) : (
        <div className="continue-journey__grid">
          {items.map((item) => (
            <ContentCard key={item.stepKey} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

export function NextMovementSection({
  currentMonth,
  onOpen,
}: {
  currentMonth: number;
  onOpen: (item: JourneyContentItem) => void;
}) {
  const query = useJourneyContentLibrary(true);
  const nextMonth = currentMonth + 1;
  const items = (query.data?.items ?? [])
    .filter((item) => item.monthNumber === nextMonth)
    .slice(0, 4);

  if (nextMonth > 6 || query.isError || (!query.isLoading && !items.length)) return null;

  return (
    <section className="content-section page-width" aria-labelledby="next-movement-title">
      <div className="section-heading">
        <div>
          <h2 id="next-movement-title">Prepare o seu próximo movimento</h2>
          <p>Mês {nextMonth}, conteúdos da próxima etapa da sua jornada.</p>
        </div>
      </div>
      {query.isLoading ? (
        <div className="journey-content-loading">Carregando a próxima etapa…</div>
      ) : (
        <div className="continue-journey__grid">
          {items.map((item) => (
            <ContentCard key={item.stepKey} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

export function JourneyContentLibraryPage({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (item: JourneyContentItem) => void;
}) {
  const query = useJourneyContentLibrary();
  const [month, setMonth] = useState<number | "all">("all");
  const items = (query.data?.items ?? []).filter(
    (item) => isVideo(item) && (month === "all" || item.monthNumber === month),
  );
  return (
    <main className="inner-page recorded-library recorded-background">
      <div className="page-width recorded-library__head">
        <button className="recorded-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Minha jornada
        </button>
        <span className="eyebrow eyebrow--gold">Conteúdo sob demanda</span>
        <h1>Aulas gravadas</h1>
        <p>Conteúdos autorizados para você, organizados pelos seis pilares da jornada.</p>
        <div className="recorded-filters" aria-label="Filtrar por mês">
          <button
            type="button"
            className={month === "all" ? "is-active" : ""}
            onClick={() => setMonth("all")}
          >
            Todos
          </button>
          {[1, 2, 3, 4, 5, 6].map((value) => (
            <button
              type="button"
              key={value}
              className={month === value ? "is-active" : ""}
              onClick={() => setMonth(value)}
            >
              Mês {value}
            </button>
          ))}
        </div>
      </div>
      <div className="page-width journey-content-library">
        {query.isLoading ? <p>Carregando aulas…</p> : null}
        {query.isError ? (
          <div className="journey-content-state">
            <h2>Não foi possível carregar a biblioteca.</h2>
            <p>Verifique se a migration de conteúdos foi aplicada no banco conectado.</p>
          </div>
        ) : null}
        {!query.isLoading && !query.isError && !items.length ? (
          <div className="journey-content-state">
            <VideoOff size={30} />
            <h2>Nenhuma aula publicada para este filtro.</h2>
            <p>Rascunhos e conteúdos de outras turmas não aparecem aqui.</p>
          </div>
        ) : (
          <div className="journey-content-library__grid">
            {items.map((item) => (
              <ContentCard key={item.stepKey} item={item} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function JourneyNotebook({
  item,
  currentTime,
  player,
}: {
  item: JourneyContentItem;
  currentTime: number;
  player: PlayerController;
}) {
  const load = useServerFn(getJourneyStudyState);
  const save = useServerFn(saveJourneyContentNote);
  const addMarker = useServerFn(addJourneyContentMarker);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["journey-study", item.stepKey],
    queryFn: () => load({ data: { stepKey: item.stepKey } }),
  });
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tab, setTab] = useState<"notes" | "markers">("notes");
  const [marking, setMarking] = useState(false);
  const [reflection, setReflection] = useState("");
  const [markerError, setMarkerError] = useState("");

  useEffect(() => {
    if (!query.data || ready) return;
    setText(query.data.note);
    setReady(true);
  }, [query.data, ready]);

  useEffect(() => {
    if (!ready) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        await save({ data: { stepKey: item.stepKey, content: text } });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [item.stepKey, ready, save, text]);

  async function saveMarker() {
    if (!reflection.trim()) {
      setMarkerError("Escreva uma reflexão para este momento.");
      return;
    }
    try {
      await addMarker({
        data: {
          stepKey: item.stepKey,
          timestampSeconds: Math.max(0, Math.floor(currentTime)),
          reflection,
        },
      });
      setReflection("");
      setMarking(false);
      await queryClient.invalidateQueries({ queryKey: ["journey-study", item.stepKey] });
    } catch (error) {
      setMarkerError(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  }

  return (
    <aside className="lesson-notebook" aria-label="Meu Caderno">
      <header className="lesson-notebook__head">
        <div>
          <NotebookPen size={25} />
          <h2>Meu Caderno</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setTab("markers");
            setMarking(true);
            setMarkerError("");
          }}
          disabled={!(item.mediaUrl || item.resourceType === "r2") || !player.canSeek}
          title={!player.canSeek ? "Este player não oferece marcação de tempo" : undefined}
        >
          <Plus size={17} /> Marcar momento
        </button>
      </header>
      <div className="notebook-editor">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Anote seus insights enquanto acompanha a aula…"
          aria-label="Anotações privadas da aula"
          disabled={!ready}
        />
      </div>
      <div className={`notebook-save notebook-save--${saveState}`} role="status">
        <span />
        {saveState === "saving"
          ? "Salvando…"
          : saveState === "saved"
            ? "Salvo automaticamente"
            : saveState === "error"
              ? "Erro ao salvar"
              : "Salvamento automático"}
      </div>
      <div className="notebook-tabs" role="tablist">
        <button
          type="button"
          className={tab === "notes" ? "is-active" : ""}
          onClick={() => setTab("notes")}
        >
          Minhas anotações
        </button>
        <button
          type="button"
          className={tab === "markers" ? "is-active" : ""}
          onClick={() => setTab("markers")}
        >
          Meus marcadores ({query.data?.markers.length ?? 0})
        </button>
      </div>
      <div className="notebook-tab-panel">
        {tab === "notes" ? (
          text.trim() ? (
            <p className="notebook-note-preview">{text}</p>
          ) : (
            <p className="notebook-empty">Suas anotações desta aula aparecerão aqui.</p>
          )
        ) : (
          <>
            {marking ? (
              <div className="marker-form">
                <strong>Momento {formatTime(currentTime)}</strong>
                <textarea
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  placeholder="O que fez sentido para você neste trecho?"
                />
                {markerError ? <small>{markerError}</small> : null}
                <div>
                  <button type="button" onClick={() => setMarking(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="is-primary" onClick={() => void saveMarker()}>
                    Salvar marcador
                  </button>
                </div>
              </div>
            ) : null}
            {((query.data?.markers ?? []) as JourneyMarker[]).map((marker) => (
              <article className="lesson-marker" key={marker.id}>
                <button
                  type="button"
                  onClick={() => player.seek(marker.timestamp_seconds)}
                  disabled={!player.canSeek}
                >
                  <Play size={14} /> {formatTime(marker.timestamp_seconds)}
                </button>
                <p>{marker.reflection}</p>
              </article>
            ))}
          </>
        )}
      </div>
      <div className="notebook-private">
        <LockKeyhole size={14} /> Privado: somente você pode acessar este caderno.
      </div>
    </aside>
  );
}

export function JourneyContentLessonPage({
  stepKey,
  onBack,
  onNavigate,
}: {
  stepKey: string;
  onBack: () => void;
  onNavigate: (stepKey: string) => void;
}) {
  const load = useServerFn(getJourneyContent);
  const loadStudy = useServerFn(getJourneyStudyState);
  const saveProgress = useServerFn(saveJourneyContentProgress);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["journey-content", stepKey],
    queryFn: () => load({ data: { stepKey } }),
  });
  const study = useQuery({
    queryKey: ["journey-study", stepKey],
    queryFn: () => loadStudy({ data: { stepKey } }),
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [r2Url, setR2Url] = useState<string | null>(null);
  const [r2Error, setR2Error] = useState("");
  const [r2Loading, setR2Loading] = useState(false);
  const [player, setPlayer] = useState<PlayerController>({ canSeek: false, seek: () => undefined });
  const lastSaved = useRef(0);
  const item = query.data?.item;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setCurrentTime(0);
    setDuration(null);
    setR2Url(null);
    setR2Error("");
    lastSaved.current = 0;
  }, [stepKey]);

  useEffect(() => {
    if (!item || item.resourceType !== "r2") return;
    let cancelled = false;
    setR2Loading(true);
    setR2Error("");
    void getR2PlaybackUrl(item.stepKey)
      .then((result) => {
        if (!cancelled) setR2Url(result.url);
      })
      .catch((error) => {
        if (!cancelled)
          setR2Error(
            error instanceof Error ? error.message : "Não foi possível liberar esta aula.",
          );
      })
      .finally(() => {
        if (!cancelled) setR2Loading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  async function persistProgress(seconds: number, ended = false) {
    if (!item) return;
    const effectiveDuration = duration ?? (item.durationMinutes ? item.durationMinutes * 60 : null);
    await saveProgress({
      data: {
        stepKey: item.stepKey,
        currentSeconds: Math.floor(seconds),
        durationSeconds: effectiveDuration ? Math.floor(effectiveDuration) : null,
        ended,
      },
    });
    if (ended) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["journey-content-library"] }),
        queryClient.invalidateQueries({ queryKey: ["journey-study", stepKey] }),
      ]);
    }
  }

  if (query.isLoading)
    return <main className="inner-page journey-content-state">Carregando conteúdo…</main>;
  if (query.isError || !item)
    return (
      <main className="inner-page journey-content-state">
        <LockKeyhole size={34} />
        <h1>Conteúdo indisponível</h1>
        <p>Este conteúdo não pertence à sua turma ou ainda não foi liberado.</p>
        <button type="button" onClick={onBack}>
          Voltar para Minha jornada
        </button>
      </main>
    );

  if (
    (item.format === "questionnaire" || item.format === "form") &&
    (item.resourceType === "rise_assessment" ||
      /perfil comportamental|mapeamento comportamental/i.test(item.title))
  )
    return <RiseAssessmentExperience stepKey={item.stepKey} onBack={onBack} />;

  if (
    (item.format === "questionnaire" || item.format === "form") &&
    !item.questionnaireId &&
    item.questionnaireUrl
  )
    return (
      <main className="inner-page questionnaire-page recorded-background">
        <div className="page-width">
          <button className="recorded-back" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> Minha jornada
          </button>
          <header>
            <span className="eyebrow eyebrow--gold">
              MÊS {item.monthNumber} · {item.pillarName}
            </span>
            <h1>{item.title}</h1>
            <p>{item.description}</p>
          </header>
          <iframe
            title={item.title}
            src={item.questionnaireUrl}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </main>
    );

  return (
    <main className="inner-page recorded-lesson recorded-background">
      <div className="page-width">
        <nav className="lesson-breadcrumb" aria-label="Caminho da aula">
          <button type="button" onClick={onBack}>
            Minha jornada
          </button>
          <span>/</span>
          <span>
            Mês {item.monthNumber} · {item.pillarName}
          </span>
          <span>/</span>
          <strong>{item.title}</strong>
        </nav>
        <header className="recorded-lesson__title">
          <div>
            <span className="eyebrow eyebrow--gold">
              MÊS {item.monthNumber} · {item.pillarName}
            </span>
            <h1>{item.title}</h1>
            <p>
              {item.responsibleName || "Mentoria RISE NOW"}
              {item.durationMinutes ? (
                <>
                  <i /> <Clock3 size={15} /> {item.durationMinutes} min
                </>
              ) : null}
              <i /> {typeLabel(item)}
            </p>
          </div>
          <span className={`lesson-status ${study.data?.completed ? "is-complete" : ""}`}>
            {study.data?.completed ? <CheckCircle2 size={17} /> : <Play size={15} />}
            {study.data?.completed ? "Concluída" : "Em andamento"}
          </span>
        </header>
        <div className="recorded-lesson__workspace">
          <section className="recorded-lesson__main">
            {(item.resourceType === "r2" || item.mediaUrl) ? (
              <div className="recorded-player">
              {item.resourceType === "r2" && r2Loading ? (
                <div className="recorded-player__empty">
                  <span className="eyebrow eyebrow--gold">Acesso privado</span>
                  <h2>Preparando sua aula…</h2>
                  <p>A RISE está validando seu acesso ao vídeo no Cloudflare.</p>
                </div>
              ) : item.resourceType === "r2" && r2Error ? (
                <div className="recorded-player__empty">
                  <VideoOff size={36} />
                  <span className="eyebrow eyebrow--gold">Acesso indisponível</span>
                  <h2>Não foi possível liberar este vídeo.</h2>
                  <p>{r2Error}</p>
                </div>
              ) : (item.resourceType === "r2" ? r2Url : item.mediaUrl) ? (
                <RecordedPlayer
                  url={(item.resourceType === "r2" ? r2Url : item.mediaUrl) ?? ""}
                  initialTime={study.data?.currentSeconds ?? item.currentSeconds}
                  onEnded={() => void persistProgress(currentTime, true)}
                  onTime={(seconds) => {
                    setCurrentTime(seconds);
                    if (seconds - lastSaved.current >= 10) {
                      lastSaved.current = seconds;
                      void persistProgress(seconds);
                    }
                  }}
                  onDuration={setDuration}
                  onController={setPlayer}
                />
              ) : (
                <div className="recorded-player__empty">
                  <VideoOff size={36} />
                  <span className="eyebrow eyebrow--gold">Em breve</span>
                  <h2>Esta gravação ainda não foi publicada.</h2>
                  <p>Nenhum player é simulado enquanto o vídeo não estiver disponível.</p>
                </div>
              )}
              </div>
            ) : null}
            <section className="lesson-summary">
              <h2>
                <FileText size={22} /> Resumo executivo
              </h2>
              <p>{item.summary || item.description}</p>
            </section>
            <section className="lesson-details-grid">
              <div>
                <h2>Principais temas</h2>
                {item.topics.length ? (
                  <ul>
                    {item.topics.map((topic) => (
                      <li key={topic}>
                        <span>✦</span> {topic}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Os temas serão publicados junto com a aula.</p>
                )}
              </div>
              <div>
                <h2>Materiais de apoio</h2>
                {item.materials.length ? (
                  <div className="journey-materials">
                    {item.materials.map((material) => (
                      <a
                        key={material.id}
                        href={material.fileUrl ?? material.url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={18} /> {material.title} <Download size={16} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p>Nenhum material vinculado.</p>
                )}
              </div>
            </section>
            {item.questionnaireId && item.questionnaire?.questions?.length ? (
              <StageQuestionnaire
                contentId={item.questionnaireId}
                questions={item.questionnaire.questions}
              />
            ) : null}
          </section>
          <JourneyNotebook item={item} currentTime={currentTime} player={player} />
        </div>
        <footer className="lesson-navigation">
          <button
            type="button"
            disabled={!query.data?.previous}
            onClick={() => query.data?.previous && onNavigate(query.data.previous)}
          >
            <ArrowLeft size={18} /> Aula anterior
          </button>
          <button
            type="button"
            disabled={!query.data?.next}
            onClick={() => query.data?.next && onNavigate(query.data.next)}
          >
            Próxima aula <ArrowRight size={18} />
          </button>
        </footer>
      </div>
    </main>
  );
}
