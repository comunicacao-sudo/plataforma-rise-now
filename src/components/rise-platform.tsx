import riseLogo from "@/assets/rise-logo-light.png.asset.json";
import riseIcon from "@/assets/rise-icon-light.png.asset.json";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  UserRound,
  Clock3,
  Download,
  FileCheck2,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { demoMentees, mentors } from "@/data/rise-content";
import { Avatar, MentorsSection, NotificationBell, ProfileModal, Rise90Live, useMyProfile } from "@/components/rise-extras";
import {
  LessonScreen,
  TrailAgenda,
  TrailDeliverables,
  formatWhen,
  useTrail,
  type Trail,
  type TrailLesson,
} from "@/components/rise-trail";
import { supabase } from "@/integrations/supabase/client";
import { MenteeMeetings, NextMeetingBanner, StaffArea, type StaffView } from "@/components/rise-ops";

type Role = "mentee" | "mentor" | "admin";
type View = "inicio" | "jornada" | "agenda" | "entregas" | "rise90" | "painel" | "alunas";
type AuthMode = "checking" | "login" | "authenticated" | "demo" | "change-password";

const roleLabels: Record<Role, string> = {
  mentee: "Mentorada",
  mentor: "Mentora",
  admin: "Administradora",
};

function RiseMark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rise-mark rise-mark--compact" aria-label="RISE NOW">
        <img src={riseIcon.url} alt="" className="rise-mark__icon" />
        <span className="rise-mark__text">
          RISE <em>now</em>
        </span>
      </div>
    );
  }
  return (
    <div className="rise-mark" aria-label="RISE NOW">
      <img src={riseLogo.url} alt="RISE NOW" className="rise-mark__logo" />
      <span className="rise-mark__pillars">Reflexão · Identidade · Segurança · Evolução</span>
    </div>
  );
}

function LoginScreen({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"password" | "link">("password");
  const [sent, setSent] = useState<"" | "link" | "reset">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      if (method === "password") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (authError) {
          setError("E-mail ou senha incorretos.");
          return;
        }
        sessionStorage.setItem("rise-initial-pw", password);
        return;
      }
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        // Unapproved emails are rejected by the database trigger on signup.
        options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
      });
      if (authError) throw authError;
      setSent("link");
    } catch {
      setError(
        "Não foi possível liberar o acesso. Confirme se este é o e-mail aprovado pela equipe RISE.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Digite seu e-mail acima para receber o link de nova senha.");
      return;
    }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) setError("Não foi possível enviar o link agora. Tente novamente.");
    else setSent("reset");
  }

  return (
    <main className="login-shell">
      <div className="login-shell__art" aria-hidden="true">
        <div className="orb orb--one" />
        <div className="orb orb--two" />
        <div className="orb orb--three" />
        <span className="login-shell__spark">✦</span>
        <div className="login-shell__line" />
        <p className="login-shell__mantra">clareza · presença · movimento</p>
      </div>

      <section className="login-panel">
        <RiseMark />
        <div className="login-panel__copy">
          <span className="eyebrow eyebrow--gold">Plataforma exclusiva</span>
          <h1>Seu próximo nível começa por dentro.</h1>
          <p>
            Entre no ambiente da sua mentoria para acessar a jornada, encontros, materiais e
            evidências da sua evolução.
          </p>
        </div>

        {sent ? (
          <div className="access-sent" role="status">
            <div className="access-sent__icon">
              <Check />
            </div>
            <div>
              <strong>Confira seu e-mail</strong>
              <p>
                {sent === "reset"
                  ? "Enviamos um link para você criar uma nova senha."
                  : "Enviamos um link seguro e temporário para continuar."}
              </p>
            </div>
          </div>
        ) : (
          <form className="login-form" onSubmit={requestAccess}>
            <label htmlFor="rise-email">E-mail aprovado</label>
            <input
              id="rise-email"
              type="email"
              required
              autoComplete="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {method === "password" ? (
              <>
                <label htmlFor="rise-password">Senha</label>
                <input
                  id="rise-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </>
            ) : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button button--primary button--wide" type="submit" disabled={busy}>
              {busy ? "Verificando…" : method === "password" ? "Entrar" : "Receber acesso seguro"}
              {!busy ? <ArrowRight size={18} /> : null}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <button
                className="demo-link"
                type="button"
                onClick={() => setMethod(method === "password" ? "link" : "password")}
              >
                {method === "password" ? "Entrar com link por e-mail" : "Entrar com senha"}
              </button>
              {method === "password" ? (
                <button className="demo-link" type="button" onClick={() => void forgotPassword()}>
                  Esqueci minha senha
                </button>
              ) : null}
            </div>
          </form>
        )}

        <div className="login-panel__security">
          <LockKeyhole size={15} />
          <span>Não existe cadastro público. Apenas e-mails previamente aprovados entram.</span>
        </div>

        <button className="demo-link" type="button" onClick={onDemo}>
          Visualizar demonstração com dados fictícios
          <ChevronRight size={16} />
        </button>
      </section>
    </main>
  );
}

export function NewPasswordScreen({
  onDone,
  recovery = false,
}: {
  onDone?: () => void;
  recovery?: boolean;
}) {
  const [current, setCurrent] = useState(
    () => (typeof window !== "undefined" && sessionStorage.getItem("rise-initial-pw")) || "",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não são iguais.");
    if (password === "rise@2026") return setError("Escolha uma senha diferente da inicial.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      ...(recovery ? {} : { current_password: current }),
      data: { must_change_password: false },
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    setBusy(false);
    if (updateError) {
      const code = (updateError as { code?: string }).code;
      const messages: Record<string, string> = {
        current_password_required: "Informe a senha atual (a senha inicial que você recebeu).",
        current_password_mismatch: "A senha atual está incorreta.",
        invalid_credentials: "A senha atual está incorreta.",
        weak_password: "Essa senha é fraca demais. Use letras, números e símbolos.",
        same_password: "A nova senha precisa ser diferente da atual.",
        session_not_found: "Sua sessão expirou. Saia e entre novamente.",
      };
      return setError(messages[code ?? ""] ?? `Não foi possível salvar a senha: ${updateError.message}`);
    }
    sessionStorage.removeItem("rise-initial-pw");
    onDone?.();
  }

  return (
    <main className="login-shell">
      <div className="login-shell__art" aria-hidden="true">
        <div className="orb orb--one" />
        <div className="orb orb--two" />
        <span className="login-shell__spark">✦</span>
      </div>
      <section className="login-panel">
        <RiseMark />
        <div className="login-panel__copy">
          <span className="eyebrow eyebrow--gold">Primeiro acesso</span>
          <h1>Crie sua nova senha.</h1>
          <p>Por segurança, defina uma senha pessoal antes de continuar.</p>
        </div>
        <form className="login-form" onSubmit={save}>
          {!recovery ? (
            <>
              <label htmlFor="rise-current-password">Senha atual</label>
              <input id="rise-current-password" type="password" required autoComplete="current-password"
                value={current} onChange={(e) => setCurrent(e.target.value)} />
            </>
          ) : null}
          <label htmlFor="rise-new-password">Nova senha</label>
          <input id="rise-new-password" type="password" required autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <label htmlFor="rise-confirm-password">Repita a nova senha</label>
          <input id="rise-confirm-password" type="password" required autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button--primary button--wide" type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar e entrar"}
            {!busy ? <ArrowRight size={18} /> : null}
          </button>
        </form>
      </section>
    </main>
  );
}

function ProgressRing({ value }: { value: number }) {
  return (
    <div
      className="progress-ring"
      style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}
    >
      <div className="progress-ring__inside">
        <strong>{value}%</strong>
        <span>concluído</span>
      </div>
    </div>
  );
}

function Header({
  activeView,
  onView,
  role,
  name,
  demo,
  onRole,
  onExit,
}: {
  activeView: View;
  onView: (view: View) => void;
  role: Role;
  name: string;
  demo: boolean;
  onRole: (role: Role) => void;
  onExit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const { data: me } = useMyProfile(!demo);
  const nav: Array<{ label: string; view: View }> =
    role === "mentee"
      ? [
          { label: "Início", view: "inicio" },
          { label: "Minha jornada", view: "jornada" },
          { label: "Agenda", view: "agenda" },
          { label: "Entregas", view: "entregas" },
          { label: "RISE 90", view: "rise90" },
        ]
      : [
          { label: "Painel", view: "painel" },
          { label: "Agenda", view: "agenda" },
          { label: "Entregas", view: "entregas" },
          ...(role === "admin" ? [{ label: "Alunas e turmas", view: "alunas" as View }] : []),
        ];

  return (
    <header className="app-header">
      <button
        className="mobile-menu"
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Menu"
      >
        <Menu size={22} />
      </button>
      <RiseMark compact />
      <nav
        className={`main-nav ${menuOpen ? "main-nav--open" : ""}`}
        aria-label="Navegação principal"
      >
        {nav.map((item) => (
          <button
            key={item.view}
            className={activeView === item.view ? "is-active" : ""}
            type="button"
            onClick={() => {
              onView(item.view);
              setMenuOpen(false);
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <button className="icon-button search-button" type="button" aria-label="Buscar">
          <Search size={20} />
        </button>
        {!demo ? (
          <NotificationBell
            onNavigate={(link) =>
              onView(
                (role === "mentee"
                  ? link.startsWith("lesson:") ? "jornada" : link
                  : ["agenda", "entregas"].includes(link) ? link : "painel") as View,
              )
            }
          />
        ) : (
          <button className="icon-button notification-button" type="button" aria-label="Notificações">
            <Bell size={20} />
          </button>
        )}
        <div className="profile-menu">
          <button
            className="profile-trigger"
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <Avatar name={me?.full_name ?? name} url={demo ? null : me?.avatar_url} size={36} />
            <span className="profile-trigger__copy">
              <strong>{name}</strong>
              <small>{roleLabels[role]}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          {profileOpen ? (
            <div className="profile-dropdown">
              {demo ? (
                <>
                  <span className="profile-dropdown__label">Visualizar como</span>
                  {(["mentee", "mentor", "admin"] as Role[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={role === option ? "is-active" : ""}
                      onClick={() => {
                        onRole(option);
                        setProfileOpen(false);
                      }}
                    >
                      {roleLabels[option]}
                      {role === option ? <Check size={15} /> : null}
                    </button>
                  ))}
                  <div className="dropdown-divider" />
                </>
              ) : null}
              {!demo ? (
                <button type="button" onClick={() => { setEditProfile(true); setProfileOpen(false); }}>
                  <UserRound size={16} /> Meu perfil
                </button>
              ) : null}
              <button type="button" onClick={onExit}>
                <LogOut size={16} /> Sair
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {editProfile ? <ProfileModal role={role} onClose={() => setEditProfile(false)} /> : null}
    </header>
  );
}

const accents = [
  "linear-gradient(135deg, #8f3544 0%, #461520 58%, #100608 100%)",
  "linear-gradient(135deg, #a34c61 0%, #3e111d 72%, #11070a 100%)",
  "linear-gradient(135deg, #d0ac5c 0%, #79541f 46%, #181006 100%)",
  "linear-gradient(135deg, #74404e 0%, #331720 60%, #0b0608 100%)",
  "linear-gradient(135deg, #8f6670 0%, #432830 58%, #100a0c 100%)",
  "linear-gradient(135deg, #5a0f14 0%, #2a0709 60%, #0b0304 100%)",
];

function currentPhase(trail: Trail) {
  return trail.phases.find((p) => p.month === trail.currentMonth) ?? trail.phases[0];
}

function Hero({
  trail,
  onContinue,
  onJourney,
}: {
  trail: Trail;
  onContinue: () => void;
  onJourney: () => void;
}) {
  const phase = currentPhase(trail);
  const pending = phase?.lessons.filter((l) => !l.completed).length ?? 0;
  const previous = trail.phases.find((p) => p.month === (phase?.month ?? 1) - 1);
  return (
    <section className="hero">
      <div className="hero__ambient" aria-hidden="true">
        <span className="hero__monogram">{phase?.pillar.replace(/\s|·/g, "") ?? "R"}</span>
        <span className="hero__star">✦</span>
        <span className="hero__arc hero__arc--one" />
        <span className="hero__arc hero__arc--two" />
      </div>
      <div className="hero__content page-width">
        <div className="hero__copy">
          <span className="eyebrow">
            <span className="eyebrow__dot" /> Mês {phase?.month ?? 1} · {phase?.title ?? "Reflexão"}
          </span>
          <h1>
            {phase?.question ?? "Onde estou?"}
          </h1>
          <p>{phase?.description}</p>
          <div className="hero__meta">
            {previous ? (
              <span>
                <CheckCircle2 size={16} /> {previous.title}
              </span>
            ) : null}
            <span>
              <UsersRound size={16} /> {phase?.mentor}
            </span>
          </div>
          <div className="hero__actions">
            <button className="button button--primary" type="button" onClick={onContinue}>
              <Play size={18} fill="currentColor" /> {trail.progressPct ? "Continuar jornada" : "Começar jornada"}
            </button>
            <button className="button button--glass" type="button" onClick={onJourney}>
              Ver trilha completa <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <div className="hero__progress">
          <ProgressRing value={trail.progressPct} />
          <div>
            <span>Próximo marco</span>
            <strong>{phase?.deliverable?.title ?? "—"}</strong>
            <small>
              {pending} {pending === 1 ? "etapa" : "etapas"} para avançar
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContentCard({ item, onOpen }: { item: TrailLesson; onOpen: (item: TrailLesson) => void }) {
  return (
    <button className="content-card" type="button" onClick={() => onOpen(item)}>
      <div className="content-card__art" style={{ background: accents[(item.month - 1) % accents.length] }}>
        <span className="content-card__type">{item.kind === "aula" ? "Aula" : item.format ?? "Encontro"}</span>
        <span className="content-card__spark">✦</span>
        <span className="content-card__initial">{item.title.charAt(0)}</span>
        <span className="content-card__play">
          {item.completed ? <Check size={19} /> : <Play size={19} fill="currentColor" />}
        </span>
      </div>
      {item.completed ? (
        <div className="card-progress">
          <span style={{ width: "100%" }} />
        </div>
      ) : null}
      <div className="content-card__body">
        <span>
          Mês {item.month} · {item.phaseTitle}
        </span>
        <strong>{item.title}</strong>
        <small>
          {item.mentor} · {item.duration} min
        </small>
      </div>
    </button>
  );
}

function Rail({
  title,
  subtitle,
  items,
  onOpen,
}: {
  title: string;
  subtitle?: string | undefined;
  items: TrailLesson[];
  onOpen: (item: TrailLesson) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="content-section page-width">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="content-rail">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function phaseStatus(trail: Trail, month: number) {
  return month < trail.currentMonth ? "completed" : month === trail.currentMonth ? "current" : "upcoming";
}

function JourneyRail({ trail, onView }: { trail: Trail; onView: () => void }) {
  return (
    <section className="content-section page-width">
      <div className="section-heading">
        <div>
          <h2>Sua jornada de 6 meses</h2>
          <p>Do autoconhecimento à evolução aplicada e sustentada.</p>
        </div>
        <button type="button" onClick={onView}>
          Abrir jornada <ChevronRight size={17} />
        </button>
      </div>
      <div className="journey-rail">
        {trail.phases.map((item) => {
          const status = phaseStatus(trail, item.month);
          return (
            <article key={item.month} className={`journey-card journey-card--${status}`}>
              <div className="journey-card__top">
                <span>MÊS {item.month}</span>
                {status === "completed" ? <CheckCircle2 size={19} /> : null}
                {status === "current" ? <span className="status-pill">AGORA</span> : null}
              </div>
              <div className="journey-card__letter">{item.pillar}</div>
              <h3>{item.title}</h3>
              <p>{item.question}</p>
              <div className="journey-card__delivery">
                <FileCheck2 size={15} /> {item.deliverable?.title}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HomeView({
  trail,
  onView,
  onOpen,
}: {
  trail: Trail;
  onView: (view: View) => void;
  onOpen: (l: TrailLesson) => void;
}) {
  const phase = currentPhase(trail);
  const next = trail.phases.find((p) => p.month === trail.currentMonth + 1);
  const firstPending = phase?.lessons.find((l) => !l.completed) ?? phase?.lessons[0];
  const revisit = trail.phases.flatMap((p) => p.lessons).filter((l) => l.completed && l.kind === "aula");
  return (
    <>
      <Hero
        trail={trail}
        onContinue={() => firstPending && onOpen(firstPending)}
        onJourney={() => onView("jornada")}
      />
      <div className="dashboard-body">
        <Rail
          title={`Mês ${phase?.month ?? 1} · ${phase?.title ?? ""}`}
          subtitle="Encontros, sessões e aulas desta etapa."
          items={phase?.lessons ?? []}
          onOpen={onOpen}
        />
        <JourneyRail trail={trail} onView={() => onView("jornada")} />
        <Rail
          title="Prepare o seu próximo movimento"
          subtitle={next ? `Mês ${next.month} · ${next.title}` : undefined}
          items={next?.lessons ?? []}
          onOpen={onOpen}
        />
        <Rail title="Revisite quando quiser" items={revisit} onOpen={onOpen} />
        <MentorRail />
        <NextMeetingBanner onAgenda={() => onView("agenda")} />
        {!trail.demo ? <MentorsSection /> : null}
        <NextUp trail={trail} onAgenda={() => onView("agenda")} />
      </div>
    </>
  );
}

function MentorRail() {
  return (
    <section className="content-section page-width">
      <div className="section-heading">
        <div>
          <h2>Quatro perspectivas. Uma jornada.</h2>
          <p>Mentoras complementares para desafios reais.</p>
        </div>
      </div>
      <div className="mentor-rail">
        {mentors.map((mentor) => (
          <article className="mentor-card" key={mentor.name}>
            <div
              className="mentor-avatar"
              style={{ "--mentor-color": mentor.color } as React.CSSProperties}
            >
              <span>{mentor.initials}</span>
            </div>
            <div>
              <span>{mentor.pillar}</span>
              <h3>{mentor.name}</h3>
              <p>{mentor.copy}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NextUp({ trail, onAgenda }: { trail: Trail; onAgenda: () => void }) {
  const meetings = trail.phases.flatMap((p) => p.lessons).filter((l) => l.kind === "encontro" && !l.completed);
  const upcoming =
    meetings
      .filter((m) => m.scheduledAt && new Date(m.scheduledAt).getTime() > Date.now())
      .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0] ?? meetings[0];
  if (!upcoming) return null;
  const d = upcoming.scheduledAt ? new Date(upcoming.scheduledAt) : null;
  return (
    <section className="next-up page-width">
      <div className="next-up__date">
        <strong>{d ? String(d.getDate()).padStart(2, "0") : "✦"}</strong>
        <span>
          {d ? d.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toUpperCase() : `MÊS ${upcoming.month}`}
        </span>
      </div>
      <div className="next-up__copy">
        <span>Seu próximo encontro</span>
        <h2>{upcoming.title}</h2>
        <p>
          {upcoming.format} com {upcoming.mentor} · {formatWhen(upcoming.scheduledAt)}
        </p>
      </div>
      <button className="button button--glass" type="button" onClick={onAgenda}>
        Ver agenda <ArrowRight size={17} />
      </button>
    </section>
  );
}

function PageIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="page-intro page-width">
      <span className="eyebrow eyebrow--gold">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </div>
  );
}

function JourneyView({ trail, onOpen }: { trail: Trail; onOpen: (l: TrailLesson) => void }) {
  return (
    <main className="inner-page">
      <PageIntro
        eyebrow="RISE NOW · 6 meses"
        title="Sua jornada, em uma única visão."
        copy="Cada etapa transforma clareza em decisão, posicionamento, liderança e execução."
      />
      <section className="journey-timeline page-width">
        {trail.phases.map((item, index) => {
          const status = phaseStatus(trail, item.month);
          return (
            <article className={`timeline-item timeline-item--${status}`} key={item.month}>
              <div className="timeline-item__axis">
                <span>{item.month}</span>
                {index < trail.phases.length - 1 ? <i /> : null}
              </div>
              <div className="timeline-item__content">
                <div>
                  <span>
                    {item.pillar} · {item.mentor}
                  </span>
                  <h2>{item.title}</h2>
                  <p>{item.question}</p>
                  <ul className="timeline-lessons">
                    {item.lessons.map((l) => (
                      <li key={l.id}>
                        <button type="button" onClick={() => onOpen(l)}>
                          {l.completed ? <CheckCircle2 size={14} /> : <Play size={13} />}
                          {l.title}
                          <small>{l.kind === "aula" ? "Aula" : l.format}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="timeline-item__delivery">
                  <small>ENTREGA</small>
                  <strong>{item.deliverable?.title}</strong>
                </div>
                <div className="timeline-item__state">
                  {status === "completed" ? (
                    <>
                      <CheckCircle2 size={18} /> Concluído
                    </>
                  ) : status === "current" ? (
                    <>
                      <Sparkles size={18} /> Em andamento
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={17} /> Em breve
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
      {!trail.demo ? <MentorsSection /> : null}
    </main>
  );
}

function AgendaView({ trail, onOpen }: { trail: Trail; onOpen: (l: TrailLesson) => void }) {
  return (
    <main className="inner-page">
      <PageIntro
        eyebrow="Encontros"
        title="Agenda RISE"
        copy="Sessões individuais e encontros coletivos reunidos em um só lugar."
      />
      <MenteeMeetings />
      <div className="page-width section-heading ops-gap">
        <div>
          <h2>Sessões previstas na trilha</h2>
        </div>
      </div>
      <TrailAgenda trail={trail} onOpen={onOpen} />
    </main>
  );
}

function DeliverablesView({ trail }: { trail: Trail }) {
  return (
    <main className="inner-page">
      <PageIntro
        eyebrow="Evidências de evolução"
        title="Suas entregas"
        copy="Envie texto, arquivo ou link. A mentora acompanha cada etapa."
      />
      <TrailDeliverables trail={trail} />
    </main>
  );
}

function MenteeArea({ demo, view, onView }: { demo: boolean; view: View; onView: (v: View) => void }) {
  const { data: trail, isLoading } = useTrail(demo);
  const [lesson, setLesson] = useState<TrailLesson | null>(null);
  if (isLoading) return <main className="inner-page" />;
  if (!trail || !trail.phases.length)
    return (
      <main className="inner-page">
        <PageIntro eyebrow="RISE NOW" title="Sua jornada está sendo preparada." copy="Em breve sua trilha aparece aqui." />
      </main>
    );
  return (
    <>
      {view === "inicio" ? (
        <HomeView trail={trail} onView={onView} onOpen={setLesson} />
      ) : view === "jornada" ? (
        <JourneyView trail={trail} onOpen={setLesson} />
      ) : view === "agenda" ? (
        <AgendaView trail={trail} onOpen={setLesson} />
      ) : view === "entregas" ? (
        <DeliverablesView trail={trail} />
      ) : (
        trail.enrollmentId && !trail.demo ? <Rise90Live enrollmentId={trail.enrollmentId} /> : <Rise90View />
      )}
      {lesson ? <LessonScreen lesson={lesson} trail={trail} onClose={() => setLesson(null)} /> : null}
    </>
  );
}

function Rise90View() {
  const goals = [
    {
      title: "Aumentar minha presença executiva",
      metric: "Reuniões estratégicas conduzidas",
      current: 3,
      target: 8,
    },
    {
      title: "Aplicar IA à rotina de liderança",
      metric: "Horas poupadas por semana",
      current: 2,
      target: 5,
    },
    {
      title: "Delegar com mais clareza",
      metric: "Rituais de acompanhamento implantados",
      current: 1,
      target: 3,
    },
  ];
  return (
    <main className="inner-page rise90-page">
      <PageIntro
        eyebrow="Execução e evidência"
        title="RISE 90"
        copy="Metas que conectam intenção, comportamento e resultado em um ciclo de 90 dias."
      />
      <section className="rise90-summary page-width">
        <div>
          <Target size={26} />
          <span>Ciclo atual</span>
          <strong>START → NOW</strong>
        </div>
        <div>
          <span>Dia</span>
          <strong>
            24 <small>de 90</small>
          </strong>
        </div>
        <div>
          <span>Consistência</span>
          <strong>82%</strong>
        </div>
      </section>
      <section className="goal-list page-width">
        {goals.map((goal) => {
          const pct = Math.round((goal.current / goal.target) * 100);
          return (
            <article className="goal-card" key={goal.title}>
              <div className="goal-card__copy">
                <span>OBJETIVO</span>
                <h2>{goal.title}</h2>
                <p>{goal.metric}</p>
              </div>
              <div className="goal-card__number">
                <strong>{goal.current}</strong>
                <span>/ {goal.target}</span>
              </div>
              <div className="goal-card__progress">
                <span style={{ width: `${pct}%` }} />
              </div>
              <small>{pct}% do alvo</small>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function MentorDashboard() {
  return (
    <main className="inner-page">
      <PageIntro
        eyebrow="Área da mentora"
        title="Acompanhe com profundidade."
        copy="Veja somente as participantes atribuídas a você e os sinais importantes de cada jornada."
      />
      <section className="mentor-stats page-width">
        <article>
          <UsersRound size={23} />
          <span>Mentoradas ativas</span>
          <strong>4</strong>
        </article>
        <article>
          <CalendarDays size={23} />
          <span>Sessões nesta semana</span>
          <strong>3</strong>
        </article>
        <article>
          <FileCheck2 size={23} />
          <span>Entregas para revisar</span>
          <strong>2</strong>
        </article>
      </section>
      <section className="people-section page-width">
        <div className="section-heading">
          <div>
            <h2>Suas mentoradas</h2>
            <p>Progresso, etapa atual e próximo encontro.</p>
          </div>
        </div>
        <div className="people-table">
          {demoMentees.map((mentee) => (
            <article key={mentee.name}>
              <span className="profile-avatar">
                {mentee.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div>
                <strong>{mentee.name}</strong>
                <small>{mentee.phase}</small>
              </div>
              <div className="table-progress">
                <span>
                  <i style={{ width: `${mentee.progress}%` }} />
                </span>
                <small>{mentee.progress}%</small>
              </div>
              <div className="next-label">
                <small>Próximo</small>
                <strong>{mentee.next}</strong>
              </div>
              <button type="button" aria-label={`Abrir ${mentee.name}`}>
                <ChevronRight size={19} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function AdminDashboard() {
  const pending = ["paula@empresa.com", "mariana@negocio.com"];
  return (
    <main className="inner-page">
      <PageIntro
        eyebrow="Administração segura"
        title="Gestão da RISE NOW"
        copy="Acessos, papéis, programas e acompanhamento com rastreabilidade."
      />
      <section className="mentor-stats page-width">
        <article>
          <UsersRound size={23} />
          <span>Participantes</span>
          <strong>18</strong>
        </article>
        <article>
          <ShieldCheck size={23} />
          <span>Acessos aprovados</span>
          <strong>22</strong>
        </article>
        <article>
          <FileCheck2 size={23} />
          <span>Entregas no mês</span>
          <strong>31</strong>
        </article>
      </section>
      <section className="admin-grid page-width">
        <article className="admin-card">
          <div className="section-heading">
            <div>
              <h2>Solicitações de acesso</h2>
              <p>Somente e-mails aprovados podem entrar.</p>
            </div>
            <span className="count-badge">{pending.length}</span>
          </div>
          <div className="access-list">
            {pending.map((email) => (
              <div key={email}>
                <span className="profile-avatar">
                  <CircleUserRound size={20} />
                </span>
                <div>
                  <strong>{email}</strong>
                  <small>Aguardando decisão</small>
                </div>
                <button className="approve-button" type="button">
                  Aprovar
                </button>
              </div>
            ))}
          </div>
        </article>
        <article className="admin-card admin-card--security">
          <ShieldCheck size={30} />
          <span>Segurança</span>
          <h2>Proteção por papel ativa</h2>
          <p>Mentoradas, mentoras e administradoras têm acessos isolados por políticas no banco.</p>
          <ul>
            <li>
              <Check size={15} /> Cadastro público desativado
            </li>
            <li>
              <Check size={15} /> RLS deny-by-default
            </li>
            <li>
              <Check size={15} /> Auditoria administrativa
            </li>
          </ul>
        </article>
      </section>
    </main>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer page-width">
      <RiseMark compact />
      <p>Complementares. Simples. Possíveis.</p>
      <span>© 2026 RISE NOW · Ambiente privado</span>
    </footer>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <RiseMark />
      <span>Preparando sua jornada…</span>
    </main>
  );
}

export function RisePlatform() {
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [role, setRole] = useState<Role>("mentee");
  const [name, setName] = useState("Marina Alves");
  const [activeView, setActiveView] = useState<View>("inicio");

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!data.session) {
          setAuthMode("login");
          return;
        }

        if (data.session.user.user_metadata?.['must_change_password']) {
          setAuthMode("change-password");
          return;
        }
        const userId = data.session.user.id;
        const [profileResult, rolesResult] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId).limit(1),
        ]);
        if (!mounted) return;

        const resolvedRole = rolesResult.data?.[0]?.role;
        if (
          profileResult.error ||
          rolesResult.error ||
          !profileResult.data ||
          !resolvedRole ||
          !(["mentee", "mentor", "admin"] as const).includes(resolvedRole)
        ) {
          await supabase.auth.signOut();
          if (mounted) setAuthMode("login");
          return;
        }

        setName(
          profileResult.data.full_name ||
            data.session.user.email?.split("@")[0] ||
            "Participante RISE",
        );
        setRole(resolvedRole);
        setActiveView((v) => (resolvedRole === "mentee" ? (v === "painel" || v === "alunas" ? "inicio" : v) : v === "inicio" ? "painel" : v));
        setAuthMode("authenticated");
      } catch {
        if (mounted) setAuthMode("login");
      }
    }

    void resolveSession();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void resolveSession());
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const demo = authMode === "demo";
  const shellClass = useMemo(() => `platform-shell platform-shell--${role}`, [role]);

  async function exit() {
    if (!demo) await supabase.auth.signOut();
    setRole("mentee");
    setName("Marina Alves");
    setAuthMode("login");
  }

  if (authMode === "checking") return <LoadingScreen />;
  if (authMode === "change-password") return <NewPasswordScreen />;
  if (authMode === "login") return <LoginScreen onDemo={() => setAuthMode("demo")} />;

  return (
    <div className={shellClass}>
      {demo ? (
        <div className="demo-banner">
          <Sparkles size={14} /> Demonstração visual · os dados abaixo são fictícios
        </div>
      ) : null}
      <Header
        activeView={activeView}
        onView={setActiveView}
        role={role}
        name={!demo || role === "mentee" ? name : role === "mentor" ? "Gabriela Ribeiro" : "Camila Mariano"}
        demo={demo}
        onRole={(nextRole) => {
          setRole(nextRole);
          setActiveView(nextRole === "mentee" ? "inicio" : "painel");
        }}
        onExit={() => void exit()}
      />
      {role !== "mentee" && demo ? (
        role === "mentor" ? <MentorDashboard /> : <AdminDashboard />
      ) : role !== "mentee" ? (
        <StaffArea
          isAdmin={role === "admin"}
          view={(["painel", "agenda", "entregas", "alunas"].includes(activeView) ? activeView : "painel") as StaffView}
          onView={setActiveView}
        />
      ) : (
        <MenteeArea demo={demo} view={activeView} onView={setActiveView} />
      )}
      <AppFooter />
    </div>
  );
}
