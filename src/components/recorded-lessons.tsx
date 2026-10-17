import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  CheckCircle2,
  Clock3,
  FileText,
  Italic,
  Link2,
  List,
  ListOrdered,
  LockKeyhole,
  NotebookPen,
  Play,
  Plus,
  Underline,
  VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MaterialsList } from "@/components/rise-extras";
import type { Trail, TrailLesson } from "@/components/rise-trail";
import { supabase } from "@/integrations/supabase/client";

type PlayerController = {
  seek: (seconds: number) => void;
  canSeek: boolean;
};

type Marker = {
  id: string;
  timestamp_seconds: number;
  reflection: string;
  created_at: string;
};

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function embedFor(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt)
    return {
      type: "youtube" as const,
      src: `https://www.youtube.com/embed/${yt[1]}?enablejsapi=1&rel=0`,
    };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: "vimeo" as const, src: `https://player.vimeo.com/video/${vm[1]}?api=1` };
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive)
    return { type: "frame" as const, src: `https://drive.google.com/file/d/${drive[1]}/preview` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: "video" as const, src: url };
  return { type: "frame" as const, src: url };
}

function RecordedPlayer({
  url,
  onEnded,
  onTime,
  onController,
}: {
  url: string;
  onEnded: () => void;
  onTime: (seconds: number) => void;
  onController: (controller: PlayerController) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const embed = useMemo(() => embedFor(url), [url]);
  const ended = useRef(onEnded);
  const time = useRef(onTime);
  ended.current = onEnded;
  time.current = onTime;

  useEffect(() => {
    const canSeek = embed.type !== "frame";
    onController({
      canSeek,
      seek(seconds) {
        if (embed.type === "video" && video.current) {
          video.current.currentTime = seconds;
          void video.current.play();
        } else if (embed.type === "youtube") {
          frame.current?.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
            "*",
          );
        } else if (embed.type === "vimeo") {
          frame.current?.contentWindow?.postMessage(
            JSON.stringify({ method: "setCurrentTime", value: seconds }),
            "*",
          );
        }
      },
    });
  }, [embed.type, onController]);

  useEffect(() => {
    if (embed.type === "video" || embed.type === "frame") return;
    function onMessage(event: MessageEvent) {
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const message = data as {
        event?: string;
        info?: number | { currentTime?: number };
        data?: { seconds?: number };
        value?: number;
        method?: string;
      };
      if (embed.type === "youtube") {
        if (message.event === "onStateChange" && message.info === 0) ended.current();
        if (message.event === "infoDelivery" && typeof message.info === "object") {
          const current = message.info.currentTime;
          if (typeof current === "number") time.current(current);
        }
      }
      if (embed.type === "vimeo") {
        if (message.event === "ended") ended.current();
        if (message.event === "timeupdate" && typeof message.data?.seconds === "number")
          time.current(message.data.seconds);
        if (message.method === "getCurrentTime" && typeof message.value === "number")
          time.current(message.value);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed.type]);

  if (embed.type === "video")
    return (
      <video
        ref={video}
        className="recorded-player__media"
        src={embed.src}
        controls
        onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)}
        onEnded={onEnded}
      />
    );

  return (
    <iframe
      ref={frame}
      className="recorded-player__media"
      src={embed.src}
      title="Aula gravada"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      onLoad={() => {
        if (embed.type === "youtube") {
          frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*");
          frame.current?.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }),
            "*",
          );
        }
        if (embed.type === "vimeo") {
          for (const value of ["ended", "timeupdate"])
            frame.current?.contentWindow?.postMessage(
              JSON.stringify({ method: "addEventListener", value }),
              "*",
            );
        }
      }}
    />
  );
}

function LessonNotebook({
  lesson,
  trail,
  currentTime,
  player,
}: {
  lesson: TrailLesson;
  trail: Trail;
  currentTime: number;
  player: PlayerController;
}) {
  const [text, setText] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tab, setTab] = useState<"notes" | "markers">("notes");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [marking, setMarking] = useState(false);
  const [markerTime, setMarkerTime] = useState(0);
  const [reflection, setReflection] = useState("");
  const [markerError, setMarkerError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const noteId = useRef<string | null>(null);
  const userId = useRef<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    noteId.current = null;
    userId.current = null;
    setText("");
    setMarkers([]);
    setSaveState("idle");
    if (trail.demo || !trail.enrollmentId) {
      loaded.current = true;
      return;
    }
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      userId.current = auth.user?.id ?? null;
      if (!userId.current) return;
      const [noteResult, markerResult] = await Promise.all([
        supabase
          .from("notes")
          .select("id, content")
          .eq("lesson_id", lesson.id)
          .eq("author_id", userId.current)
          .eq("visibility", "mentee_private")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("lesson_markers")
          .select("id, timestamp_seconds, reflection, created_at")
          .eq("lesson_id", lesson.id)
          .eq("user_id", userId.current)
          .order("timestamp_seconds"),
      ]);
      if (noteResult.data) {
        noteId.current = noteResult.data.id;
        setText(noteResult.data.content);
      }
      if (markerResult.data) setMarkers(markerResult.data);
      loaded.current = true;
    })();
  }, [lesson.id, trail.demo, trail.enrollmentId]);

  useEffect(() => {
    if (!loaded.current || trail.demo || !trail.enrollmentId || !userId.current) return;
    const enrollmentId = trail.enrollmentId;
    const authorId = userId.current;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      let error: { message: string } | null = null;
      if (noteId.current) {
        const result = await supabase
          .from("notes")
          .update({ content: text })
          .eq("id", noteId.current)
          .eq("author_id", authorId);
        error = result.error;
      } else if (text.trim()) {
        const result = await supabase
          .from("notes")
          .insert({
            enrollment_id: enrollmentId,
            lesson_id: lesson.id,
            author_id: authorId,
            visibility: "mentee_private",
            content: text,
          })
          .select("id")
          .single();
        error = result.error;
        noteId.current = result.data?.id ?? null;
      }
      setSaveState(error ? "error" : "saved");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [text, lesson.id, trail.demo, trail.enrollmentId]);

  function formatSelection(before: string, after = before) {
    const field = textarea.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = text.slice(start, end) || "texto";
    const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function startMarker() {
    setMarkerTime(currentTime);
    setReflection("");
    setMarkerError("");
    setMarking(true);
    setTab("markers");
  }

  async function saveMarker() {
    if (!reflection.trim()) {
      setMarkerError("Escreva uma reflexão para este momento.");
      return;
    }
    if (trail.demo || !trail.enrollmentId || !userId.current) {
      setMarkers((items) => [
        ...items,
        {
          id: `demo-marker-${Date.now()}`,
          timestamp_seconds: Math.floor(markerTime),
          reflection: reflection.trim(),
          created_at: new Date().toISOString(),
        },
      ]);
      setMarking(false);
      return;
    }
    const result = await supabase
      .from("lesson_markers")
      .insert({
        enrollment_id: trail.enrollmentId,
        lesson_id: lesson.id,
        user_id: userId.current,
        timestamp_seconds: Math.floor(markerTime),
        reflection: reflection.trim(),
      })
      .select("id, timestamp_seconds, reflection, created_at")
      .single();
    if (result.error || !result.data) {
      setMarkerError("Não foi possível salvar. Tente novamente.");
      return;
    }
    setMarkers((items) =>
      [...items, result.data].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds),
    );
    setMarking(false);
  }

  const stateLabel = trail.demo
    ? "Demonstração: alterações não persistem"
    : saveState === "saving"
      ? "Salvando…"
      : saveState === "saved"
        ? "Salvo automaticamente"
        : saveState === "error"
          ? "Erro ao salvar"
          : "Salvamento automático";

  return (
    <aside className="lesson-notebook" aria-label="Meu Caderno">
      <header className="lesson-notebook__head">
        <div>
          <NotebookPen size={25} />
          <h2>Meu Caderno</h2>
        </div>
        <button
          type="button"
          onClick={startMarker}
          disabled={!lesson.mediaUrl || !player.canSeek}
          title={
            lesson.mediaUrl && !player.canSeek
              ? "Este player não informa o minuto atual"
              : undefined
          }
        >
          <Plus size={17} /> Marcar momento
        </button>
      </header>
      <div className="notebook-editor">
        <textarea
          ref={textarea}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Anote seus insights enquanto acompanha a aula…"
          disabled={!trail.demo && !trail.enrollmentId}
          aria-label="Anotações da aula"
        />
        <div className="notebook-toolbar" aria-label="Formatação das anotações">
          <button type="button" onClick={() => formatSelection("**")} aria-label="Negrito">
            <Bold size={16} />
          </button>
          <button type="button" onClick={() => formatSelection("_")} aria-label="Itálico">
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => formatSelection("<u>", "</u>")}
            aria-label="Sublinhado"
          >
            <Underline size={16} />
          </button>
          <button type="button" onClick={() => formatSelection("\n- ", "")} aria-label="Lista">
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => formatSelection("\n1. ", "")}
            aria-label="Lista numerada"
          >
            <ListOrdered size={16} />
          </button>
          <button
            type="button"
            onClick={() => formatSelection("[", "](https://)")}
            aria-label="Link"
          >
            <Link2 size={16} />
          </button>
        </div>
      </div>
      <div className={`notebook-save notebook-save--${saveState}`}>
        <span /> {stateLabel}
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
          Meus marcadores ({markers.length})
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
                <strong>Momento {formatTime(markerTime)}</strong>
                <textarea
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  placeholder="O que fez sentido para você neste trecho?"
                  autoFocus
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
            {markers.length ? (
              markers.map((marker) => (
                <article className="lesson-marker" key={marker.id}>
                  <button
                    type="button"
                    onClick={() => player.seek(marker.timestamp_seconds)}
                    disabled={!player.canSeek}
                    title={
                      player.canSeek
                        ? "Voltar a este trecho"
                        : "Este player não permite retornar ao trecho"
                    }
                  >
                    <Play size={14} /> {formatTime(marker.timestamp_seconds)}
                  </button>
                  <p>{marker.reflection}</p>
                </article>
              ))
            ) : !marking ? (
              <p className="notebook-empty">
                Use “Marcar momento” para guardar uma reflexão ligada ao vídeo.
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="notebook-private">
        <LockKeyhole size={14} /> Privado: somente você pode acessar este caderno.
      </div>
    </aside>
  );
}

export function RecordedLessonsLibrary({
  trail,
  onOpen,
  onBack,
}: {
  trail: Trail;
  onOpen: (lesson: TrailLesson) => void;
  onBack: () => void;
}) {
  const [month, setMonth] = useState<number | "all">("all");
  const phases = trail.phases
    .map((phase) => ({
      ...phase,
      lessons: phase.lessons.filter((lesson) => lesson.kind === "aula"),
    }))
    .filter((phase) => phase.lessons.length && (month === "all" || phase.month === month));

  return (
    <main className="inner-page recorded-library recorded-background">
      <div className="page-width recorded-library__head">
        <button className="recorded-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Minha jornada
        </button>
        <span className="eyebrow eyebrow--gold">Conteúdo sob demanda</span>
        <h1>Aulas gravadas</h1>
        <p>Reveja os conteúdos da sua jornada, organizados por pilar e mês.</p>
        <div className="recorded-filters" aria-label="Filtrar por mês">
          <button
            type="button"
            className={month === "all" ? "is-active" : ""}
            onClick={() => setMonth("all")}
          >
            Todos
          </button>
          {trail.phases
            .filter((phase) => phase.lessons.some((lesson) => lesson.kind === "aula"))
            .map((phase) => (
              <button
                type="button"
                key={phase.month}
                className={month === phase.month ? "is-active" : ""}
                onClick={() => setMonth(phase.month)}
              >
                Mês {phase.month} · {phase.title}
              </button>
            ))}
        </div>
      </div>
      <div className="page-width recorded-sections">
        {phases.map((phase) => (
          <section className="recorded-section" key={phase.month}>
            <header>
              <span>MÊS {phase.month}</span>
              <h2>{phase.title}</h2>
              <p>{phase.description}</p>
            </header>
            <div className="recorded-grid">
              {phase.lessons.map((lesson, index) => {
                const locked = phase.month > trail.currentMonth && !lesson.completed;
                return (
                  <article className={`recorded-card ${locked ? "is-locked" : ""}`} key={lesson.id}>
                    <div className="recorded-card__cover">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {lesson.mediaUrl ? <Play size={27} /> : <VideoOff size={27} />}
                    </div>
                    <div className="recorded-card__body">
                      <div>
                        <span>
                          {lesson.completed
                            ? "Concluída"
                            : locked
                              ? "Em breve"
                              : lesson.mediaUrl
                                ? "Disponível"
                                : "Aguardando publicação"}
                        </span>
                        <span>
                          <Clock3 size={13} /> {lesson.duration} min
                        </span>
                      </div>
                      <h3>{lesson.title}</h3>
                      <p>{lesson.description}</p>
                      <button type="button" disabled={locked} onClick={() => onOpen(lesson)}>
                        {lesson.completed ? "Rever aula" : "Abrir aula"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export function RecordedLessonPage({
  lesson,
  trail,
  onBack,
  onNavigate,
}: {
  lesson: TrailLesson;
  trail: Trail;
  onBack: () => void;
  onNavigate: (lesson: TrailLesson) => void;
}) {
  const queryClient = useQueryClient();
  const [completed, setCompleted] = useState(lesson.completed);
  const [currentTime, setCurrentTime] = useState(0);
  const [player, setPlayer] = useState<PlayerController>({ canSeek: false, seek: () => undefined });
  const lessons = trail.phases
    .flatMap((phase) => phase.lessons)
    .filter((item) => item.kind === "aula" && (item.month <= trail.currentMonth || item.completed));
  const index = lessons.findIndex((item) => item.id === lesson.id);
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

  useEffect(() => {
    setCompleted(lesson.completed);
    setCurrentTime(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [lesson.id, lesson.completed]);

  async function complete() {
    if (completed) return;
    setCompleted(true);
    if (trail.demo || !trail.enrollmentId) return;
    const result = await supabase.from("lesson_progress").upsert(
      {
        enrollment_id: trail.enrollmentId,
        lesson_id: lesson.id,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,lesson_id" },
    );
    if (result.error) setCompleted(false);
    else {
      void queryClient.invalidateQueries({ queryKey: ["trail"] });
      void queryClient.invalidateQueries({ queryKey: ["next-journey-step"] });
    }
  }

  return (
    <main className="inner-page recorded-lesson recorded-background">
      <div className="page-width">
        <nav className="lesson-breadcrumb" aria-label="Caminho da aula">
          <button type="button" onClick={onBack}>
            Minha jornada
          </button>
          <span>/</span>
          <span>
            Mês {lesson.month} · {lesson.phaseTitle}
          </span>
          <span>/</span>
          <strong>{lesson.title}</strong>
        </nav>
        <header className="recorded-lesson__title">
          <div>
            <span className="eyebrow eyebrow--gold">
              MÊS {lesson.month} · {lesson.phaseTitle}
            </span>
            <h1>{lesson.title}</h1>
            <p>
              {lesson.mentor || "Mentoria RISE NOW"}
              <i /> <Clock3 size={15} /> {lesson.duration} min <i /> Aula gravada
            </p>
          </div>
          <span className={`lesson-status ${completed ? "is-complete" : ""}`}>
            {completed ? <CheckCircle2 size={17} /> : <Play size={15} />}
            {completed ? "Concluída" : "Em andamento"}
          </span>
        </header>
        <div className="recorded-lesson__workspace">
          <section className="recorded-lesson__main">
            <div className="recorded-player">
              {lesson.mediaUrl ? (
                <RecordedPlayer
                  url={lesson.mediaUrl}
                  onEnded={() => void complete()}
                  onTime={setCurrentTime}
                  onController={setPlayer}
                />
              ) : (
                <div className="recorded-player__empty">
                  <VideoOff size={36} />
                  <span className="eyebrow eyebrow--gold">Em preparação</span>
                  <h2>Esta aula estará disponível em breve.</h2>
                  <p>Assim que a gravação for publicada, ela aparecerá aqui.</p>
                </div>
              )}
            </div>
            <section className="lesson-summary">
              <h2>
                <FileText size={22} /> Resumo executivo
              </h2>
              <p>
                {lesson.description || "O resumo desta aula será publicado junto com o conteúdo."}
              </p>
            </section>
            {lesson.topics.length ? (
              <section className="lesson-details-grid">
                <div>
                  <h2>Principais temas</h2>
                  <ul>
                    {lesson.topics.map((topic) => (
                      <li key={topic}>
                        <span>✦</span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2>Materiais de apoio</h2>
                  <MaterialsList lessonId={lesson.id} emptyText />
                </div>
              </section>
            ) : (
              <section className="lesson-summary lesson-summary--materials">
                <h2>Materiais de apoio</h2>
                <MaterialsList lessonId={lesson.id} emptyText />
              </section>
            )}
          </section>
          <LessonNotebook lesson={lesson} trail={trail} currentTime={currentTime} player={player} />
        </div>
        <footer className="lesson-navigation">
          <button
            type="button"
            disabled={!previous}
            onClick={() => previous && onNavigate(previous)}
          >
            <ArrowLeft size={18} /> Aula anterior
          </button>
          <button type="button" disabled={!next} onClick={() => next && onNavigate(next)}>
            Próxima aula <ArrowRight size={18} />
          </button>
        </footer>
      </div>
    </main>
  );
}
