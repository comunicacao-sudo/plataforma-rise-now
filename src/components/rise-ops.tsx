import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  ExternalLink,
  FileCheck2,
  FileText,
  Link2,
  LockKeyhole,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  cancelMeeting,
  createMeeting,
  disconnectGoogle,
  googleStatus,
  startGoogleConnect,
  updateMeeting,
} from "@/lib/google.functions";
import {
  createMentorSpecialty,
  createMember,
  getDirectory,
  type RiseDirectory,
  updateAccess,
  updateEnrollment,
} from "@/lib/admin.functions";
import {
  Avatar,
  CalendarButtons,
  MaterialsList,
  MaterialsManager,
  Rise90StaffContent,
} from "@/components/rise-extras";
import { JourneyAdmin } from "@/components/journey-admin";
import { JourneyContentAdmin } from "@/components/journey-content-admin";
import { AssessmentMentorContent } from "@/components/rise-assessment";
import { WhatsAppAdmin } from "@/components/whatsapp-admin";
import { getMyAgendaMaterials } from "@/lib/content.functions";

/* ---------- shared ---------- */

export type StaffView =
  | "painel"
  | "gestao-jornada"
  | "conteudos"
  | "agenda"
  | "entregas"
  | "alunas"
  | "turmas-acessos"
  | "whatsapp";

const statusLabels: Record<string, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  enviada: "Enviada",
  em_revisao: "Em revisão",
  concluida: "Concluída",
};

const enrollmentLabels: Record<string, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  desativada: "Desativada",
};

type MeetingRow = {
  id: string;
  title: string;
  description: string | null;
  kind: "grupo" | "individual";
  audience: string;
  scheduled_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  join_url: string | null;
  recording_url: string | null;
  mentor_name: string | null;
  cohort_id: string | null;
  google_event_id: string | null;
  phase: { month_number: number; title: string; pillar: string } | null;
};

function useMeetings() {
  return useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(
          "id, title, description, kind, audience, scheduled_at, ends_at, duration_minutes, join_url, recording_url, mentor_name, cohort_id, google_event_id, phase:phases(month_number, title, pillar)",
        )
        .order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as unknown as MeetingRow[];
    },
  });
}

function useDirectory() {
  const fn = useServerFn(getDirectory);
  return useQuery({ queryKey: ["directory"], queryFn: () => fn() });
}

function endOf(m: MeetingRow) {
  return m.ends_at
    ? Date.parse(m.ends_at)
    : Date.parse(m.scheduled_at) + (m.duration_minutes ?? 60) * 60000;
}

function Intro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="page-intro page-width">
      <span className="eyebrow eyebrow--gold">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ops-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/* ---------- meeting card (shared mentee + staff) ---------- */

function MeetingCard({
  m,
  actions,
  showMaterials,
}: {
  m: MeetingRow;
  actions?: ReactNode;
  showMaterials?: boolean;
}) {
  const start = new Date(m.scheduled_at);
  const now = Date.now();
  const live = now >= start.getTime() - 15 * 60000 && now <= endOf(m);
  const past = now > endOf(m);
  return (
    <article className={`ops-meeting ${live ? "is-live" : ""}`}>
      <div className="ops-meeting__date">
        <strong>{String(start.getDate()).padStart(2, "0")}</strong>
        <span>
          {start.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}
        </span>
      </div>
      <div className="ops-meeting__body">
        <span className="ops-meeting__meta">
          {m.kind === "individual" ? "Sessão 1:1" : "Encontro coletivo"}
          {m.phase ? ` · Mês ${m.phase.month_number} · ${m.phase.pillar}` : ""}
          {live ? <em> · Acontecendo agora</em> : null}
        </span>
        <h3>{m.title}</h3>
        <p>
          {start.toLocaleString("pt-BR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
          {m.mentor_name ? ` · ${m.mentor_name}` : ""}
        </p>
      </div>
      <div className="ops-meeting__actions">
        {past ? (
          m.recording_url ? (
            <a
              className="button button--glass"
              href={m.recording_url}
              target="_blank"
              rel="noreferrer"
            >
              <Video size={16} /> Ver gravação
            </a>
          ) : (
            <span className="ops-muted">Gravação em breve</span>
          )
        ) : m.join_url ? (
          <a
            className={`button ${live ? "button--primary x-pulse" : "button--glass"}`}
            href={m.join_url}
            target="_blank"
            rel="noreferrer"
          >
            Entrar no Google Meet <ExternalLink size={15} />
          </a>
        ) : (
          <span className="ops-muted">Link em breve</span>
        )}
        {actions}
      </div>
      {!past ? (
        <div className="ops-meeting__extra">
          <CalendarButtons
            ev={{
              title: m.title,
              description: m.description,
              start: m.scheduled_at,
              end: new Date(endOf(m)).toISOString(),
              joinUrl: m.join_url,
              mentor: m.mentor_name,
            }}
          />
        </div>
      ) : null}
      {showMaterials ? (
        <div className="ops-meeting__extra">
          <MaterialsList meetingId={m.id} />
        </div>
      ) : null}
    </article>
  );
}

/* ---------- mentee ---------- */

export function MenteeMeetings() {
  const { data = [], isLoading } = useMeetings();
  const now = Date.now();
  const upcoming = data.filter((m) => endOf(m) >= now);
  const past = data.filter((m) => endOf(m) < now).reverse();
  if (isLoading) return null;
  return (
    <section className="page-width ops-section">
      <div className="section-heading">
        <div>
          <h2>Próximos encontros</h2>
          <p>Clique para entrar direto na sala do Google Meet.</p>
        </div>
      </div>
      {upcoming.length ? (
        <div className="ops-list">
          {upcoming.map((m) => (
            <MeetingCard key={m.id} m={m} showMaterials />
          ))}
        </div>
      ) : (
        <p className="ops-empty">
          Nenhum encontro agendado ainda. Assim que a sua mentora marcar, ele aparece aqui.
        </p>
      )}
      {past.length ? (
        <>
          <div className="section-heading ops-gap">
            <div>
              <h2>Encontros realizados</h2>
              <p>Reveja as gravações quando estiverem disponíveis.</p>
            </div>
          </div>
          <div className="ops-list">
            {past.map((m) => (
              <MeetingCard key={m.id} m={m} showMaterials />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function MenteeAgendaMaterials() {
  const load = useServerFn(getMyAgendaMaterials);
  const { data, isLoading } = useQuery({
    queryKey: ["agenda-materials"],
    queryFn: () => load(),
  });
  const items = data?.items ?? [];

  if (isLoading) return null;

  return (
    <section className="page-width ops-section">
      <div className="section-heading ops-gap">
        <div>
          <h2>Materiais disponíveis</h2>
          <p>Arquivos e links liberados para você em cada etapa da jornada.</p>
        </div>
      </div>
      {items.length ? (
        <div className="x-mats">
          {items.map((item) => (
            <article className="x-mat" key={item.id}>
              <span className="x-mat__icon">
                {item.externalUrl ? <Link2 size={18} /> : <FileText size={18} />}
              </span>
              <div className="x-mat__body">
                <strong>{item.title}</strong>
                <p>
                  Mês {item.monthNumber} · {item.pillarName} · {item.stepTitle}
                </p>
                {item.description ? <small>{item.description}</small> : null}
              </div>
              {item.fileUrl || item.externalUrl ? (
                <a
                  className="x-mat__open"
                  href={item.fileUrl ?? item.externalUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.fileUrl ? "Baixar" : "Abrir"} <ExternalLink size={14} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="ops-empty">Nenhum material disponível no momento.</p>
      )}
    </section>
  );
}

export function NextMeetingBanner({ onAgenda }: { onAgenda: () => void }) {
  const { data = [] } = useMeetings();
  const next = data.find((m) => endOf(m) >= Date.now());
  if (!next) return null;
  return (
    <section className="page-width ops-section">
      <div className="section-heading">
        <div>
          <h2>Seu próximo encontro</h2>
        </div>
        <button type="button" onClick={onAgenda}>
          Ver agenda
        </button>
      </div>
      <MeetingCard m={next} />
    </section>
  );
}

/* ---------- google ---------- */

function waitForOAuth(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
    };
    const onMessage = (e: MessageEvent) => {
      const t = e.data?.type;
      if (
        e.origin !== window.location.origin ||
        e.source !== popup ||
        e.data?.connectorId !== "google_calendar"
      )
        return;
      if (t !== "riseGoogleOAuthComplete" && t !== "riseGoogleOAuthFailed") return;
      cleanup();
      if (t === "riseGoogleOAuthComplete")
        resolve(typeof e.data?.code === "string" ? e.data.code : null);
      else reject(new Error("failed"));
    };
    window.addEventListener("message", onMessage);
    const poll = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("closed"));
      }
    }, 500);
  });
}

export function GoogleCalendarCard({ audience = "staff" }: { audience?: "staff" | "mentee" }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(googleStatus);
  const startFn = useServerFn(startGoogleConnect);
  const disconnectFn = useServerFn(disconnectGoogle);
  const { data, isLoading } = useQuery({
    queryKey: ["google-status"],
    queryFn: () => statusFn(),
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect() {
    const popup = window.open("", "rise-google", "width=600,height=720");
    if (!popup) return setMsg("Libere as janelas pop-up do navegador e tente de novo.");
    setBusy(true);
    setMsg("");
    try {
      const { authorizationUrl } = await startFn();
      const done = waitForOAuth(popup);
      popup.location.href = authorizationUrl;
      await done;
      await qc.invalidateQueries({ queryKey: ["google-status"] });
      setMsg(
        data?.reconnectRequired || data?.connected
          ? "Google reconectado."
          : "Google Agenda conectado.",
      );
    } catch {
      popup.close();
      setMsg("A conexão não foi concluída. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    await disconnectFn();
    await qc.invalidateQueries({ queryKey: ["google-status"] });
    setBusy(false);
    setMsg("Google desconectado.");
  }

  return (
    <article className="admin-card ops-google">
      <div className="section-heading">
        <div>
          <h2>Google Agenda</h2>
          <p>
            {isLoading
              ? "Verificando…"
              : data?.connected
                ? audience === "staff"
                  ? `Conectado${data.email ? ` · ${data.email}` : ""}. Os encontros que você marcar já criam o evento, o link do Meet e enviam os convites.`
                  : `Conectado${data.email ? ` · ${data.email}` : ""}. Seus encontros RISE podem ser acompanhados na sua agenda pessoal.`
                : data?.reconnectRequired
                  ? "Sua conexão com o Google precisa ser renovada."
                  : audience === "staff"
                    ? "Conecte sua conta para criar os eventos, os convites e os links do Meet automaticamente."
                    : "Conecte sua conta pessoal para acompanhar os encontros RISE no Google Agenda."}
          </p>
        </div>
      </div>
      <div className="ops-row">
        {data?.connected ? (
          <button
            className="button button--glass"
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            Desconectar
          </button>
        ) : (
          <button
            className="button button--primary"
            type="button"
            disabled={busy || isLoading}
            onClick={() => void connect()}
          >
            {data?.reconnectRequired ? <RefreshCw size={16} /> : <CalendarDays size={16} />}
            {data?.reconnectRequired ? "Reconectar Google" : "Conectar Google Agenda"}
          </button>
        )}
        {msg ? <span className="form-message">{msg}</span> : null}
      </div>
    </article>
  );
}

/* ---------- scheduling ---------- */

function ScheduleForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { data: dir } = useDirectory();
  const createFn = useServerFn(createMeeting);
  const [f, setF] = useState({
    title: "",
    description: "",
    phaseId: "",
    lessonId: "",
    mentorId: "",
    date: "",
    start: "19:00",
    end: "20:00",
    audience: "all" as "all" | "cohort" | "selected",
    cohortId: "",
    enrollmentIds: [] as string[],
    createMeet: true,
    joinUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const phase = dir?.phases.find((p) => p.id === f.phaseId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title || !f.date) return setMsg("Preencha o título e a data.");
    if (f.audience === "cohort" && !f.cohortId) return setMsg("Escolha a turma.");
    if (f.audience === "selected" && !f.enrollmentIds.length)
      return setMsg("Escolha pelo menos uma mentorada.");
    const startsAt = new Date(`${f.date}T${f.start}`);
    const endsAt = new Date(`${f.date}T${f.end}`);
    if (endsAt <= startsAt) return setMsg("O horário de término precisa ser depois do início.");
    setBusy(true);
    setMsg("");
    try {
      const res = await createFn({
        data: {
          title: f.title,
          description: f.description,
          phaseId: f.phaseId || null,
          lessonId: f.lessonId || null,
          mentorId: f.mentorId || null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          audience: f.audience,
          cohortId: f.cohortId || null,
          enrollmentIds: f.audience === "selected" ? f.enrollmentIds : [],
          kind: f.audience === "selected" && f.enrollmentIds.length === 1 ? "individual" : "grupo",
          createMeet: f.createMeet,
          joinUrl: f.createMeet ? null : f.joinUrl || null,
        },
      });
      if (!res.ok) return setMsg(res.error);
      await qc.invalidateQueries({ queryKey: ["meetings"] });
      onDone();
    } catch {
      setMsg("Não foi possível agendar. Confira os dados e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onDone()}
    >
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Agendar encontro"
      >
        <button className="modal-close" type="button" onClick={onDone} aria-label="Fechar">
          <X size={21} />
        </button>
        <form className="content-modal__body ops-form" onSubmit={(e) => void submit(e)}>
          <span className="eyebrow eyebrow--gold">Agenda RISE</span>
          <h2>Agendar encontro</h2>
          <Field label="Título do encontro">
            <input
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex.: RISE Decision Room"
            />
          </Field>
          <div className="ops-grid2">
            <Field label="Mês / pilar">
              <select
                value={f.phaseId}
                onChange={(e) => setF((p) => ({ ...p, phaseId: e.target.value, lessonId: "" }))}
              >
                <option value="">Sem vínculo</option>
                {dir?.phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    Mês {p.month_number} · {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sessão da trilha (opcional)">
              <select
                value={f.lessonId}
                disabled={!phase}
                onChange={(e) => {
                  const l = phase?.lessons.find((x) => x.id === e.target.value);
                  setF((p) => ({
                    ...p,
                    lessonId: e.target.value,
                    title: p.title || l?.title || "",
                  }));
                }}
              >
                <option value="">Nenhuma</option>
                {phase?.lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Mentora responsável">
            <select value={f.mentorId} onChange={(e) => set("mentorId", e.target.value)}>
              <option value="">Escolher…</option>
              {dir?.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="ops-grid3">
            <Field label="Data">
              <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Início">
              <input type="time" value={f.start} onChange={(e) => set("start", e.target.value)} />
            </Field>
            <Field label="Término">
              <input type="time" value={f.end} onChange={(e) => set("end", e.target.value)} />
            </Field>
          </div>
          <Field label="Para quem é">
            <div className="ops-pills">
              {(
                [
                  ["all", "Todas as turmas"],
                  ["cohort", "Uma turma"],
                  ["selected", "Mentoradas escolhidas"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className={f.audience === v ? "is-active" : ""}
                  onClick={() => set("audience", v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>
          {f.audience === "cohort" ? (
            <Field label="Turma">
              <select value={f.cohortId} onChange={(e) => set("cohortId", e.target.value)}>
                <option value="">Escolher…</option>
                {dir?.cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {f.audience === "selected" ? (
            <div className="ops-checks">
              {dir?.enrollments
                .filter((e) => e.status === "ativa")
                .map((e) => (
                  <label key={e.id}>
                    <input
                      type="checkbox"
                      checked={f.enrollmentIds.includes(e.id)}
                      onChange={(ev) =>
                        set(
                          "enrollmentIds",
                          ev.target.checked
                            ? [...f.enrollmentIds, e.id]
                            : f.enrollmentIds.filter((x) => x !== e.id),
                        )
                      }
                    />
                    {e.name}
                  </label>
                ))}
              {!dir?.enrollments.length ? (
                <span className="ops-muted">Nenhuma mentorada cadastrada.</span>
              ) : null}
            </div>
          ) : null}
          <Field label="Descrição (opcional)">
            <textarea
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </Field>
          <label className="ops-toggle">
            <input
              type="checkbox"
              checked={f.createMeet}
              onChange={(e) => set("createMeet", e.target.checked)}
            />
            Gerar reunião no Google Meet e enviar convite pela minha agenda
          </label>
          {!f.createMeet ? (
            <Field label="Link da reunião (opcional)">
              <input
                type="url"
                value={f.joinUrl}
                onChange={(e) => set("joinUrl", e.target.value)}
                placeholder="https://meet.google.com/…"
              />
            </Field>
          ) : null}
          {msg ? <p className="form-message">{msg}</p> : null}
          <div className="content-modal__actions">
            <button className="button button--primary" type="submit" disabled={busy}>
              <CalendarPlus size={17} /> {busy ? "Agendando…" : "Agendar encontro"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RecordingEditor({ m, onDone }: { m: MeetingRow; onDone: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(updateMeeting);
  const [rec, setRec] = useState(m.recording_url ?? "");
  const [join, setJoin] = useState(m.join_url ?? "");
  const [msg, setMsg] = useState("");
  async function save() {
    try {
      await fn({ data: { id: m.id, recordingUrl: rec || null, joinUrl: join || null } });
      await qc.invalidateQueries({ queryKey: ["meetings"] });
      onDone();
    } catch {
      setMsg("Confira se os links começam com https://");
    }
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onDone()}
    >
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Editar links"
      >
        <button className="modal-close" type="button" onClick={onDone} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">{m.title}</span>
          <h2>Links do encontro</h2>
          <Field label="Link da reunião">
            <input type="url" value={join} onChange={(e) => setJoin(e.target.value)} />
          </Field>
          <Field label="Link da gravação">
            <input
              type="url"
              value={rec}
              onChange={(e) => setRec(e.target.value)}
              placeholder="Google Drive, YouTube ou Vimeo"
            />
          </Field>
          {msg ? <p className="form-message">{msg}</p> : null}
          <div className="content-modal__actions">
            <button className="button button--primary" type="button" onClick={() => void save()}>
              Salvar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function LessonMaterialsSection({
  onOpen,
}: {
  onOpen: (l: { lessonId: string; label: string }) => void;
}) {
  const { data = [] } = useQuery({
    queryKey: ["staff-lessons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lessons")
        .select(
          "id, title, kind, position, phase:phases(month_number, pillar), materials:lesson_materials(count)",
        )
        .order("position");
      type LessonMaterialsRow = {
        id: string;
        title: string;
        kind: string;
        position: number;
        phase: { month_number: number; pillar: string } | null;
        materials: Array<{ count: number }> | null;
      };
      return ((data ?? []) as unknown as LessonMaterialsRow[]).sort(
        (a, b) =>
          (a.phase?.month_number ?? 0) - (b.phase?.month_number ?? 0) || a.position - b.position,
      );
    },
  });
  return (
    <section className="page-width ops-section">
      <div className="section-heading ops-gap">
        <div>
          <h2>Materiais da trilha</h2>
          <p>Anexe links e arquivos a cada aula ou encontro da jornada.</p>
        </div>
      </div>
      <div className="x-lessons">
        {data.map((l) => (
          <button
            key={l.id}
            type="button"
            className="x-lesson"
            onClick={() =>
              onOpen({
                lessonId: l.id,
                label: `Mês ${l.phase?.month_number ?? "a definir"} · ${l.title}`,
              })
            }
          >
            <small>
              Mês {l.phase?.month_number ?? "a definir"} · {l.kind === "aula" ? "Aula" : "Encontro"}
            </small>
            <strong>{l.title}</strong>
            <span>
              <Paperclip size={13} /> {l.materials?.[0]?.count ?? 0} material(is)
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function StaffAgenda() {
  const qc = useQueryClient();
  const { data = [] } = useMeetings();
  const { data: dir } = useDirectory();
  const cancelFn = useServerFn(cancelMeeting);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingRow | null>(null);
  const [mats, setMats] = useState<{ lessonId?: string; meetingId?: string; label: string } | null>(
    null,
  );
  const now = Date.now();
  const upcoming = data.filter((m) => endOf(m) >= now);
  const past = data.filter((m) => endOf(m) < now).reverse();
  const audienceLabel = (m: MeetingRow) =>
    m.audience === "all"
      ? "Todas as turmas"
      : m.audience === "cohort"
        ? (dir?.cohorts.find((c) => c.id === m.cohort_id)?.name ?? "Turma")
        : "Mentoradas escolhidas";

  async function cancel(m: MeetingRow) {
    if (!window.confirm(`Cancelar "${m.title}"? As participantes também deixam de ver o evento.`))
      return;
    const r = await cancelFn({ data: { id: m.id } });
    if (r.googleWarning)
      window.alert(
        "O encontro saiu da plataforma, mas não consegui remover o evento do Google. Apague-o na agenda manualmente.",
      );
    await qc.invalidateQueries({ queryKey: ["meetings"] });
  }

  const actions = (m: MeetingRow) => (
    <>
      <span className="ops-tag">{audienceLabel(m)}</span>
      <button
        className="icon-button"
        type="button"
        aria-label="Materiais"
        title="Materiais de apoio"
        onClick={() => setMats({ meetingId: m.id, label: m.title })}
      >
        <Paperclip size={17} />
      </button>
      <button
        className="icon-button"
        type="button"
        aria-label="Editar links"
        onClick={() => setEditing(m)}
      >
        <Video size={17} />
      </button>
      <button
        className="icon-button"
        type="button"
        aria-label="Cancelar encontro"
        onClick={() => void cancel(m)}
      >
        <Trash2 size={17} />
      </button>
    </>
  );

  return (
    <main className="inner-page">
      <Intro
        eyebrow="Agenda"
        title="Encontros da mentoria"
        copy="Marque encontros coletivos ou sessões 1:1. O convite e o link do Meet vão direto para a agenda das participantes."
      />
      <section className="page-width ops-section">
        <GoogleCalendarCard />
        <div className="section-heading ops-gap">
          <div>
            <h2>Próximos encontros</h2>
          </div>
          <button type="button" onClick={() => setOpen(true)}>
            <Plus size={16} /> Agendar encontro
          </button>
        </div>
        {upcoming.length ? (
          <div className="ops-list">
            {upcoming.map((m) => (
              <MeetingCard key={m.id} m={m} actions={actions(m)} />
            ))}
          </div>
        ) : (
          <p className="ops-empty">Nenhum encontro agendado.</p>
        )}
        {past.length ? (
          <>
            <div className="section-heading ops-gap">
              <div>
                <h2>Encontros realizados</h2>
                <p>Use o ícone de vídeo para colar o link da gravação.</p>
              </div>
            </div>
            <div className="ops-list">
              {past.map((m) => (
                <MeetingCard key={m.id} m={m} actions={actions(m)} />
              ))}
            </div>
          </>
        ) : null}
      </section>
      {open ? <ScheduleForm onDone={() => setOpen(false)} /> : null}
      <LessonMaterialsSection onOpen={(l) => setMats(l)} />
      {editing ? <RecordingEditor m={editing} onDone={() => setEditing(null)} /> : null}
      {mats ? (
        <MaterialsManager
          lessonId={mats.lessonId}
          meetingId={mats.meetingId}
          label={mats.label}
          onClose={() => setMats(null)}
        />
      ) : null}
    </main>
  );
}

/* ---------- reviews ---------- */

type SubRow = {
  id: string;
  enrollment_id: string;
  status: string;
  content: string | null;
  link_url: string | null;
  file_path: string | null;
  feedback: string | null;
  submitted_at: string | null;
  updated_at: string;
  deliverable: {
    id: string;
    title: string;
    phase: { month_number: number; title: string } | null;
  } | null;
};

function useSubmissions() {
  return useQuery({
    queryKey: ["staff-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, enrollment_id, status, content, link_url, file_path, feedback, submitted_at, updated_at, deliverable:deliverables(id, title, phase:phases(month_number, title))",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SubRow[];
    },
  });
}

function ReviewScreen({
  sub,
  menteeName,
  onClose,
}: {
  sub: SubRow;
  menteeName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState(sub.feedback ?? "");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const notes = useQuery({
    queryKey: ["mentor-notes", sub.enrollment_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("id, content, created_at")
        .eq("enrollment_id", sub.enrollment_id)
        .eq("visibility", "mentor_private")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Opening a sent delivery moves it into review.
  useEffect(() => {
    if (sub.status === "enviada") {
      void supabase
        .from("submissions")
        .update({ status: "em_revisao" })
        .eq("id", sub.id)
        .then(() => qc.invalidateQueries({ queryKey: ["staff-submissions"] }));
    }
  }, [sub.id, sub.status, qc]);

  async function save(status?: "em_andamento" | "concluida") {
    setBusy(true);
    setMsg("");
    const { data: auth } = await supabase.auth.getUser();
    const patch: {
      feedback: string | null;
      reviewed_by: string | null;
      reviewed_at: string;
      status?: "em_andamento" | "concluida";
    } = {
      feedback: feedback || null,
      reviewed_by: auth.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    };
    if (status) patch.status = status;
    const { error } = await supabase.from("submissions").update(patch).eq("id", sub.id);
    setBusy(false);
    if (error) return setMsg("Não foi possível salvar.");
    await qc.invalidateQueries({ queryKey: ["staff-submissions"] });
    if (status) onClose();
    else setMsg("Retorno salvo.");
  }

  async function addNote() {
    if (!note.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("notes").insert({
      enrollment_id: sub.enrollment_id,
      author_id: auth.user!.id,
      visibility: "mentor_private",
      content: note.trim(),
    });
    if (error) return setMsg("Não foi possível salvar a anotação.");
    setNote("");
    await notes.refetch();
  }

  async function openFile() {
    const { data } = await supabase.storage
      .from("rise-private")
      .createSignedUrl(sub.file_path!, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="content-modal ops-modal ops-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Revisar entrega"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">
            {menteeName} · Mês {sub.deliverable?.phase?.month_number}
          </span>
          <h2>{sub.deliverable?.title}</h2>
          <p className="ops-muted">
            {sub.submitted_at
              ? `Enviada em ${new Date(sub.submitted_at).toLocaleString("pt-BR")}`
              : `Atualizada em ${new Date(sub.updated_at).toLocaleString("pt-BR")}`}
          </p>
          <div className="ops-review-content">
            {sub.content ? (
              <p className="ops-pre">{sub.content}</p>
            ) : (
              <p className="ops-muted">Sem texto.</p>
            )}
            <div className="ops-row">
              {sub.link_url ? (
                <a
                  className="button button--glass"
                  href={sub.link_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir link <ExternalLink size={15} />
                </a>
              ) : null}
              {sub.file_path ? (
                <button
                  className="button button--glass"
                  type="button"
                  onClick={() => void openFile()}
                >
                  Baixar arquivo
                </button>
              ) : null}
            </div>
          </div>
          <Field label="Retorno para a mentorada (ela vê na tela da entrega)">
            <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
          <div className="content-modal__actions">
            <button
              className="button button--primary"
              type="button"
              disabled={busy}
              onClick={() => void save("concluida")}
            >
              <Check size={17} /> Aprovar entrega
            </button>
            <button
              className="button button--glass"
              type="button"
              disabled={busy}
              onClick={() => void save("em_andamento")}
            >
              Solicitar ajustes
            </button>
            <button
              className="button button--glass"
              type="button"
              disabled={busy}
              onClick={() => void save()}
            >
              Salvar retorno
            </button>
          </div>
          {msg ? <p className="form-message">{msg}</p> : null}
          <div className="ops-confidential">
            <div className="private-note">
              <LockKeyhole size={15} />
              <span>Anotações confidenciais · a mentorada nunca vê</span>
            </div>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observações sobre a evolução dela…"
            />
            <button className="button button--glass" type="button" onClick={() => void addNote()}>
              Salvar anotação
            </button>
            {notes.data?.map((n) => (
              <div key={n.id} className="ops-note">
                <small>{new Date(n.created_at).toLocaleString("pt-BR")}</small>
                <p>{n.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReviewPanel() {
  const { data: subs = [] } = useSubmissions();
  const { data: dir } = useDirectory();
  const [cohort, setCohort] = useState("");
  const [mentee, setMentee] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<SubRow | null>(null);
  const byEnrollment = useMemo(
    () => new Map((dir?.enrollments ?? []).map((e) => [e.id, e])),
    [dir],
  );
  const rows = subs.filter((s) => {
    const e = byEnrollment.get(s.enrollment_id);
    if (cohort && e?.cohortId !== cohort) return false;
    if (mentee && s.enrollment_id !== mentee) return false;
    if (month && String(s.deliverable?.phase?.month_number) !== month) return false;
    if (status && s.status !== status) return false;
    return true;
  });
  return (
    <main className="inner-page">
      <Intro
        eyebrow="Avaliação"
        title="Entregas das mentoradas"
        copy="Revise, deixe o seu retorno e aprove cada marco da jornada."
      />
      <section className="page-width ops-section">
        <div className="ops-filters">
          <select value={cohort} onChange={(e) => setCohort(e.target.value)}>
            <option value="">Todas as turmas</option>
            {dir?.cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={mentee} onChange={(e) => setMentee(e.target.value)}>
            <option value="">Todas as mentoradas</option>
            {dir?.enrollments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Todos os meses</option>
            {dir?.phases.map((p) => (
              <option key={p.id} value={String(p.month_number)}>
                Mês {p.month_number} · {p.title}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {rows.length ? (
          <div className="people-table">
            {rows.map((s) => {
              const e = byEnrollment.get(s.enrollment_id);
              return (
                <article key={s.id} className="ops-sub-row" onClick={() => setOpen(s)}>
                  <span className="profile-avatar">
                    {(e?.name ?? "?")
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <strong>{s.deliverable?.title}</strong>
                    <small>
                      {e?.name} · Mês {s.deliverable?.phase?.month_number}
                    </small>
                  </div>
                  <span className={`ops-status ops-status--${s.status}`}>
                    {statusLabels[s.status]}
                  </span>
                  <small className="ops-muted">
                    {new Date(s.submitted_at ?? s.updated_at).toLocaleDateString("pt-BR")}
                  </small>
                  <button
                    type="button"
                    aria-label="Revisar"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(s);
                    }}
                  >
                    <FileCheck2 size={18} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="ops-empty">Nenhuma entrega com esses filtros ainda.</p>
        )}
      </section>
      {open ? (
        <ReviewScreen
          sub={open}
          menteeName={byEnrollment.get(open.enrollment_id)?.name ?? ""}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </main>
  );
}

/* ---------- members & cohorts ---------- */

function CohortForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [msg, setMsg] = useState("");
  async function save() {
    if (!name.trim()) return setMsg("Dê um nome à turma.");
    const { error } = await supabase
      .from("cohorts")
      .insert({ name: name.trim(), starts_on: start || null, ends_on: end || null });
    if (error) return setMsg("Não foi possível criar a turma.");
    await qc.invalidateQueries({ queryKey: ["directory"] });
    onDone();
  }
  return (
    <div className="ops-inline-form">
      <Field label="Nome da turma">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Turma 2, 2027" />
      </Field>
      <Field label="Início">
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Conclusão">
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <button className="button button--primary" type="button" onClick={() => void save()}>
        Criar turma
      </button>
      {msg ? <span className="form-message">{msg}</span> : null}
    </div>
  );
}

function CohortEditor({
  cohort,
  memberCount,
  onDone,
}: {
  cohort: RiseDirectory["cohorts"][number];
  memberCount: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(cohort.name);
  const [start, setStart] = useState(cohort.starts_on ?? "");
  const [end, setEnd] = useState(cohort.ends_on ?? "");
  const [busy, setBusy] = useState<"" | "save" | "delete">("");
  const [msg, setMsg] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return setMsg("Dê um nome à turma.");
    if (start && end && end < start)
      return setMsg("A data final precisa ser igual ou posterior à data inicial.");

    setBusy("save");
    setMsg("");
    const { error } = await supabase
      .from("cohorts")
      .update({
        name: cleanName,
        starts_on: start || null,
        ends_on: end || null,
      })
      .eq("id", cohort.id);

    if (error) {
      setMsg("Não foi possível salvar as alterações da turma.");
      setBusy("");
      return;
    }

    await qc.invalidateQueries({ queryKey: ["directory"] });
    setBusy("");
    onDone();
  }

  async function remove() {
    const detail =
      memberCount > 0
        ? ` Esta turma possui ${memberCount} mentorada(s); elas ficarão sem turma vinculada, mas não serão excluídas.`
        : "";
    if (
      !window.confirm(`Excluir a turma “${cohort.name}”?${detail} Esta ação não pode ser desfeita.`)
    )
      return;

    setBusy("delete");
    setMsg("");
    const { error } = await supabase.from("cohorts").delete().eq("id", cohort.id);

    if (error) {
      setMsg("Não foi possível excluir a turma.");
      setBusy("");
      return;
    }

    await qc.invalidateQueries({ queryKey: ["directory"] });
    setBusy("");
    onDone();
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onDone()}
    >
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${cohort.name}`}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onDone}
          aria-label="Fechar"
          disabled={!!busy}
        >
          <X size={21} />
        </button>
        <form className="content-modal__body ops-form" onSubmit={(event) => void save(event)}>
          <span className="eyebrow eyebrow--gold">Gestão de turmas</span>
          <h2>Editar turma</h2>

          <Field label="Título da turma">
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Turma 1, 2027"
            />
          </Field>

          <div className="ops-grid2">
            <Field label="Data de início">
              <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label="Data de fim">
              <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
            </Field>
          </div>

          <p className="ops-muted">{memberCount} mentorada(s) vinculada(s) a esta turma.</p>
          {msg ? <p className="form-message">{msg}</p> : null}

          <div className="content-modal__actions">
            <button
              className="button button--glass"
              type="button"
              disabled={!!busy}
              onClick={() => void remove()}
            >
              <Trash2 size={17} />
              {busy === "delete" ? "Excluindo…" : "Excluir turma"}
            </button>
            <button className="button button--primary" type="submit" disabled={!!busy}>
              {busy === "save" ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MemberForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { data: dir } = useDirectory();
  const fn = useServerFn(createMember);
  const [f, setF] = useState({
    fullName: "",
    email: "",
    phone: "",
    memberType: "mentee" as "mentee" | "mentor",
    cohortId: "",
    specialtyId: "",
  });
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<{ email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const r = await fn({
        data: {
          ...f,
          phone: f.phone.trim() || null,
          cohortId: f.memberType === "mentee" ? f.cohortId || null : null,
          specialtyId: f.memberType === "mentee" ? null : f.specialtyId || null,
        },
      });
      if (!r.ok) return setMsg(r.error);
      await qc.invalidateQueries({ queryKey: ["directory"] });
      setDone({ email: f.email });
    } catch {
      setMsg("Confira o nome, o email e as informações de acesso.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onDone()}
    >
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Cadastrar pessoa"
      >
        <button className="modal-close" type="button" onClick={onDone} aria-label="Fechar">
          <X size={21} />
        </button>
        {done ? (
          <div className="content-modal__body ops-form">
            <span className="eyebrow eyebrow--gold">Convite enviado</span>
            <h2>Pronto</h2>
            <p>
              A pessoa recebeu um email da RISE NOW com o link seguro para criar a própria senha.
            </p>
            <div className="ops-review-content">
              <p>
                <strong>Email:</strong> {done.email}
              </p>
            </div>
            <div className="content-modal__actions">
              <button className="button button--primary" type="button" onClick={onDone}>
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form className="content-modal__body ops-form" onSubmit={(e) => void save(e)}>
            <span className="eyebrow eyebrow--gold">Gestão de acessos</span>
            <h2>Cadastrar pessoa</h2>
            <Field label="Nome completo">
              <input
                value={f.fullName}
                onChange={(e) => setF({ ...f, fullName: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </Field>
            <Field label="WhatsApp com DDD">
              <input
                type="tel"
                inputMode="tel"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
                placeholder="(11) 99999 9999"
              />
            </Field>
            <Field label="Tipo de acesso">
              <select
                value={f.memberType}
                onChange={(e) =>
                  setF({
                    ...f,
                    memberType: e.target.value as typeof f.memberType,
                    cohortId: "",
                    specialtyId: "",
                  })
                }
              >
                <option value="mentee">Mentorada</option>
                <option value="mentor">Mentora · Administradora</option>
              </select>
            </Field>
            {f.memberType === "mentee" ? (
              <div className="ops-grid2">
                <Field label="Turma">
                  <select
                    value={f.cohortId}
                    onChange={(e) => setF({ ...f, cohortId: e.target.value })}
                  >
                    <option value="">Sem turma</option>
                    {dir?.cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <Field label="Pilar ou assunto principal">
                <select
                  required
                  value={f.specialtyId}
                  onChange={(e) => setF({ ...f, specialtyId: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {dir?.specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.id}>
                      {specialty.name} · {specialty.category === "pillar" ? "Pilar" : "Assunto"}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <p className="ops-muted">
              O acesso será liberado somente após a pessoa abrir o convite recebido por email e
              criar a própria senha.
            </p>
            {msg ? <p className="form-message">{msg}</p> : null}
            <div className="content-modal__actions">
              <button className="button button--primary" type="submit" disabled={busy}>
                {busy ? "Enviando…" : "Enviar convite"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function SpecialtyForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(createMentorSpecialty);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"pillar" | "subject">("subject");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const result = await fn({ data: { name, category } });
      if (!result.ok) return setMsg(result.error);
      await qc.invalidateQueries({ queryKey: ["directory"] });
      onDone();
    } catch {
      setMsg("Não foi possível cadastrar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="ops-inline-form" onSubmit={(event) => void save(event)}>
      <Field label="Nome">
        <input
          required
          minLength={2}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Liderança executiva"
        />
      </Field>
      <Field label="Classificação">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as typeof category)}
        >
          <option value="pillar">Pilar</option>
          <option value="subject">Assunto</option>
        </select>
      </Field>
      <button className="button button--primary" type="submit" disabled={busy}>
        {busy ? "Salvando…" : "Cadastrar"}
      </button>
      {msg ? <span className="form-message">{msg}</span> : null}
    </form>
  );
}

type MenteeProfileTab = "visao-geral" | "mapeamento" | "testes" | "plano" | "leituras" | "rise90";

const menteeProfileTabs: Array<{ id: MenteeProfileTab; label: string }> = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "mapeamento", label: "Mapeamento RISE" },
  { id: "testes", label: "Testes realizados" },
  { id: "plano", label: "Plano de desenvolvimento" },
  { id: "leituras", label: "Leituras recomendadas" },
  { id: "rise90", label: "RISE 90" },
];

function MenteeProfilePage({
  enrollment,
  tab,
  onTab,
  onBack,
}: {
  enrollment: RiseDirectory["enrollments"][number];
  tab: MenteeProfileTab;
  onTab: (tab: MenteeProfileTab) => void;
  onBack: () => void;
}) {
  return (
    <main className="inner-page mentee-profile-page">
      <section className="page-width ops-section">
        <button className="recorded-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Voltar para mentoradas
        </button>
        <header className="mentee-profile-header">
          <Avatar name={enrollment.name} url={enrollment.avatarUrl} size={92} />
          <div>
            <span className="eyebrow eyebrow--gold">Perfil privado</span>
            <h1>{enrollment.name}</h1>
            {enrollment.profession ? <p>{enrollment.profession}</p> : null}
            <small>
              {enrollment.email}
              {enrollment.phone ? ` · ${enrollment.phone}` : ""}
            </small>
          </div>
        </header>
        <nav className="ops-subnav mentee-profile-tabs" aria-label="Áreas do perfil">
          {menteeProfileTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "is-active" : ""}
              onClick={() => onTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mentee-profile-content">
          {tab === "visao-geral" ? (
            <div className="mentee-overview-grid">
              <article className="admin-card">
                <span>Turma</span>
                <strong>{enrollment.cohortId ? "Turma vinculada" : "Sem turma"}</strong>
              </article>
              <article className="admin-card">
                <span>Progresso atual</span>
                <strong>{enrollment.progress}%</strong>
                <small>Mês {enrollment.month}</small>
              </article>
              <article className="admin-card">
                <span>Status da matrícula</span>
                <strong>{enrollmentLabels[enrollment.status] ?? enrollment.status}</strong>
              </article>
            </div>
          ) : null}
          {tab === "mapeamento" || tab === "testes" || tab === "plano" ? (
            <AssessmentMentorContent enrollmentId={enrollment.id} name={enrollment.name} />
          ) : null}
          {tab === "leituras" ? (
            <div className="ops-empty mentee-readings-empty">
              <BookOpen size={28} />
              <h2>Nenhuma leitura recomendada cadastrada</h2>
              <p>A fonte de recomendações ainda não foi definida.</p>
            </div>
          ) : null}
          {tab === "rise90" ? (
            <Rise90StaffContent enrollmentId={enrollment.id} name={enrollment.name} />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function MembersPanel({ mode }: { mode: "students" | "access" }) {
  const qc = useQueryClient();
  const { data: dir } = useDirectory();
  const updateFn = useServerFn(updateEnrollment);
  const updateAccessFn = useServerFn(updateAccess);
  const { data: subs = [] } = useSubmissions();
  const [cohortOpen, setCohortOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<RiseDirectory["cohorts"][number] | null>(null);
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [adminSection, setAdminSection] = useState<"perfis" | "acessos" | "turmas">(
    mode === "students" ? "perfis" : "acessos",
  );
  const [selectedMentee, setSelectedMentee] = useState(() =>
    mode === "students" ? new URLSearchParams(window.location.search).get("mentee") : null,
  );
  const [profileTab, setProfileTab] = useState<MenteeProfileTab>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab") as MenteeProfileTab;
    return menteeProfileTabs.some((item) => item.id === requested) ? requested : "visao-geral";
  });

  useEffect(() => {
    setAdminSection(mode === "students" ? "perfis" : "acessos");
    if (mode !== "students") {
      setSelectedMentee(null);
    }
  }, [mode]);

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedMentee(mode === "students" ? params.get("mentee") : null);
      const requested = params.get("tab") as MenteeProfileTab;
      setProfileTab(
        menteeProfileTabs.some((item) => item.id === requested) ? requested : "visao-geral",
      );
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [mode]);

  function setProfile(enrollmentId: string | null, tab: MenteeProfileTab = "visao-geral") {
    const url = new URL(window.location.href);
    if (enrollmentId) {
      url.searchParams.set("view", "alunas");
      url.searchParams.set("mentee", enrollmentId);
      url.searchParams.set("tab", tab);
    } else {
      url.searchParams.delete("mentee");
      url.searchParams.delete("tab");
    }
    window.history.pushState({}, "", url);
    setSelectedMentee(enrollmentId);
    setProfileTab(tab);
  }

  async function update(
    enrollmentId: string,
    patch: {
      cohortId?: string | null;
      status?: "ativa" | "pausada" | "desativada";
    },
  ) {
    await updateFn({ data: { enrollmentId, ...patch } });
    await qc.invalidateQueries({ queryKey: ["directory"] });
  }
  async function reset(email: string, name: string) {
    if (!window.confirm(`Enviar um link de nova senha para ${name}?`)) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    window.alert(
      error
        ? "Não foi possível enviar o email agora."
        : `O link para criar uma nova senha foi enviado para ${email}.`,
    );
  }
  const monthStatus = (enrollmentId: string, month: number) =>
    subs.find(
      (s) => s.enrollment_id === enrollmentId && s.deliverable?.phase?.month_number === month,
    )?.status ?? "nao_iniciada";

  const activeEnrollment =
    mode === "students" ? dir?.enrollments.find((entry) => entry.id === selectedMentee) : undefined;
  if (activeEnrollment)
    return (
      <MenteeProfilePage
        enrollment={activeEnrollment}
        tab={profileTab}
        onTab={(tab) => setProfile(activeEnrollment.id, tab)}
        onBack={() => setProfile(null)}
      />
    );

  return (
    <main className="inner-page">
      <Intro
        eyebrow="Gestão"
        title={mode === "students" ? "Alunas" : "Turmas e acessos"}
        copy={
          mode === "students"
            ? "Perfis, acompanhamento e informações das mentoradas."
            : "Gerencie acessos da plataforma e organize as turmas."
        }
      />
      <section className="page-width ops-section">
        {mode === "access" ? (
          <nav className="ops-subnav" aria-label="Administração de acessos e turmas">
            <button
              type="button"
              className={adminSection === "acessos" ? "is-active" : ""}
              onClick={() => setAdminSection("acessos")}
            >
              Acessos
            </button>
            <button
              type="button"
              className={adminSection === "turmas" ? "is-active" : ""}
              onClick={() => setAdminSection("turmas")}
            >
              Turmas
            </button>
          </nav>
        ) : null}

        {adminSection === "acessos" ? (
          <div className="ops-table-wrap ops-admin-panel">
            <div className="section-heading">
              <div>
                <h2>Gestão de acessos</h2>
                <p>Convites, status e credenciais, separados das matrículas.</p>
              </div>
              <button type="button" onClick={() => setMemberOpen(true)}>
                <Plus size={16} /> Cadastrar pessoa
              </button>
            </div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dir?.access.map((entry) => {
                  const enrollment =
                    entry.role === "mentee"
                      ? dir.enrollments.find(
                          (item) =>
                            item.menteeId === entry.userId ||
                            item.email.toLowerCase() === entry.email.toLowerCase(),
                        )
                      : null;
                  return (
                    <tr key={entry.id}>
                      <td>
                        <strong>{entry.name}</strong>
                        <small>{entry.email}</small>
                      </td>
                      <td>{entry.role === "mentee" ? "Mentorada" : "Mentora · Administradora"}</td>
                      <td>
                        <span className={`ops-tag ops-tag--${entry.status}`}>
                          {entry.status === "ativo"
                            ? "Ativo"
                            : entry.status === "revogado"
                              ? "Revogado"
                              : "Convite pendente"}
                        </span>
                        {enrollment ? (
                          <small className="ops-access-enrollment">
                            Matrícula: {enrollmentLabels[enrollment.status] ?? enrollment.status}
                          </small>
                        ) : null}
                      </td>
                      <td className="ops-actions-cell">
                        <div className="ops-actions">
                          {entry.email ? (
                            <button
                              type="button"
                              onClick={() => void reset(entry.email, entry.name)}
                            >
                              Enviar nova senha
                            </button>
                          ) : null}
                          {enrollment ? (
                            <>
                              {enrollment.status === "ativa" ? (
                                <button
                                  type="button"
                                  onClick={() => void update(enrollment.id, { status: "pausada" })}
                                >
                                  Pausar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void update(enrollment.id, { status: "ativa" })}
                                >
                                  Reativar
                                </button>
                              )}
                              {enrollment.status !== "desativada" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    window.confirm(`Desativar o acesso de ${entry.name}?`) &&
                                    void update(enrollment.id, { status: "desativada" })
                                  }
                                >
                                  Desativar
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={async () => {
                              const enabled = entry.status === "revogado";
                              if (
                                !window.confirm(
                                  `${enabled ? "Ativar" : "Revogar"} o acesso de ${entry.name}?`,
                                )
                              )
                                return;
                              await updateAccessFn({ data: { accessId: entry.id, enabled } });
                              await qc.invalidateQueries({ queryKey: ["directory"] });
                            }}
                          >
                            {entry.status === "revogado" ? "Ativar acesso" : "Revogar acesso"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="section-heading" hidden={adminSection !== "turmas"}>
          <div>
            <h2>Turmas</h2>
          </div>
          <button type="button" onClick={() => setCohortOpen(!cohortOpen)}>
            <Plus size={16} /> Nova turma
          </button>
        </div>
        {cohortOpen && adminSection === "turmas" ? (
          <CohortForm onDone={() => setCohortOpen(false)} />
        ) : null}
        <div className="ops-cohorts" hidden={adminSection !== "turmas"}>
          {dir?.cohorts.map((c) => {
            const memberCount = dir.enrollments.filter((e) => e.cohortId === c.id).length;
            return (
              <article key={c.id} className="admin-card">
                <strong>{c.name}</strong>
                <small className="ops-muted">
                  {c.starts_on
                    ? new Date(`${c.starts_on}T12:00`).toLocaleDateString("pt-BR")
                    : "A definir"}{" "}
                  até{" "}
                  {c.ends_on
                    ? new Date(`${c.ends_on}T12:00`).toLocaleDateString("pt-BR")
                    : "A definir"}
                </small>
                <span>{memberCount} mentorada(s)</span>
                <div className="ops-actions">
                  <button type="button" onClick={() => setEditingCohort(c)}>
                    <Pencil size={15} /> Editar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {editingCohort ? (
          <CohortEditor
            cohort={editingCohort}
            memberCount={
              dir?.enrollments.filter((e) => e.cohortId === editingCohort.id).length ?? 0
            }
            onDone={() => setEditingCohort(null)}
          />
        ) : null}

        <div className="section-heading ops-gap" hidden={adminSection !== "perfis"}>
          <div>
            <h2>Pilares e assuntos</h2>
            <p>Opções usadas no cadastro das mentoras.</p>
          </div>
          <button type="button" onClick={() => setSpecialtyOpen(!specialtyOpen)}>
            <Plus size={16} /> Novo pilar ou assunto
          </button>
        </div>
        {specialtyOpen && adminSection === "perfis" ? (
          <SpecialtyForm onDone={() => setSpecialtyOpen(false)} />
        ) : null}
        <div className="ops-specialties" hidden={adminSection !== "perfis"}>
          {dir?.specialties.map((specialty) => (
            <span key={specialty.id}>
              {specialty.name}
              <small>{specialty.category === "pillar" ? "Pilar" : "Assunto"}</small>
            </span>
          ))}
        </div>

        <div className="section-heading ops-gap" hidden={adminSection !== "perfis"}>
          <div>
            <h2>Mentoradas</h2>
            <p>Avanço na trilha e status da entrega do mês atual.</p>
          </div>
          <button type="button" onClick={() => setMemberOpen(true)}>
            <Plus size={16} /> Cadastrar pessoa
          </button>
        </div>
        <div className="ops-table-wrap" hidden={adminSection !== "perfis"}>
          <table className="ops-table">
            <thead>
              <tr>
                <th>Mentorada</th>
                <th>Turma</th>
                <th>Avanço</th>
                <th>Entrega do mês</th>
                <th>Matrícula</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dir?.enrollments.map((e) => (
                <tr key={e.id}>
                  <td>
                    <button
                      type="button"
                      className="x-namebtn"
                      onClick={() => setProfile(e.id)}
                      title="Abrir perfil completo"
                    >
                      <strong>{e.name}</strong>
                      <small>{e.profession || e.email}</small>
                    </button>
                  </td>
                  <td>
                    <select
                      value={e.cohortId ?? ""}
                      onChange={(ev) => void update(e.id, { cohortId: ev.target.value || null })}
                    >
                      <option value="">Sem turma</option>
                      {dir.cohorts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="table-progress">
                      <span>
                        <i style={{ width: `${e.progress}%` }} />
                      </span>
                      <small>{e.progress}%</small>
                    </div>
                  </td>
                  <td>
                    <span className={`ops-status ops-status--${monthStatus(e.id, e.month)}`}>
                      {statusLabels[monthStatus(e.id, e.month)]}
                    </span>
                  </td>
                  <td>
                    <span className={`ops-tag ops-tag--${e.status}`}>
                      {enrollmentLabels[e.status]}
                    </span>
                  </td>
                  <td className="ops-actions-cell">
                    <div className="ops-actions">
                      <button type="button" onClick={() => setProfile(e.id)}>
                        Abrir perfil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="section-heading ops-gap" hidden={adminSection !== "perfis"}>
          <div>
            <h2>Equipe</h2>
            <p>Mentoras com acesso administrativo completo.</p>
          </div>
        </div>
        <div className="ops-cohorts" hidden={adminSection !== "perfis"}>
          {dir?.staff.map((s) => (
            <article key={s.id} className="admin-card">
              <Avatar name={s.name} url={s.avatarUrl} size={56} />
              <strong>{s.name}</strong>
              <small className="ops-muted">{s.email}</small>
              <span>
                Mentora
                {s.specialty ? ` de ${s.specialty}` : ""} · Administradora
              </span>
            </article>
          ))}
        </div>
      </section>
      {memberOpen ? <MemberForm onDone={() => setMemberOpen(false)} /> : null}
    </main>
  );
}

/* ---------- overview ---------- */

function StaffOverview({ onView }: { onView: (v: StaffView) => void }) {
  const { data: dir } = useDirectory();
  const { data: subs = [] } = useSubmissions();
  const { data: meetings = [] } = useMeetings();
  const toReview = subs.filter((s) => s.status === "enviada" || s.status === "em_revisao").length;
  const upcoming = meetings.filter((m) => endOf(m) >= Date.now());
  return (
    <main className="inner-page">
      <Intro
        eyebrow="Mentoria e administração"
        title="Gestão da RISE NOW"
        copy="Jornadas, agenda, entregas e acessos em um só lugar."
      />
      <section className="mentor-stats page-width">
        <article onClick={() => onView("alunas")}>
          <UsersRound size={23} />
          <span>Mentoradas ativas</span>
          <strong>
            {dir?.enrollments.filter((e) => e.status === "ativa").length ?? "A definir"}
          </strong>
        </article>
        <article onClick={() => onView("agenda")}>
          <CalendarDays size={23} />
          <span>Próximos encontros</span>
          <strong>{upcoming.length}</strong>
        </article>
        <article onClick={() => onView("entregas")}>
          <FileCheck2 size={23} />
          <span>Entregas para revisar</span>
          <strong>{toReview}</strong>
        </article>
      </section>
      {upcoming[0] ? (
        <section className="page-width ops-section">
          <div className="section-heading">
            <div>
              <h2>Próximo encontro</h2>
            </div>
          </div>
          <MeetingCard m={upcoming[0]} />
        </section>
      ) : null}
      <section className="page-width ops-section">
        <div className="section-heading">
          <div>
            <h2>Mentoradas</h2>
          </div>
        </div>
        <div className="people-table">
          {dir?.enrollments.map((e) => (
            <article
              key={e.id}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("view", "alunas");
                url.searchParams.set("mentee", e.id);
                url.searchParams.set("tab", "visao-geral");
                window.history.pushState({}, "", url);
                onView("alunas");
              }}
            >
              <Avatar name={e.name} url={e.avatarUrl} size={48} />
              <div>
                <strong>{e.name}</strong>
                <small>
                  Mês {e.month} · {enrollmentLabels[e.status]}
                </small>
              </div>
              <div className="table-progress">
                <span>
                  <i style={{ width: `${e.progress}%` }} />
                </span>
                <small>{e.progress}%</small>
              </div>
            </article>
          ))}
          {dir && !dir.enrollments.length ? (
            <p className="ops-empty">Nenhuma mentorada atribuída ainda.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function StaffArea({ view, onView }: { view: StaffView; onView: (v: StaffView) => void }) {
  if (view === "gestao-jornada") return <JourneyAdmin />;
  if (view === "conteudos") return <JourneyContentAdmin />;
  if (view === "agenda") return <StaffAgenda />;
  if (view === "entregas") return <ReviewPanel />;
  if (view === "alunas") return <MembersPanel mode="students" />;
  if (view === "turmas-acessos") return <MembersPanel mode="access" />;
  if (view === "whatsapp") return <WhatsAppAdmin />;
  return <StaffOverview onView={onView} />;
}
