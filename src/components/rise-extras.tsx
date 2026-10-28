import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  CalendarPlus,
  Check,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Moon,
  Paperclip,
  Plus,
  Sun,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { SectionHero } from "@/components/section-hero";
import { getMentorDirectory } from "@/lib/mentor-directory.functions";
import { applyRiseTheme, normalizeRiseTheme } from "@/lib/theme";

/* ================= Calendar ================= */

export type CalEvent = {
  title: string;
  description?: string | null;
  start: string;
  end: string;
  joinUrl?: string | null;
  mentor?: string | null;
};

const gcalDate = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function details(ev: CalEvent) {
  return [
    ev.mentor ? `Mentora: ${ev.mentor}` : "",
    ev.description ?? "",
    ev.joinUrl ? `Google Meet: ${ev.joinUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function googleCalendarUrl(ev: CalEvent) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `RISE NOW · ${ev.title}`,
    dates: `${gcalDate(ev.start)}/${gcalDate(ev.end)}`,
    details: details(ev),
    ctz: "America/Sao_Paulo",
  });
  if (ev.joinUrl) p.set("location", ev.joinUrl);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function downloadIcs(ev: CalEvent) {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RISE NOW//PT-BR",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@risenow`,
    `DTSTAMP:${gcalDate(new Date().toISOString())}`,
    `DTSTART:${gcalDate(ev.start)}`,
    `DTEND:${gcalDate(ev.end)}`,
    `SUMMARY:${esc(`RISE NOW · ${ev.title}`)}`,
    `DESCRIPTION:${esc(details(ev))}`,
    ev.joinUrl ? `LOCATION:${esc(ev.joinUrl)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Encontro RISE NOW",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "encontro-rise-now.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CalendarButtons({ ev }: { ev: CalEvent }) {
  return (
    <div className="x-cal">
      <a className="x-cal__btn" href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">
        <CalendarPlus size={15} /> Adicionar ao Google Agenda
      </a>
      <button className="x-cal__btn" type="button" onClick={() => downloadIcs(ev)}>
        <Download size={15} /> Baixar convite
      </button>
    </div>
  );
}

/* ================= Materials ================= */

type Material = {
  id: string;
  kind: "link" | "file";
  title: string;
  description: string | null;
  url: string | null;
  file_path: string | null;
};

function useMaterials(target: {
  lessonId?: string | null | undefined;
  meetingId?: string | null | undefined;
}) {
  const key = target.lessonId ?? target.meetingId ?? "";
  return useQuery({
    queryKey: ["materials", key],
    enabled: !!key,
    queryFn: async () => {
      let q = supabase
        .from("lesson_materials")
        .select("id, kind, title, description, url, file_path")
        .order("created_at");
      q = target.lessonId
        ? q.eq("lesson_id", target.lessonId)
        : q.eq("meeting_id", target.meetingId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });
}

async function openMaterial(m: Material) {
  if (m.kind === "link" && m.url) return void window.open(m.url, "_blank", "noopener");
  if (!m.file_path) return;
  const { data } = await supabase.storage.from("materials").createSignedUrl(m.file_path, 300);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
}

function MaterialCard({ m, action }: { m: Material; action?: ReactNode }) {
  return (
    <article className="x-mat">
      <span className="x-mat__icon">
        {m.kind === "link" ? <Link2 size={18} /> : <FileText size={18} />}
      </span>
      <div className="x-mat__body">
        <strong>{m.title}</strong>
        {m.description ? <p>{m.description}</p> : null}
      </div>
      <button className="x-mat__open" type="button" onClick={() => void openMaterial(m)}>
        {m.kind === "link" ? (
          <>
            Abrir <ExternalLink size={14} />
          </>
        ) : (
          <>
            Baixar <Download size={14} />
          </>
        )}
      </button>
      {action}
    </article>
  );
}

export function MaterialsList({
  lessonId,
  meetingId,
  emptyText,
}: {
  lessonId?: string | null | undefined;
  meetingId?: string | null | undefined;
  emptyText?: boolean;
}) {
  const { data = [], isLoading } = useMaterials({ lessonId, meetingId });
  if (isLoading) return null;
  if (!data.length)
    return emptyText ? (
      <div className="materials-empty">
        <FileText size={22} />
        <div>
          <strong>Os materiais estão sendo preparados.</strong>
          <p>PDFs, modelos e links aparecerão aqui.</p>
        </div>
      </div>
    ) : null;
  return (
    <div className="x-mats">
      {data.map((m) => (
        <MaterialCard key={m.id} m={m} />
      ))}
    </div>
  );
}

export function MaterialsManager({
  lessonId,
  meetingId,
  label,
  onClose,
}: {
  lessonId?: string | null | undefined;
  meetingId?: string | null | undefined;
  label: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data = [] } = useMaterials({ lessonId, meetingId });
  const [kind, setKind] = useState<"link" | "file">("link");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const key = lessonId ?? meetingId;

  async function add() {
    setMsg("");
    if (title.trim().length < 2) return setMsg("Dê um título ao material.");
    if (kind === "link" && !/^https?:\/\//.test(url))
      return setMsg("O link precisa começar com https://");
    if (kind === "file" && !file) return setMsg("Escolha um arquivo.");
    setBusy(true);
    try {
      let file_path: string | null = null;
      if (kind === "file" && file) {
        const safe = file.name.replace(/[^\w.-]+/g, "_");
        file_path = `${key}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from("materials").upload(file_path, file);
        if (error) throw error;
      }
      const { error } = await supabase.from("lesson_materials").insert({
        lesson_id: lessonId ?? null,
        meeting_id: meetingId ?? null,
        kind,
        title: title.trim(),
        description: desc.trim() || null,
        url: kind === "link" ? url : null,
        file_path,
      });
      if (error) throw error;
      setTitle("");
      setDesc("");
      setUrl("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["materials", key] });
    } catch {
      setMsg("Não foi possível salvar. Tente novamente (arquivos até 50 MB).");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: Material) {
    if (!window.confirm(`Remover "${m.title}"?`)) return;
    if (m.file_path) await supabase.storage.from("materials").remove([m.file_path]);
    await supabase.from("lesson_materials").delete().eq("id", m.id);
    await qc.invalidateQueries({ queryKey: ["materials", key] });
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Materiais de apoio"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">{label}</span>
          <h2>Materiais de apoio</h2>
          {data.length ? (
            <div className="x-mats">
              {data.map((m) => (
                <MaterialCard
                  key={m.id}
                  m={m}
                  action={
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Remover"
                      onClick={() => void remove(m)}
                    >
                      <Trash2 size={16} />
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="ops-muted">Nenhum material ainda.</p>
          )}
          <div className="x-seg">
            <button
              type="button"
              className={kind === "link" ? "is-active" : ""}
              onClick={() => setKind("link")}
            >
              <Link2 size={15} /> Link
            </button>
            <button
              type="button"
              className={kind === "file" ? "is-active" : ""}
              onClick={() => setKind("file")}
            >
              <Paperclip size={15} /> Arquivo
            </button>
          </div>
          <label className="ops-field">
            <span>Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Apresentação do encontro"
            />
          </label>
          <label className="ops-field">
            <span>Descrição (opcional)</span>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          {kind === "link" ? (
            <label className="ops-field">
              <span>Link</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </label>
          ) : (
            <label className="ops-field">
              <span>Arquivo (PDF, apresentação, planilha)</span>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {msg ? <p className="form-message">{msg}</p> : null}
          <button
            className="button button--primary"
            type="button"
            disabled={busy}
            onClick={() => void add()}
          >
            <Plus size={16} /> {busy ? "Salvando..." : "Adicionar material"}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ================= RISE 90 ================= */

type Goal = {
  id: string;
  title: string;
  description: string | null;
  metric: string | null;
  deadline: string | null;
  progress_pct: number;
  position: number;
  created_at: string;
  milestones: { id: string; title: string; done: boolean; position: number }[];
};

function useGoals(enrollmentId: string | null) {
  return useQuery({
    queryKey: ["rise90", enrollmentId],
    enabled: !!enrollmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rise90_goals")
        .select(
          "id, title, description, metric, deadline, progress_pct, position, created_at, milestones:rise90_milestones(id, title, done, position)",
        )
        .eq("enrollment_id", enrollmentId!)
        .order("position")
        .order("created_at");
      if (error) throw error;
      return ((data ?? []) as unknown as Goal[]).map((g) => ({
        ...g,
        milestones: [...g.milestones].sort((a, b) => a.position - b.position),
      }));
    },
  });
}

function cycle(goals: Goal[]) {
  if (!goals.length) return { day: 0, left: 90, pct: 0 };
  const start = Math.min(...goals.map((g) => Date.parse(g.created_at)));
  const day = Math.min(90, Math.max(1, Math.floor((Date.now() - start) / 86400000) + 1));
  const pct = Math.round(goals.reduce((s, g) => s + g.progress_pct, 0) / goals.length);
  return { day, left: 90 - day, pct };
}

function CycleRuler({ goals }: { goals: Goal[] }) {
  const c = cycle(goals);
  return (
    <section className="x-ruler page-width">
      <div className="x-ruler__head">
        <div>
          <Target size={22} />
          <span>Dia</span>
          <strong>
            {c.day || "0"} <small>de 90</small>
          </strong>
        </div>
        <div>
          <span>Faltam</span>
          <strong>
            {c.left} <small>dias</small>
          </strong>
        </div>
        <div>
          <span>Progresso geral</span>
          <strong>{c.pct}%</strong>
        </div>
      </div>
      <div className="x-ruler__track">
        <span className="x-ruler__days" style={{ width: `${(c.day / 90) * 100}%` }} />
      </div>
      <div className="x-bar">
        <span style={{ width: `${c.pct}%` }} />
      </div>
    </section>
  );
}

function GoalEditor({
  enrollmentId,
  goal,
  position,
  onDone,
}: {
  enrollmentId: string;
  goal: Goal | null;
  position: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [desc, setDesc] = useState(goal?.description ?? "");
  const [metric, setMetric] = useState(goal?.metric ?? "");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [msg, setMsg] = useState("");
  async function save() {
    if (title.trim().length < 2) return setMsg("Dê um título à meta.");
    const row = {
      title: title.trim(),
      description: desc.trim() || null,
      metric: metric.trim() || null,
      deadline: deadline || null,
    };
    const { error } = goal
      ? await supabase.from("rise90_goals").update(row).eq("id", goal.id)
      : await supabase
          .from("rise90_goals")
          .insert({ ...row, enrollment_id: enrollmentId, position });
    if (error) return setMsg("Não foi possível salvar.");
    await qc.invalidateQueries({ queryKey: ["rise90", enrollmentId] });
    onDone();
  }
  async function remove() {
    if (!goal || !window.confirm("Excluir esta meta?")) return;
    await supabase.from("rise90_goals").delete().eq("id", goal.id);
    await qc.invalidateQueries({ queryKey: ["rise90", enrollmentId] });
    onDone();
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onDone()}
    >
      <section
        className="content-modal ops-modal goal-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Meta"
      >
        <button className="modal-close" type="button" onClick={onDone} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="goal-editor__brand" aria-label="RISE NOW">
            <img
              className="goal-editor__logo goal-editor__logo--dark"
              src="/brand/rise-logo-white-app.webp"
              alt=""
            />
            <img
              className="goal-editor__logo goal-editor__logo--light"
              src="/brand/rise-logo-light-app.webp"
              alt=""
            />
          </span>
          <h2>{goal ? "Editar meta" : "Nova meta"}</h2>
          <label className="ops-field">
            <span>Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Conduzir reuniões estratégicas"
            />
          </label>
          <label className="ops-field">
            <span>Descrição</span>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label className="ops-field">
            <span>Indicador de sucesso</span>
            <input
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="Como vou saber que cheguei lá?"
            />
          </label>
          <label className="ops-field">
            <span>Prazo final</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          {msg ? <p className="form-message">{msg}</p> : null}
          <div className="x-row">
            <button className="button button--primary" type="button" onClick={() => void save()}>
              Salvar meta
            </button>
            {goal ? (
              <button className="button button--glass" type="button" onClick={() => void remove()}>
                Excluir
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function GoalCard({
  goal,
  enrollmentId,
  editable,
  onEdit,
}: {
  goal: Goal;
  enrollmentId: string;
  editable: boolean;
  onEdit?: () => void;
}) {
  const qc = useQueryClient();
  const [pct, setPct] = useState(goal.progress_pct);
  const [newMs, setNewMs] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setPct(goal.progress_pct), [goal.progress_pct]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["rise90", enrollmentId] });

  function changePct(v: number) {
    setPct(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await supabase.from("rise90_goals").update({ progress_pct: v }).eq("id", goal.id);
      void refresh();
    }, 500);
  }
  async function addMs() {
    if (!newMs.trim()) return;
    await supabase
      .from("rise90_milestones")
      .insert({ goal_id: goal.id, title: newMs.trim(), position: goal.milestones.length });
    setNewMs("");
    void refresh();
  }
  async function toggle(id: string, done: boolean) {
    await supabase.from("rise90_milestones").update({ done }).eq("id", id);
    void refresh();
  }
  async function removeMs(id: string) {
    await supabase.from("rise90_milestones").delete().eq("id", id);
    void refresh();
  }

  return (
    <article className="goal-card x-goal">
      <div className="goal-card__copy">
        <span>OBJETIVO</span>
        <h2>{goal.title}</h2>
        {goal.description ? <p>{goal.description}</p> : null}
        <div className="x-goal__meta">
          {goal.metric ? <small>Indicador: {goal.metric}</small> : null}
          {goal.deadline ? (
            <small>Prazo: {new Date(`${goal.deadline}T12:00`).toLocaleDateString("pt-BR")}</small>
          ) : null}
        </div>
      </div>
      <div className="goal-card__number">
        <strong>{pct}%</strong>
        {editable ? (
          <button type="button" className="x-link" onClick={onEdit}>
            Editar
          </button>
        ) : null}
      </div>
      <div className="x-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      {editable ? (
        <input
          className="x-range"
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => changePct(Number(e.target.value))}
          aria-label="Evolução"
        />
      ) : null}
      <div className="x-ms">
        <span className="x-ms__label">Marcos de vitória</span>
        {goal.milestones.map((m) => (
          <div key={m.id} className={`x-ms__item ${m.done ? "is-done" : ""}`}>
            <button
              type="button"
              disabled={!editable}
              onClick={() => void toggle(m.id, !m.done)}
              aria-label="Concluir marco"
            >
              {m.done ? <Check size={13} /> : null}
            </button>
            <span>{m.title}</span>
            {editable ? (
              <button
                type="button"
                className="x-ms__del"
                onClick={() => void removeMs(m.id)}
                aria-label="Remover marco"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
        ))}
        {!goal.milestones.length && !editable ? (
          <small className="ops-muted">Nenhum marco ainda.</small>
        ) : null}
        {editable ? (
          <div className="x-ms__add">
            <input
              value={newMs}
              onChange={(e) => setNewMs(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addMs()}
              placeholder="Novo marco..."
            />
            <button type="button" onClick={() => void addMs()} aria-label="Adicionar marco">
              <Plus size={15} />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function GuidanceNotes({ enrollmentId }: { enrollmentId: string }) {
  type GuidanceNote = {
    id: string;
    content: string;
    visibility: "shared" | "mentor_private";
    created_at: string;
    author: { full_name: string | null } | null;
  };
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [shared, setShared] = useState(true);
  const { data = [] } = useQuery({
    queryKey: ["rise90-notes", enrollmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select(
          "id, content, visibility, created_at, author:profiles!notes_author_id_fkey(full_name)",
        )
        .eq("enrollment_id", enrollmentId)
        .is("lesson_id", null)
        .in("visibility", ["shared", "mentor_private"])
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as GuidanceNote[];
    },
  });
  async function add() {
    if (!text.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("notes").insert({
      enrollment_id: enrollmentId,
      author_id: u.user.id,
      content: text.trim(),
      visibility: shared ? "shared" : "mentor_private",
    });
    setText("");
    await qc.invalidateQueries({ queryKey: ["rise90-notes", enrollmentId] });
  }
  return (
    <section className="x-notes">
      <h3>Notas de orientação</h3>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Registre uma orientação executiva..."
      />
      <div className="x-row">
        <label className="x-check">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />{" "}
          Mostrar para a aluna
        </label>
        <button className="button button--primary" type="button" onClick={() => void add()}>
          Salvar nota
        </button>
      </div>
      {data.map((n) => (
        <article key={n.id} className="x-note">
          <small>
            {n.author?.full_name ?? "Equipe"} · {new Date(n.created_at).toLocaleDateString("pt-BR")}{" "}
            · {n.visibility === "shared" ? "Visível para a aluna" : "Confidencial"}
          </small>
          <p>{n.content}</p>
        </article>
      ))}
    </section>
  );
}

function SharedGuidance({ enrollmentId }: { enrollmentId: string }) {
  type SharedGuidanceNote = {
    id: string;
    content: string;
    created_at: string;
    author: { full_name: string | null } | null;
  };
  const { data = [] } = useQuery({
    queryKey: ["rise90-shared", enrollmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("id, content, created_at, author:profiles!notes_author_id_fkey(full_name)")
        .eq("enrollment_id", enrollmentId)
        .is("lesson_id", null)
        .eq("visibility", "shared")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as SharedGuidanceNote[];
    },
  });
  if (!data.length) return null;
  return (
    <section className="x-notes page-width">
      <h3>Orientações da sua mentora</h3>
      {data.map((n) => (
        <article key={n.id} className="x-note">
          <small>
            {n.author?.full_name ?? "Mentora"} ·{" "}
            {new Date(n.created_at).toLocaleDateString("pt-BR")}
          </small>
          <p>{n.content}</p>
        </article>
      ))}
    </section>
  );
}

export function Rise90Live({ enrollmentId }: { enrollmentId: string }) {
  const { data: goals = [], isLoading } = useGoals(enrollmentId);
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  return (
    <main className="inner-page inner-page--section-hero rise90-page">
      <SectionHero
        section="RISE 90"
        phrase="Noventa dias de intenção consistente transformam o seu próximo nível"
      />
      <CycleRuler goals={goals} />
      <section className="goal-list page-width">
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            enrollmentId={enrollmentId}
            editable
            onEdit={() => setEditing(g)}
          />
        ))}
        {!isLoading && goals.length < 3 ? (
          <button type="button" className="x-goal-add" onClick={() => setEditing("new")}>
            <Plus size={22} />
            <strong>{goals.length ? "Adicionar meta" : "Definir minha primeira meta"}</strong>
            <span>{3 - goals.length} de 3 disponíveis · o ciclo começa na primeira meta</span>
          </button>
        ) : null}
      </section>
      <SharedGuidance enrollmentId={enrollmentId} />
      {editing ? (
        <GoalEditor
          enrollmentId={enrollmentId}
          goal={editing === "new" ? null : editing}
          position={goals.length}
          onDone={() => setEditing(null)}
        />
      ) : null}
    </main>
  );
}

export function Rise90StaffContent({ enrollmentId, name }: { enrollmentId: string; name: string }) {
  const { data: goals = [], isLoading, isError, refetch } = useGoals(enrollmentId);
  if (isLoading) return <div className="assessment-loading">Carregando RISE 90…</div>;
  if (isError)
    return (
      <div className="assessment-empty">
        <Target size={32} />
        <h2>Não foi possível carregar o RISE 90</h2>
        <p>A conexão não foi concluída. Tente novamente sem sair desta página.</p>
        <button type="button" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  return (
    <div className="rise90-staff-content">
      <span className="eyebrow eyebrow--gold">RISE 90</span>
      <h2>{name}</h2>
      <MenteeContactCard enrollmentId={enrollmentId} />
      <CycleRuler goals={goals} />
      <div className="goal-list">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} enrollmentId={enrollmentId} editable={false} />
        ))}
        {!goals.length ? (
          <p className="ops-muted">Ela ainda não definiu as metas do ciclo.</p>
        ) : null}
      </div>
      <GuidanceNotes enrollmentId={enrollmentId} />
    </div>
  );
}

export function Rise90StaffDrawer({
  enrollmentId,
  name,
  onClose,
}: {
  enrollmentId: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="content-modal ops-modal x-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`RISE 90 de ${name}`}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body">
          <Rise90StaffContent enrollmentId={enrollmentId} name={name} />
        </div>
      </section>
    </div>
  );
}

/* ================= Notifications ================= */

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({ onNavigate }: { onNavigate: (link: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as Notif[];
    },
  });
  const unread = data.filter((n) => !n.read_at);
  async function markAll() {
    if (!unread.length) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        unread.map((n) => n.id),
      );
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  }
  async function go(n: Notif) {
    if (!n.read_at)
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    setOpen(false);
    if (n.link) onNavigate(n.link);
  }
  return (
    <div className="x-bell">
      <button
        className="icon-button notification-button"
        type="button"
        aria-label="Notificações"
        onClick={() => setOpen(!open)}
      >
        <Bell size={20} />
        {unread.length ? <span /> : null}
      </button>
      {open ? (
        <div className="x-bell__panel">
          <div className="x-bell__head">
            <strong>Avisos</strong>
            <button type="button" onClick={() => void markAll()} disabled={!unread.length}>
              Marcar todas como lidas
            </button>
          </div>
          {data.length ? (
            data.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`x-bell__item ${n.read_at ? "" : "is-unread"}`}
                onClick={() => void go(n)}
              >
                <strong>{n.title}</strong>
                {n.body ? <span>{n.body}</span> : null}
                <small>
                  {new Date(n.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </button>
            ))
          ) : (
            <p className="ops-muted x-bell__empty">Nenhum aviso por enquanto.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ================= Profile ================= */

export type ThemePreference = "dark" | "light";

export type MyProfile = {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string;
  title: string | null;
  avatar_url: string | null;
  phone: string | null;
  contact_email: string | null;
  mentor_summary: string | null;
  profession: string | null;
  profession_visible: boolean;
  theme_preference: ThemePreference;
};

export function useMyProfile(enabled = true) {
  return useQuery({
    queryKey: ["my-profile"],
    enabled,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, email, display_name, full_name, title, avatar_url, phone, contact_email, mentor_summary, profession, profession_visible, theme_preference",
        )
        .eq("id", userId)
        .maybeSingle();
      return (data as MyProfile | null) ?? null;
    },
  });
}

export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null | undefined;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return url && !failed ? (
    <img
      className="x-avatar"
      src={url}
      alt={name}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="profile-avatar x-avatar" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

type CropPosition = { x: number; y: number };
type CropDimensions = { width: number; height: number };

function AvatarCropEditor({
  file,
  onCancel,
  onSave,
}: {
  file: File;
  onCancel: () => void;
  onSave: (file: File) => Promise<void>;
}) {
  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; origin: CropPosition } | null>(null);
  const [imageSize, setImageSize] = useState<CropDimensions | null>(null);
  const [stageSize, setStageSize] = useState<CropDimensions>({ width: 0, height: 0 });
  const [position, setPosition] = useState<CropPosition>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [cropError, setCropError] = useState("");

  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const { width, height } = stage.getBoundingClientRect();
      setStageSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Start in "contain" mode: the entire uploaded photo is visible.
  const baseScale =
    imageSize && stageSize.width && stageSize.height
      ? Math.min(
          (stageSize.width - 24) / imageSize.width,
          (stageSize.height - 24) / imageSize.height,
        )
      : 0;
  const baseWidth = imageSize ? imageSize.width * baseScale : 0;
  const baseHeight = imageSize ? imageSize.height * baseScale : 0;
  const cropDiameter = Math.max(
    0,
    Math.floor(
      Math.min(
        stageSize.width * 0.68,
        stageSize.height * 0.78,
        baseWidth * 0.92,
        baseHeight * 0.92,
      ),
    ),
  );

  function keepInsidePhoto(next: CropPosition, nextZoom = zoom): CropPosition {
    const limitX = Math.max(0, (baseWidth * nextZoom - cropDiameter) / 2);
    const limitY = Math.max(0, (baseHeight * nextZoom - cropDiameter) / 2);
    return {
      x: Math.max(-limitX, Math.min(limitX, next.x)),
      y: Math.max(-limitY, Math.min(limitY, next.y)),
    };
  }

  useEffect(() => {
    // Keep the selection inside the image when the editor is resized.
    setPosition((current) => {
      const limitX = Math.max(0, (baseWidth * zoom - cropDiameter) / 2);
      const limitY = Math.max(0, (baseHeight * zoom - cropDiameter) / 2);
      const x = Math.max(-limitX, Math.min(limitX, current.x));
      const y = Math.max(-limitY, Math.min(limitY, current.y));
      return x === current.x && y === current.y ? current : { x, y };
    });
  }, [baseWidth, baseHeight, cropDiameter, zoom]);

  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setPosition(
      keepInsidePhoto({
        x: dragRef.current.origin.x + event.clientX - dragRef.current.x,
        y: dragRef.current.origin.y + event.clientY - dragRef.current.y,
      }),
    );
  }

  async function crop() {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight || !baseScale || !cropDiameter) return;
    setSaving(true);
    setCropError("");
    try {
      const imageScale = baseScale * zoom;
      const sourceSize = Math.min(
        cropDiameter / imageScale,
        image.naturalWidth,
        image.naturalHeight,
      );
      // Use the same geometry as the visible circular guide.
      const sourceX = Math.max(
        0,
        Math.min(
          image.naturalWidth - sourceSize,
          (image.naturalWidth - sourceSize) / 2 - position.x / imageScale,
        ),
      );
      const sourceY = Math.max(
        0,
        Math.min(
          image.naturalHeight - sourceSize,
          (image.naturalHeight - sourceSize) / 2 - position.y / imageScale,
        ),
      );
      const outputSize = 512;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.88),
      );
      if (!blob) throw new Error("Não foi possível gerar a imagem");
      await onSave(new File([blob], "avatar.webp", { type: "image/webp" }));
    } catch {
      setCropError("Não foi possível recortar esta foto. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop avatar-crop-backdrop" role="presentation">
      <section className="content-modal avatar-crop-modal" role="dialog" aria-modal="true">
        <div className="content-modal__body">
          <span className="eyebrow eyebrow--gold">Foto de perfil</span>
          <h2>Ajuste o enquadramento</h2>
          <p>
            Veja a foto inteira e arraste para posicioná-la dentro do círculo. Use o zoom se
            precisar.
          </p>
          <div
            ref={stageRef}
            className="avatar-crop-stage"
            onPointerDown={(event) => {
              if (saving || !cropDiameter) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { x: event.clientX, y: event.clientY, origin: position };
            }}
            onPointerMove={move}
            onPointerUp={(event) => {
              dragRef.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => (dragRef.current = null)}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Prévia da nova foto"
              draggable={false}
              onLoad={(event) =>
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              style={{
                width: baseWidth * zoom,
                height: baseHeight * zoom,
                opacity: baseScale ? 1 : 0,
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
              }}
            />
            <span
              className="avatar-crop-guide"
              style={{ width: cropDiameter, height: cropDiameter }}
              aria-hidden="true"
            />
          </div>
          <label className="avatar-zoom">
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              aria-label="Zoom da foto"
              value={zoom}
              onChange={(event) => {
                const nextZoom = Number(event.target.value);
                setZoom(nextZoom);
                setPosition((current) => keepInsidePhoto(current, nextZoom));
              }}
            />
            <span className="avatar-zoom__value">{Math.round(zoom * 100)}%</span>
          </label>
          {cropError ? (
            <p className="avatar-crop-error" role="alert">
              {cropError}
            </p>
          ) : null}
          <div className="content-modal__actions">
            <button
              className="button button--glass"
              type="button"
              onClick={onCancel}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => void crop()}
              disabled={saving || !cropDiameter}
            >
              {saving ? "Salvando…" : "Salvar foto"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

const waLink = (phone: string) =>
  `https://wa.me/${phone.replace(/\D/g, "").replace(/^(?!55)(\d{10,11})$/, "55$1")}`;

export function ContactButtons({ phone, email }: { phone?: string | null; email?: string | null }) {
  if (!phone && !email) return null;
  return (
    <div className="x-contact">
      {phone ? (
        <a href={waLink(phone)} target="_blank" rel="noreferrer">
          WhatsApp · {phone}
        </a>
      ) : null}
      {email ? <a href={`mailto:${email}`}>{email}</a> : null}
    </div>
  );
}

export function ProfileModal({
  role,
  onClose,
}: {
  role: "mentee" | "mentor" | "admin";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: p } = useMyProfile();
  const [form, setForm] = useState({
    display_name: "",
    full_name: "",
    title: "",
    phone: "",
    contact_email: "",
    mentor_summary: "",
    profession: "",
    profession_visible: false,
    theme_preference: "dark" as ThemePreference,
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  useEffect(() => {
    if (p)
      setForm({
        display_name: p.display_name ?? p.full_name ?? "",
        full_name: p.full_name ?? "",
        title: p.title ?? "",
        phone: p.phone ?? "",
        contact_email: p.contact_email ?? "",
        mentor_summary: p.mentor_summary ?? "",
        profession: p.profession ?? "",
        profession_visible: p.profession_visible ?? false,
        theme_preference: normalizeRiseTheme(p.theme_preference),
      });
  }, [p, role]);
  if (!p) return null;
  const currentProfile = p;
  const set =
    (
      k:
        | "display_name"
        | "full_name"
        | "title"
        | "phone"
        | "contact_email"
        | "mentor_summary"
        | "profession",
    ) =>
    (e: { target: { value: string } }) =>
      setForm({ ...form, [k]: e.target.value });

  function preparePhoto(file: File) {
    if (!file.type.startsWith("image/")) return setMsg("Escolha uma imagem (JPG ou PNG).");
    if (file.size > 5 * 1024 * 1024) return setMsg("A foto precisa ter até 5 MB.");
    setMsg("");
    setPhotoFile(file);
  }
  async function uploadPhoto(file: File) {
    setBusy(true);
    const path = `${currentProfile.id}/${Date.now()}.webp`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setBusy(false);
      return setMsg("Não foi possível enviar a foto.");
    }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", currentProfile.id);
    if (profileError) {
      setBusy(false);
      return setMsg("A foto foi enviada, mas o perfil não pôde ser atualizado.");
    }
    qc.setQueryData<MyProfile | null>(["my-profile"], (current) =>
      current ? { ...current, avatar_url: url } : current,
    );
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["directory"] }),
      qc.invalidateQueries({ queryKey: ["mentor-directory"] }),
      qc.invalidateQueries({ queryKey: ["mentee-public-profile"] }),
    ]);
    setBusy(false);
    setPhotoFile(null);
    setMsg("Foto atualizada.");
  }
  async function selectTheme(theme: ThemePreference) {
    setForm((current) => ({ ...current, theme_preference: theme }));
    applyRiseTheme(theme);
    setMsg("");
    const { error } = await supabase
      .from("profiles")
      .update({ theme_preference: theme })
      .eq("id", currentProfile.id);
    if (error) {
      setMsg("O tema foi aplicado neste dispositivo, mas não foi possível sincronizá-lo.");
      return;
    }
    qc.setQueryData<MyProfile | null>(["my-profile"], (current) =>
      current ? { ...current, theme_preference: theme } : current,
    );
    setMsg("Tema sincronizado no seu perfil.");
  }
  async function save() {
    setMsg("");
    if (form.display_name.trim().length < 2)
      return setMsg("Informe o nome que aparecerá na plataforma.");
    if (form.full_name.trim().length < 2) return setMsg("Informe seu nome completo.");
    if (form.contact_email && !/^\S+@\S+\.\S+$/.test(form.contact_email))
      return setMsg("Email de contato inválido.");
    if (role !== "mentee" && form.mentor_summary.trim().length > 600)
      return setMsg("O texto de apresentação precisa ter no máximo 600 caracteres.");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim(),
        full_name: form.full_name.trim(),
        title: form.title.trim() || null,
        phone: form.phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        mentor_summary:
          role === "mentee" ? currentProfile.mentor_summary : form.mentor_summary.trim() || null,
        profession: form.profession.trim() || null,
        profession_visible: form.profession_visible,
        theme_preference: form.theme_preference,
      })
      .eq("id", currentProfile.id);
    setBusy(false);
    if (error) return setMsg("Não foi possível salvar.");
    qc.setQueryData<MyProfile | null>(["my-profile"], (current) =>
      current ? { ...current, ...form, theme_preference: form.theme_preference } : current,
    );
    applyRiseTheme(form.theme_preference);
    setMsg("Perfil salvo.");
    void qc.invalidateQueries();
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Meu perfil"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">Configurações</span>
          <h2>Meu perfil</h2>
          <fieldset className="x-theme-picker">
            <legend>Fundo da plataforma</legend>
            <div>
              <button
                type="button"
                className={form.theme_preference === "dark" ? "is-active" : ""}
                aria-pressed={form.theme_preference === "dark"}
                onClick={() => void selectTheme("dark")}
              >
                <Moon size={17} /> Escuro
                <span>#26312F</span>
              </button>
              <button
                type="button"
                className={form.theme_preference === "light" ? "is-active" : ""}
                aria-pressed={form.theme_preference === "light"}
                onClick={() => void selectTheme("light")}
              >
                <Sun size={17} /> Claro
                <span>#FFFFFF</span>
              </button>
            </div>
          </fieldset>
          <div className="x-profile-photo">
            <Avatar
              name={form.display_name || form.full_name || p.full_name}
              url={p.avatar_url}
              size={88}
            />
            <label className="button button--glass">
              {busy ? "Enviando..." : p.avatar_url ? "Trocar foto" : "Enviar foto"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && preparePhoto(e.target.files[0])}
              />
            </label>
          </div>
          <label className="ops-field">
            <span>Nome visível na plataforma</span>
            <input value={form.display_name} onChange={set("display_name")} />
          </label>
          <label className="ops-field">
            <span>
              Nome completo <small>Privado · somente você e a administração</small>
            </span>
            <input value={form.full_name} onChange={set("full_name")} />
          </label>
          <label className="ops-field">
            <span>
              Email <small>Privado · somente você e a administração</small>
            </span>
            <input value={p.email} readOnly disabled />
          </label>
          <label className="ops-field">
            <span>
              Telefone{" "}
              <small>
                {role === "mentee"
                  ? "Privado · somente você e a administração"
                  : "Contato profissional"}
              </small>
            </span>
            <input value={form.phone} onChange={set("phone")} placeholder="(11) 99999-9999" />
          </label>
          {role === "mentee" ? (
            <>
              <label className="ops-field">
                <span>Profissão</span>
                <input
                  value={form.profession}
                  onChange={set("profession")}
                  placeholder="Ex.: Diretora Comercial"
                />
              </label>
              <button
                className={`x-visibility-toggle ${form.profession_visible ? "is-active" : ""}`}
                type="button"
                role="switch"
                aria-checked={form.profession_visible}
                onClick={() => setForm({ ...form, profession_visible: !form.profession_visible })}
              >
                <span>
                  <strong>Mostrar profissão na plataforma</strong>
                  <small>Quando ativada, aparece logo abaixo do seu nome.</small>
                </span>
                <i aria-hidden="true">
                  <b />
                </i>
              </button>
            </>
          ) : (
            <>
              <label className="ops-field">
                <span>Cargo ou especialidade</span>
                <input
                  value={form.title}
                  onChange={set("title")}
                  placeholder="Ex.: Mentora de Identidade"
                />
              </label>
              <label className="ops-field">
                <span>Email de contato</span>
                <input type="email" value={form.contact_email} onChange={set("contact_email")} />
              </label>
              <label className="ops-field">
                <span>
                  O que abordamos <small>Visível para as mentoradas</small>
                </span>
                <textarea
                  value={form.mentor_summary}
                  onChange={set("mentor_summary")}
                  maxLength={600}
                  rows={4}
                  placeholder="Conte, de forma breve, os temas e resultados trabalhados na sua frente."
                />
                <small>{form.mentor_summary.length}/600 caracteres</small>
              </label>
            </>
          )}
          <p className="x-privacy">
            {role === "mentee"
              ? "Seu nome completo, email e telefone ficam visíveis somente para você e para a administração da RISE NOW."
              : "Sua foto, nome, especialidade e contatos ficam visíveis para as mentoradas."}
          </p>
          {msg ? <p className="form-message">{msg}</p> : null}
          <button
            className="button button--primary"
            type="button"
            disabled={busy}
            onClick={() => void save()}
          >
            Salvar perfil
          </button>
        </div>
      </section>
      {photoFile ? (
        <AvatarCropEditor
          file={photoFile}
          onCancel={() => setPhotoFile(null)}
          onSave={uploadPhoto}
        />
      ) : null}
    </div>
  );
}

export function MentorsView() {
  const loadMentors = useServerFn(getMentorDirectory);
  const directory = useQuery({
    queryKey: ["mentor-directory"],
    queryFn: () => loadMentors(),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return (
    <main className="inner-page inner-page--section-hero mentor-directory-page">
      <SectionHero
        section="Mentoras"
        phrase="Quatro frentes que caminham com você em cada movimento"
      />
      <section className="page-width mentor-directory" aria-live="polite">
        <div className="section-heading">
          <div>
            <h2>Quem caminha com você</h2>
            <p>Conheça cada frente e fale diretamente com a mentora responsável.</p>
          </div>
        </div>
        {directory.isLoading ? <p className="ops-muted">Carregando mentoras…</p> : null}
        {directory.isError ? (
          <div className="mentor-directory__state" role="alert">
            <p>Não foi possível carregar os contatos agora.</p>
            <button
              className="button button--glass"
              type="button"
              onClick={() => void directory.refetch()}
            >
              Tentar novamente
            </button>
          </div>
        ) : null}
        {directory.data ? (
          <div className="x-mentors">
            {directory.data.mentors.map((mentor) => (
              <article key={mentor.id} className="x-mentor">
                <div className="x-mentor__identity">
                  <Avatar name={mentor.name} url={mentor.avatarUrl} size={88} />
                  <div>
                    <strong>{mentor.name}</strong>
                    <small>Mentora de {mentor.pillar}</small>
                    <ContactButtons phone={mentor.phone} email={mentor.email} />
                  </div>
                </div>
                <div className="x-mentor__summary">
                  <span>O que abordamos</span>
                  <p>{mentor.summary}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export function MenteeContactCard({ enrollmentId }: { enrollmentId: string }) {
  const { data } = useQuery({
    queryKey: ["mentee-public-profile", enrollmentId],
    queryFn: async () => {
      const { data } = await supabase.rpc("mentee_public_profile", {
        _enrollment_id: enrollmentId,
      });
      return data?.[0] ?? null;
    },
  });
  if (!data) return null;
  return (
    <div className="x-mentee-card">
      <Avatar name={data.display_name} url={data.avatar_url} size={56} />
      <div>
        <strong>{data.display_name}</strong>
        {data.profession_visible && data.profession ? <small>{data.profession}</small> : null}
      </div>
    </div>
  );
}
