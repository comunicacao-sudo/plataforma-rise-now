import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  Link2,
  LockKeyhole,
  Paperclip,
  Play,
  Radio,
  Send,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { track } from "@/data/rise-track";
import { supabase } from "@/integrations/supabase/client";

export type TrailLesson = {
  id: string;
  title: string;
  kind: "aula" | "encontro";
  format: string | null;
  mentor: string;
  duration: number;
  description: string;
  topics: string[];
  mediaUrl: string | null;
  joinUrl: string | null;
  scheduledAt: string | null;
  month: number;
  phaseTitle: string;
  completed: boolean;
};

export type TrailDeliverable = {
  id: string;
  title: string;
  description: string;
  month: number;
  phaseTitle: string;
  question: string;
  status: SubmissionStatus;
  content: string;
  linkUrl: string;
  filePath: string;
  feedback?: string;
};

export type TrailPhase = {
  month: number;
  title: string;
  pillar: string;
  mentor: string;
  question: string;
  description: string;
  lessons: TrailLesson[];
  deliverable: TrailDeliverable | null;
};

export type SubmissionStatus = "nao_iniciada" | "em_andamento" | "enviada" | "em_revisao" | "concluida";

export const statusLabels: Record<SubmissionStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  enviada: "Enviada",
  em_revisao: "Em revisão",
  concluida: "Concluída",
};

export type Trail = {
  demo: boolean;
  enrollmentId: string | null;
  currentMonth: number;
  progressPct: number;
  phases: TrailPhase[];
};

function demoTrail(): Trail {
  let n = 0;
  const phases = track.map<TrailPhase>((p) => ({
    month: p.month,
    title: p.title,
    pillar: p.pillar,
    mentor: p.mentor,
    question: p.question,
    description: p.description,
    lessons: p.lessons.map((l) => ({
      id: `demo-${n++}`,
      title: l.title,
      kind: l.kind,
      format: l.format ?? null,
      mentor: l.mentor,
      duration: l.duration,
      description: l.description,
      topics: l.topics,
      mediaUrl: null,
      joinUrl: null,
      scheduledAt: null,
      month: p.month,
      phaseTitle: p.title,
      completed: p.month === 1,
    })),
    deliverable: {
      id: `demo-d-${p.month}`,
      title: p.deliverable.title,
      description: p.deliverable.description,
      month: p.month,
      phaseTitle: p.title,
      question: p.question,
      status: p.month === 1 ? "concluida" : p.month === 2 ? "em_andamento" : "nao_iniciada",
      content: "",
      linkUrl: "",
      filePath: "",
    },
  }));
  return { demo: true, enrollmentId: null, currentMonth: 2, progressPct: 28, phases };
}

async function loadTrail(): Promise<Trail> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, program_id, current_month, progress_pct")
    .eq("mentee_id", uid ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let programId = enrollment?.program_id;
  if (!programId) {
    const { data: program } = await supabase.from("programs").select("id").limit(1).maybeSingle();
    programId = program?.id;
  }
  if (!programId) return { demo: false, enrollmentId: null, currentMonth: 1, progressPct: 0, phases: [] };

  const [phasesRes, progressRes, subsRes] = await Promise.all([
    supabase
      .from("phases")
      .select("*, lessons(*), deliverables(*)")
      .eq("program_id", programId)
      .order("month_number"),
    enrollment
      ? supabase.from("lesson_progress").select("lesson_id, completed").eq("enrollment_id", enrollment.id)
      : Promise.resolve({ data: [] as { lesson_id: string; completed: boolean }[] }),
    enrollment
      ? supabase.from("submissions").select("*").eq("enrollment_id", enrollment.id)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  if ("error" in phasesRes && phasesRes.error) throw phasesRes.error;

  const done = new Set((progressRes.data ?? []).filter((r) => r.completed).map((r) => r.lesson_id));
  const subs = new Map(
    ((subsRes.data ?? []) as {
      deliverable_id: string;
      status: SubmissionStatus;
      content: string | null;
      link_url: string | null;
      file_path: string | null;
      feedback: string | null;
    }[]).map((s) => [s.deliverable_id, s]),
  );

  const phases = (phasesRes.data ?? []).map<TrailPhase>((p) => {
    const d = [...(p.deliverables ?? [])].sort((a, b) => a.position - b.position)[0];
    const sub = d ? subs.get(d.id) : undefined;
    return {
      month: p.month_number,
      title: p.title,
      pillar: p.pillar,
      mentor: p.mentor_name ?? "",
      question: p.question ?? "",
      description: p.description ?? "",
      lessons: [...(p.lessons ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({
          id: l.id,
          title: l.title,
          kind: l.kind === "aula" ? "aula" : "encontro",
          format: l.session_format,
          mentor: l.mentor_name ?? "",
          duration: l.duration_minutes ?? 60,
          description: l.description ?? "",
          topics: l.topics ?? [],
          mediaUrl: l.media_url,
          joinUrl: l.join_url,
          scheduledAt: l.scheduled_at,
          month: p.month_number,
          phaseTitle: p.title,
          completed: done.has(l.id),
        })),
      deliverable: d
        ? {
            id: d.id,
            title: d.title,
            description: d.description ?? "",
            month: p.month_number,
            phaseTitle: p.title,
            question: p.question ?? "",
            status: sub?.status ?? "nao_iniciada",
            content: sub?.content ?? "",
            linkUrl: sub?.link_url ?? "",
            filePath: sub?.file_path ?? "",
            feedback: sub?.feedback ?? "",
          }
        : null,
    };
  });

  return {
    demo: false,
    enrollmentId: enrollment?.id ?? null,
    currentMonth: enrollment?.current_month ?? 1,
    progressPct: enrollment?.progress_pct ?? 0,
    phases,
  };
}

export function useTrail(demo: boolean) {
  return useQuery({
    queryKey: ["trail", demo],
    queryFn: () => (demo ? Promise.resolve(demoTrail()) : loadTrail()),
  });
}

export function formatWhen(iso: string | null) {
  if (!iso) return "Data a confirmar";
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function embedFor(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { type: "youtube" as const, src: `https://www.youtube.com/embed/${yt[1]}?enablejsapi=1&rel=0` };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: "vimeo" as const, src: `https://player.vimeo.com/video/${vm[1]}?api=1` };
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return { type: "frame" as const, src: `https://drive.google.com/file/d/${drive[1]}/preview` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: "video" as const, src: url };
  return { type: "frame" as const, src: url };
}

function Player({ url, minutes, onEnded }: { url: string; minutes: number; onEnded: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const embed = embedFor(url);
  const ended = useRef(onEnded);
  ended.current = onEnded;

  useEffect(() => {
    if (embed.type === "video") return;
    const fire = () => ended.current();
    if (embed.type === "frame") {
      // Embedded recordings without a player API complete after 90% of the duration.
      const t = window.setTimeout(fire, minutes * 60_000 * 0.9);
      return () => window.clearTimeout(t);
    }
    function onMessage(e: MessageEvent) {
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const d = data as { event?: string; info?: unknown };
      if (embed.type === "youtube" && d.event === "onStateChange" && d.info === 0) fire();
      if (embed.type === "vimeo" && d.event === "ended") fire();
      if (embed.type === "vimeo" && d.event === "ready")
        frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "addEventListener", value: "ended" }), "*");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed.type, embed.src, minutes]);

  if (embed.type === "video")
    return <video className="lesson-player__media" src={embed.src} controls onEnded={() => onEnded()} />;
  return (
    <iframe
      ref={frame}
      className="lesson-player__media"
      src={embed.src}
      title="Gravação"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      onLoad={() => {
        if (embed.type === "youtube")
          frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*");
      }}
    />
  );
}

function Notebook({ lesson, trail }: { lesson: TrailLesson; trail: Trail }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const noteId = useRef<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    noteId.current = null;
    setText("");
    setState("idle");
    if (trail.demo || !trail.enrollmentId) {
      loaded.current = true;
      return;
    }
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("notes")
        .select("id, content")
        .eq("lesson_id", lesson.id)
        .eq("author_id", auth.user?.id ?? "")
        .eq("visibility", "mentee_private")
        .limit(1)
        .maybeSingle();
      if (data) {
        noteId.current = data.id;
        setText(data.content);
      }
      loaded.current = true;
    })();
  }, [lesson.id, trail.demo, trail.enrollmentId]);

  useEffect(() => {
    if (!loaded.current || trail.demo || !trail.enrollmentId) return;
    const enrollmentId = trail.enrollmentId;
    setState("saving");
    const t = window.setTimeout(async () => {
      if (noteId.current) {
        await supabase.from("notes").update({ content: text }).eq("id", noteId.current);
      } else if (text.trim()) {
        const { data: auth } = await supabase.auth.getUser();
        const { data } = await supabase
          .from("notes")
          .insert({
            enrollment_id: enrollmentId,
            lesson_id: lesson.id,
            author_id: auth.user!.id,
            visibility: "mentee_private",
            content: text,
          })
          .select("id")
          .single();
        noteId.current = data?.id ?? null;
      }
      setState("saved");
    }, 1000);
    return () => window.clearTimeout(t);
  }, [text, lesson.id, trail.demo, trail.enrollmentId]);

  return (
    <section className="lesson-block">
      <div className="lesson-block__head">
        <h3>Caderno de anotações</h3>
        <small>
          {trail.demo
            ? "Na demonstração, as anotações não são salvas"
            : state === "saving"
              ? "Salvando…"
              : state === "saved"
                ? "Salvo"
                : "Salva sozinho enquanto você escreve"}
        </small>
      </div>
      <textarea
        className="notebook"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Seus insights, perguntas e decisões sobre este encontro…"
        disabled={!trail.demo && !trail.enrollmentId}
      />
      <div className="private-note">
        <LockKeyhole size={15} />
        <span>Somente você vê estas anotações. Nem as mentoras têm acesso.</span>
      </div>
    </section>
  );
}

export function LessonScreen({
  lesson,
  trail,
  onClose,
}: {
  lesson: TrailLesson;
  trail: Trail;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [completed, setCompleted] = useState(lesson.completed);

  async function complete() {
    if (completed) return;
    setCompleted(true);
    if (trail.demo || !trail.enrollmentId) return;
    await supabase
      .from("lesson_progress")
      .upsert(
        { enrollment_id: trail.enrollmentId, lesson_id: lesson.id, completed: true, completed_at: new Date().toISOString() },
        { onConflict: "enrollment_id,lesson_id" },
      );
    void qc.invalidateQueries({ queryKey: ["trail"] });
  }

  const endsAt = lesson.scheduledAt
    ? new Date(lesson.scheduledAt).getTime() + lesson.duration * 60_000
    : null;
  const meetingPast = endsAt !== null && Date.now() > endsAt;

  useEffect(() => {
    if (lesson.kind === "encontro" && meetingPast && !lesson.mediaUrl) void complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const label = lesson.kind === "aula" ? "Aula gravada" : `Encontro ${lesson.format ?? ""}`.trim();

  return (
    <div className="lesson-screen" role="dialog" aria-modal="true" aria-label={lesson.title}>
      <div className="lesson-screen__inner page-width">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="lesson-player">
          {lesson.mediaUrl ? (
            <Player url={lesson.mediaUrl} minutes={lesson.duration} onEnded={() => void complete()} />
          ) : lesson.kind === "encontro" ? (
            <div className="lesson-wait">
              <span className="lesson-wait__icon">
                <Radio size={26} />
              </span>
              <span className="eyebrow eyebrow--gold">
                {meetingPast ? "Encontro realizado" : "Sala de espera"}
              </span>
              <h2>{formatWhen(lesson.scheduledAt)}</h2>
              <p>
                {meetingPast
                  ? "A gravação aparecerá aqui assim que for disponibilizada."
                  : lesson.joinUrl
                    ? "Entre alguns minutos antes. A sala abre no Google Meet."
                    : "O link da sala será publicado aqui antes do encontro."}
              </p>
              {lesson.joinUrl && !meetingPast ? (
                <a className="button button--primary" href={lesson.joinUrl} target="_blank" rel="noreferrer">
                  <Video size={18} /> Entrar no Google Meet
                </a>
              ) : null}
            </div>
          ) : (
            <div className="lesson-wait">
              <span className="lesson-wait__icon">
                <Play size={26} />
              </span>
              <span className="eyebrow eyebrow--gold">Em preparação</span>
              <h2>Esta aula estará disponível em breve.</h2>
              <p>Assim que a gravação for publicada, ela aparece aqui.</p>
            </div>
          )}
        </div>

        <div className="lesson-layout">
          <div>
            <span className="eyebrow eyebrow--gold">
              Mês {lesson.month} · {lesson.phaseTitle}
            </span>
            <h1 className="lesson-title">{lesson.title}</h1>
            <div className="content-modal__meta">
              <span>{label}</span>
              <span>
                <Clock3 size={13} /> {lesson.duration} min
              </span>
              <span>{lesson.mentor}</span>
              {completed ? (
                <span className="lesson-done">
                  <CheckCircle2 size={14} /> Concluído
                </span>
              ) : null}
            </div>
            <section className="lesson-block">
              <h3>Resumo executivo</h3>
              <p>{lesson.description}</p>
              {lesson.topics.length ? (
                <ul className="lesson-topics">
                  {lesson.topics.map((t) => (
                    <li key={t}>
                      <span>✦</span> {t}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
            <section className="lesson-block">
              <h3>Materiais de apoio</h3>
              <div className="materials-empty">
                <FileText size={22} />
                <div>
                  <strong>Os materiais deste encontro estão sendo preparados.</strong>
                  <p>PDFs e modelos aparecerão aqui para você baixar.</p>
                </div>
              </div>
            </section>
          </div>
          <Notebook lesson={lesson} trail={trail} />
        </div>
      </div>
    </div>
  );
}

function DeliverableEditor({
  item,
  trail,
  onClose,
}: {
  item: TrailDeliverable;
  trail: Trail;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [content, setContent] = useState(item.content);
  const [link, setLink] = useState(item.linkUrl);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const locked = item.status === "enviada" || item.status === "em_revisao" || item.status === "concluida";

  async function save(status: SubmissionStatus) {
    if (trail.demo || !trail.enrollmentId) {
      setMsg("Na demonstração, as entregas não são salvas.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      let filePath = item.filePath;
      if (file) {
        const { data: auth } = await supabase.auth.getUser();
        const safe = file.name.replace(/[^\w.-]+/g, "_");
        filePath = `${auth.user!.id}/deliverables/${item.id}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("rise-private").upload(filePath, file);
        if (error) throw error;
      }
      const { error } = await supabase.from("submissions").upsert(
        {
          enrollment_id: trail.enrollmentId,
          deliverable_id: item.id,
          status,
          content,
          link_url: link || null,
          file_path: filePath || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "enrollment_id,deliverable_id" },
      );
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["trail"] });
      setMsg(status === "enviada" ? "Entrega enviada para a mentora." : "Rascunho salvo.");
      if (status === "enviada") onClose();
    } catch {
      setMsg("Não foi possível salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function openFile() {
    const { data } = await supabase.storage.from("rise-private").createSignedUrl(item.filePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="content-modal deliverable-editor" role="dialog" aria-modal="true" aria-label={item.title}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body">
          <span className="eyebrow eyebrow--gold">
            Mês {item.month} · {item.phaseTitle}
          </span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <div className={`delivery-status delivery-status--${item.status}`}>{statusLabels[item.status]}</div>
          <label className="field">
            <span>Seu texto</span>
            <textarea
              className="notebook"
              value={content}
              disabled={locked}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva aqui a sua entrega…"
            />
          </label>
          <label className="field">
            <span>
              <Link2 size={14} /> Link (opcional)
            </span>
            <input
              type="url"
              value={link}
              disabled={locked}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="field">
            <span>
              <Paperclip size={14} /> Arquivo (opcional)
            </span>
            <input type="file" disabled={locked} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {item.filePath ? (
            <button className="link-button" type="button" onClick={() => void openFile()}>
              Ver arquivo enviado
            </button>
          ) : null}
          {item.feedback ? (
            <div className="feedback-box">
              <span className="eyebrow eyebrow--gold">Retorno da mentora</span>
              <p>{item.feedback}</p>
            </div>
          ) : null}
          {msg ? <p className="form-message">{msg}</p> : null}
          {locked ? (
            <div className="private-note">
              <LockKeyhole size={15} />
              <span>Esta entrega já foi enviada e está com a mentora.</span>
            </div>
          ) : (
            <div className="content-modal__actions">
              <button className="button button--primary" type="button" disabled={busy} onClick={() => void save("enviada")}>
                <Send size={17} /> Enviar entrega
              </button>
              <button className="button button--glass" type="button" disabled={busy} onClick={() => void save("em_andamento")}>
                Salvar rascunho
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function TrailDeliverables({ trail }: { trail: Trail }) {
  const [open, setOpen] = useState<TrailDeliverable | null>(null);
  const items = trail.phases.map((p) => p.deliverable).filter((d): d is TrailDeliverable => !!d);
  return (
    <>
      <section className="deliverable-grid page-width">
        {items.map((item) => (
          <article className="deliverable-card" key={item.id}>
            <div className="deliverable-card__icon">
              <FileCheck2 size={22} />
            </div>
            <span>
              Mês {item.month} · {item.phaseTitle}
            </span>
            <h2>{item.title}</h2>
            <p>{item.question}</p>
            <div className={`delivery-status delivery-status--${item.status}`}>{statusLabels[item.status]}</div>
            <button type="button" onClick={() => setOpen(item)}>
              Abrir entrega <ChevronRight size={17} />
            </button>
          </article>
        ))}
      </section>
      {open ? <DeliverableEditor item={open} trail={trail} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

export function TrailAgenda({ trail, onOpen }: { trail: Trail; onOpen: (l: TrailLesson) => void }) {
  const meetings = trail.phases.flatMap((p) => p.lessons.filter((l) => l.kind === "encontro"));
  return (
    <section className="event-list page-width">
      {meetings.map((m) => {
        const d = m.scheduledAt ? new Date(m.scheduledAt) : null;
        return (
          <article className="event-row" key={m.id}>
            <div className="event-row__date">
              {d ? (
                <>
                  <strong>{String(d.getDate()).padStart(2, "0")}</strong>
                  <span>{d.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</span>
                </>
              ) : (
                <>
                  <CalendarDays size={20} />
                  <span>MÊS {m.month}</span>
                </>
              )}
            </div>
            <div className="event-row__line" />
            <div className="event-row__content">
              <span>
                {m.format ?? "Encontro"} {m.completed ? "· Concluído" : ""}
              </span>
              <h2>{m.title}</h2>
              <p>
                {m.mentor} · {d ? formatWhen(m.scheduledAt) : "Data a confirmar"}
              </p>
            </div>
            <button
              className={`button ${m.joinUrl ? "button--primary" : "button--glass"}`}
              type="button"
              onClick={() => onOpen(m)}
            >
              {m.joinUrl ? "Entrar na sala" : "Ver detalhes"}
              <ChevronRight size={16} />
            </button>
          </article>
        );
      })}
    </section>
  );
}
