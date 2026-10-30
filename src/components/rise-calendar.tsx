import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pause,
  Play,
  Plus,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { RiseDirectory } from "@/lib/admin.functions";
import {
  bookOneToOne,
  cancelOneToOne,
  createBookingOffering,
  getAvailableBookingSlots,
  getCalendarOverview,
  listBookingOfferings,
  listMyBookings,
  type BookingOffering,
  type CalendarEvent,
  updateBookingOffering,
} from "@/lib/google.functions";

type CalendarMode = "month" | "week" | "day";

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const fullDayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const pad = (value: number) => String(value).padStart(2, "0");
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const atStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const startWeek = (date: Date) => addDays(atStart(date), -date.getDay());

function rangeFor(mode: CalendarMode, cursor: Date) {
  if (mode === "day") return { start: atStart(cursor), end: addDays(atStart(cursor), 1) };
  if (mode === "week") {
    const start = startWeek(cursor);
    return { start, end: addDays(start, 7) };
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startWeek(first);
  return { start, end: addDays(start, 42) };
}

function calendarTitle(mode: CalendarMode, cursor: Date) {
  if (mode === "day")
    return cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  if (mode === "week") {
    const start = startWeek(cursor);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function moveCursor(mode: CalendarMode, cursor: Date, direction: number) {
  const next = new Date(cursor);
  if (mode === "month") next.setMonth(next.getMonth() + direction);
  else next.setDate(next.getDate() + direction * (mode === "week" ? 7 : 1));
  return next;
}

function EventPill({ event }: { event: CalendarEvent }) {
  const content = (
    <>
      <time>
        {new Date(event.startsAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
      <span>{event.title}</span>
    </>
  );
  return event.joinUrl ? (
    <a
      className={`rise-calendar-event is-${event.kind}`}
      href={event.joinUrl}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  ) : (
    <div className={`rise-calendar-event is-${event.kind}`}>{content}</div>
  );
}

export function RiseCalendar({ compact = false }: { compact?: boolean }) {
  const load = useServerFn(getCalendarOverview);
  const [mode, setMode] = useState<CalendarMode>(compact ? "week" : "month");
  const [cursor, setCursor] = useState(new Date());
  const range = useMemo(() => rangeFor(mode, cursor), [mode, cursor]);
  const query = useQuery({
    queryKey: ["calendar-overview", mode, range.start.toISOString(), range.end.toISOString()],
    queryFn: () =>
      load({ data: { startsAt: range.start.toISOString(), endsAt: range.end.toISOString() } }),
  });
  const events = query.data?.events ?? [];
  const days = useMemo(() => {
    const count = mode === "month" ? 42 : mode === "week" ? 7 : 1;
    return Array.from({ length: count }, (_, index) => addDays(range.start, index));
  }, [mode, range.start]);

  return (
    <section className="rise-calendar" aria-label="Calendário RISE e Google Agenda">
      <header className="rise-calendar__toolbar">
        <div className="rise-calendar__nav">
          <button
            type="button"
            onClick={() => setCursor(moveCursor(mode, cursor, -1))}
            aria-label="Período anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setCursor(new Date())}>
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setCursor(moveCursor(mode, cursor, 1))}
            aria-label="Próximo período"
          >
            <ChevronRight size={18} />
          </button>
          <h2>{calendarTitle(mode, cursor)}</h2>
        </div>
        <div className="rise-calendar__modes" aria-label="Modo do calendário">
          {(["month", "week", "day"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={mode === item ? "is-active" : ""}
              onClick={() => setMode(item)}
            >
              {item === "month" ? "Mês" : item === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </header>
      {!query.data?.googleConnected ? (
        <p className="rise-calendar__notice">
          {query.data?.reconnectRequired
            ? "Reconecte o Google Agenda para carregar seus compromissos e proteger os horários ocupados."
            : "Conecte o Google Agenda para visualizar também os compromissos da sua agenda pessoal."}
        </p>
      ) : null}
      {query.isLoading ? <p className="ops-muted">Carregando calendário…</p> : null}
      {query.error ? <p className="form-message">Não foi possível carregar o calendário.</p> : null}
      <div className={`rise-calendar__grid is-${mode}`}>
        {days.map((date) => {
          const key = dayKey(date);
          const dayEvents = events.filter((event) => dayKey(new Date(event.startsAt)) === key);
          const outside = mode === "month" && date.getMonth() !== cursor.getMonth();
          const today = key === dayKey(new Date());
          return (
            <article
              key={key}
              className={`${outside ? "is-outside" : ""} ${today ? "is-today" : ""}`}
            >
              <header>
                {mode !== "month" ? <span>{dayNames[date.getDay()]}</span> : null}
                <strong>{date.getDate()}</strong>
              </header>
              <div className="rise-calendar__events">
                {dayEvents.map((event) => (
                  <EventPill event={event} key={event.id} />
                ))}
                {!dayEvents.length && mode !== "month" ? <small>Livre</small> : null}
              </div>
            </article>
          );
        })}
      </div>
      <footer className="rise-calendar__legend">
        <span>
          <i className="is-collective" /> RISE coletivo
        </span>
        <span>
          <i className="is-individual" /> RISE 1:1
        </span>
        <span>
          <i className="is-google" /> Google Agenda
        </span>
      </footer>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ops-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function OfferingModal({
  directory,
  onClose,
}: {
  directory: RiseDirectory | undefined;
  onClose: (saved: boolean) => void;
}) {
  const save = useServerFn(createBookingOffering);
  const today = dayKey(new Date());
  const [form, setForm] = useState({
    title: "Encontro individual 1:1",
    description: "",
    mentorId: "",
    durationMinutes: 60,
    bufferMinutes: 15,
    bookingNoticeHours: 24,
    cancellationNoticeHours: 24,
    weekdays: [1] as number[],
    startTime: "09:00",
    endTime: "12:00",
    validFrom: today,
    validUntil: "",
    cohortIds: [] as string[],
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((old) => ({ ...old, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.mentorId || !form.weekdays.length)
      return setMessage("Informe nome, mentora e pelo menos um dia.");
    if (form.endTime <= form.startTime)
      return setMessage("O término precisa ser depois do início.");
    setBusy(true);
    setMessage("");
    try {
      await save({
        data: {
          ...form,
          rules: form.weekdays.map((weekday) => ({
            weekday,
            startTime: form.startTime,
            endTime: form.endTime,
            validFrom: form.validFrom,
            validUntil: form.validUntil || null,
          })),
        },
      });
      onClose(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível salvar a disponibilidade.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose(false)}
    >
      <section
        className="content-modal ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Disponibilizar encontro individual"
      >
        <button
          className="modal-close"
          type="button"
          onClick={() => onClose(false)}
          aria-label="Fechar"
        >
          <X size={21} />
        </button>
        <form className="content-modal__body ops-form" onSubmit={(event) => void submit(event)}>
          <span className="eyebrow eyebrow--gold">Agenda 1:1</span>
          <h2>Disponibilizar encontro</h2>
          <p className="ops-muted">
            A mentorada verá o nome do encontro e escolherá somente um horário livre.
          </p>
          <Field label="Nome do encontro">
            <input value={form.title} onChange={(event) => set("title", event.target.value)} />
          </Field>
          <Field label="Mentora responsável">
            <select value={form.mentorId} onChange={(event) => set("mentorId", event.target.value)}>
              <option value="">Escolher…</option>
              {directory?.staff.map((mentor) => (
                <option value={mentor.id} key={mentor.id}>
                  {mentor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="O que será abordado">
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </Field>
          <div className="ops-grid2">
            <Field label="Duração (min)">
              <input
                type="number"
                min={15}
                max={240}
                step={15}
                value={form.durationMinutes}
                onChange={(event) => set("durationMinutes", Number(event.target.value))}
              />
            </Field>
            <Field label="Intervalo após encontro (min)">
              <input
                type="number"
                min={0}
                max={120}
                step={5}
                value={form.bufferMinutes}
                onChange={(event) => set("bufferMinutes", Number(event.target.value))}
              />
            </Field>
          </div>
          <Field label="Dias da semana">
            <div className="ops-pills">
              {dayNames.map((label, weekday) => (
                <button
                  type="button"
                  className={form.weekdays.includes(weekday) ? "is-active" : ""}
                  key={label}
                  onClick={() =>
                    set(
                      "weekdays",
                      form.weekdays.includes(weekday)
                        ? form.weekdays.filter((item) => item !== weekday)
                        : [...form.weekdays, weekday],
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <div className="ops-grid2">
            <Field label="Das">
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => set("startTime", event.target.value)}
              />
            </Field>
            <Field label="Até">
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => set("endTime", event.target.value)}
              />
            </Field>
          </div>
          <div className="ops-grid2">
            <Field label="Válido a partir de">
              <input
                type="date"
                value={form.validFrom}
                onChange={(event) => set("validFrom", event.target.value)}
              />
            </Field>
            <Field label="Até (opcional)">
              <input
                type="date"
                value={form.validUntil}
                onChange={(event) => set("validUntil", event.target.value)}
              />
            </Field>
          </div>
          <Field label="Turmas convidadas (vazio = todas)">
            <div className="ops-checks">
              {directory?.cohorts.map((cohort) => (
                <label key={cohort.id}>
                  <input
                    type="checkbox"
                    checked={form.cohortIds.includes(cohort.id)}
                    onChange={(event) =>
                      set(
                        "cohortIds",
                        event.target.checked
                          ? [...form.cohortIds, cohort.id]
                          : form.cohortIds.filter((id) => id !== cohort.id),
                      )
                    }
                  />
                  {cohort.name}
                </label>
              ))}
            </div>
          </Field>
          <div className="ops-grid2">
            <Field label="Antecedência mínima (h)">
              <input
                type="number"
                min={0}
                value={form.bookingNoticeHours}
                onChange={(event) => set("bookingNoticeHours", Number(event.target.value))}
              />
            </Field>
            <Field label="Prazo para cancelar (h)">
              <input
                type="number"
                min={0}
                value={form.cancellationNoticeHours}
                onChange={(event) => set("cancellationNoticeHours", Number(event.target.value))}
              />
            </Field>
          </div>
          {message ? <p className="form-message">{message}</p> : null}
          <div className="content-modal__actions">
            <button className="button button--primary" disabled={busy} type="submit">
              <CalendarCheck2 size={17} />
              {busy ? "Salvando…" : "Disponibilizar horários"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function StaffBookingOfferings({ directory }: { directory: RiseDirectory | undefined }) {
  const qc = useQueryClient();
  const load = useServerFn(listBookingOfferings);
  const update = useServerFn(updateBookingOffering);
  const query = useQuery({ queryKey: ["booking-offerings"], queryFn: () => load() });
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  async function toggle(item: BookingOffering) {
    setBusyId(item.id);
    setMessage("");
    try {
      await update({
        data: { id: item.id, status: item.status === "active" ? "paused" : "active" },
      });
      await qc.invalidateQueries({ queryKey: ["booking-offerings"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o encontro.");
    } finally {
      setBusyId("");
    }
  }
  async function archive(item: BookingOffering) {
    const confirmed = window.confirm(
      `Excluir a disponibilidade “${item.title}”? Ela deixará de aparecer para a equipe e para as mentoradas. Encontros já realizados continuarão no histórico.`,
    );
    if (!confirmed) return;
    setBusyId(item.id);
    setMessage("");
    try {
      await update({ data: { id: item.id, status: "archived" } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["booking-offerings"] }),
        qc.invalidateQueries({ queryKey: ["booking-slots", item.id] }),
      ]);
      setMessage("Disponibilidade excluída.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir o encontro.");
    } finally {
      setBusyId("");
    }
  }
  return (
    <section className="booking-offerings">
      <div className="section-heading ops-gap">
        <div>
          <h2>Disponibilidades para encontros 1:1</h2>
          <p>Crie horários nomeados. A mentorada escolhe o horário, sem escolher a mentora.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> Disponibilizar 1:1
        </button>
      </div>
      <div className="booking-offerings__grid">
        {(query.data?.offerings ?? []).map((item) => (
          <article
            className={`booking-offering ${item.status !== "active" ? "is-paused" : ""}`}
            key={item.id}
          >
            <div>
              <span className="eyebrow eyebrow--gold">{item.mentorName}</span>
              <h3>{item.title}</h3>
              <p>{item.description || "Encontro individual da jornada RISE."}</p>
            </div>
            <div className="booking-offering__facts">
              <span>
                <Clock3 size={15} /> {item.durationMinutes} min
              </span>
              <span>
                <UsersRound size={15} />{" "}
                {item.cohortIds.length ? `${item.cohortIds.length} turma(s)` : "Todas as turmas"}
              </span>
            </div>
            <div className="booking-offering__days">
              {item.rules.map((rule) => (
                <span key={rule.id}>
                  {fullDayNames[rule.weekday]} · {rule.startTime.slice(0, 5)} às{" "}
                  {rule.endTime.slice(0, 5)}
                </span>
              ))}
            </div>
            <div className="booking-offering__actions">
              <button
                className="button button--glass"
                type="button"
                disabled={busyId === item.id}
                onClick={() => void toggle(item)}
              >
                {item.status === "active" ? (
                  <>
                    <Pause size={15} /> Pausar
                  </>
                ) : (
                  <>
                    <Play size={15} /> Reativar
                  </>
                )}
              </button>
              <button
                className="button booking-offering__delete"
                type="button"
                disabled={busyId === item.id}
                onClick={() => void archive(item)}
              >
                <Trash2 size={15} /> Excluir
              </button>
            </div>
          </article>
        ))}
        {!query.isLoading && !query.data?.offerings.length ? (
          <p className="ops-empty">Nenhuma disponibilidade 1:1 criada.</p>
        ) : null}
      </div>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {open ? (
        <OfferingModal
          directory={directory}
          onClose={(saved) => {
            setOpen(false);
            if (saved) void qc.invalidateQueries({ queryKey: ["booking-offerings"] });
          }}
        />
      ) : null}
    </section>
  );
}

function SlotPicker({ offering, onClose }: { offering: BookingOffering; onClose: () => void }) {
  const qc = useQueryClient();
  const load = useServerFn(getAvailableBookingSlots);
  const book = useServerFn(bookOneToOne);
  const start = atStart(new Date());
  const end = addDays(start, 31);
  const query = useQuery({
    queryKey: ["booking-slots", offering.id],
    queryFn: () =>
      load({
        data: { offeringId: offering.id, startsAt: start.toISOString(), endsAt: end.toISOString() },
      }),
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const grouped = useMemo(() => {
    const result = new Map<string, Array<{ startsAt: string; endsAt: string }>>();
    for (const slot of query.data?.slots ?? []) {
      const key = dayKey(new Date(slot.startsAt));
      result.set(key, [...(result.get(key) ?? []), slot]);
    }
    return [...result.entries()];
  }, [query.data?.slots]);
  async function reserve(slot: { startsAt: string; endsAt: string }) {
    setBusy(slot.startsAt);
    setMessage("");
    try {
      await book({
        data: { offeringId: offering.id, startsAt: slot.startsAt, endsAt: slot.endsAt },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["meetings"] }),
        qc.invalidateQueries({ queryKey: ["calendar-overview"] }),
        qc.invalidateQueries({ queryKey: ["booking-slots", offering.id] }),
      ]);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível reservar.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="content-modal ops-modal ops-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Escolher horário"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={21} />
        </button>
        <div className="content-modal__body ops-form">
          <span className="eyebrow eyebrow--gold">{offering.mentorName}</span>
          <h2>{offering.title}</h2>
          <p>{offering.description || "Escolha um dia e horário livre para o seu encontro."}</p>
          {!query.data?.googleConnected ? (
            <p className="rise-calendar__notice">
              Conecte seu Google Agenda antes de confirmar. Assim a plataforma impede que você
              reserve sobre outro compromisso.
            </p>
          ) : null}
          {query.isLoading ? <p className="ops-muted">Comparando as duas agendas…</p> : null}
          {query.error ? (
            <p className="form-message">
              {query.error instanceof Error
                ? query.error.message
                : "Não foi possível consultar os horários."}
            </p>
          ) : null}
          <div className="booking-slots">
            {grouped.map(([key, slots]) => (
              <section key={key}>
                <h3>
                  {new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </h3>
                <div>
                  {slots.map((slot) => (
                    <button
                      type="button"
                      disabled={!!busy || !query.data?.googleConnected}
                      onClick={() => void reserve(slot)}
                      key={slot.startsAt}
                    >
                      {busy === slot.startsAt
                        ? "Reservando…"
                        : new Date(slot.startsAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {!query.isLoading && !query.error && !grouped.length ? (
              <p className="ops-empty">Nenhum horário livre nos próximos 30 dias.</p>
            ) : null}
          </div>
          {message ? <p className="form-message">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

export function MenteeBookingAgenda() {
  const load = useServerFn(listBookingOfferings);
  const loadBookings = useServerFn(listMyBookings);
  const cancel = useServerFn(cancelOneToOne);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["booking-offerings"], queryFn: () => load() });
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => loadBookings() });
  const [selected, setSelected] = useState<BookingOffering | null>(null);
  const [message, setMessage] = useState("");
  async function cancelBooking(id: string) {
    if (
      !window.confirm(
        "Cancelar este encontro 1:1? O convite também será removido do Google Agenda.",
      )
    )
      return;
    setMessage("");
    try {
      await cancel({ data: { id } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-bookings"] }),
        qc.invalidateQueries({ queryKey: ["meetings"] }),
        qc.invalidateQueries({ queryKey: ["calendar-overview"] }),
        qc.invalidateQueries({ queryKey: ["booking-slots"] }),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cancelar.");
    }
  }
  return (
    <section className="page-width ops-section">
      <div className="section-heading ops-gap">
        <div>
          <h2>Agendar encontro 1:1</h2>
          <p>
            Escolha apenas o melhor horário para você. A mentora responsável já está definida em
            cada encontro.
          </p>
        </div>
      </div>
      <div className="booking-offerings__grid">
        {(query.data?.offerings ?? []).map((item) => (
          <article className="booking-offering" key={item.id}>
            <div>
              <span className="eyebrow eyebrow--gold">{item.mentorName}</span>
              <h3>{item.title}</h3>
              <p>{item.description || "Encontro individual da jornada RISE."}</p>
            </div>
            <div className="booking-offering__facts">
              <span>
                <Clock3 size={15} /> {item.durationMinutes} min
              </span>
            </div>
            <button
              className="button button--primary"
              type="button"
              onClick={() => setSelected(item)}
            >
              Ver horários livres
            </button>
          </article>
        ))}
        {!query.isLoading && !query.data?.offerings.length ? (
          <p className="ops-empty">Nenhum encontro 1:1 está disponível para agendamento agora.</p>
        ) : null}
      </div>
      {(bookings.data?.bookings ?? []).length ? (
        <div className="booking-confirmed">
          <h3>Seus encontros 1:1 confirmados</h3>
          {bookings.data?.bookings.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {new Date(item.startsAt).toLocaleString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {item.mentorName}
                </span>
              </div>
              <button
                className="button button--glass"
                type="button"
                onClick={() => void cancelBooking(item.id)}
              >
                Cancelar
              </button>
            </article>
          ))}
        </div>
      ) : null}
      {message ? <p className="form-message">{message}</p> : null}
      {selected ? <SlotPicker offering={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}
