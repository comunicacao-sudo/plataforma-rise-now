import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  UserRound,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Mail,
  Play,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  Avatar,
  NotificationBell,
  ProfileModal,
  Rise90Live,
  MentorsView,
  useMyProfile,
} from "@/components/rise-extras";
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
import {
  GoogleCalendarCard,
  MenteeMeetings,
  NextMeetingBanner,
  StaffArea,
  type StaffView,
} from "@/components/rise-ops";
import { MenteeBookingAgenda, RiseCalendar } from "@/components/rise-calendar";
import { NextStepHero } from "@/components/journey-next-step";
import { RecordedLessonPage } from "@/components/recorded-lessons";
import {
  ContinueJourneySection,
  JourneyContentLessonPage,
  JourneyContentLibraryPage,
  NextMovementSection,
  useJourneyContentLibrary,
} from "@/components/journey-content";
import type { JourneyContentItem } from "@/lib/content.functions";
import { installDialogAccessibility } from "@/lib/dialog-accessibility";
import { findJourneyContentForLesson, hasOpenableJourneyContent } from "@/lib/journey-navigation";
import {
  AssessmentProfileModal,
  AssessmentVisualPreview,
  AssessmentVisualQuestionPreview,
} from "@/components/rise-assessment";
import {
  getNextJourneyStep,
  startJourneyStep,
  type NextJourneyStep,
} from "@/lib/journey.functions";
import { resolveAppRole, type AppRole } from "@/lib/access";
import { liveJourneyQueryOptions, resolveJourneyThemeCovers } from "@/lib/journey-sync";
import { SectionHero } from "@/components/section-hero";
import {
  applyRiseTheme,
  normalizeRiseTheme,
  readLocalRiseTheme,
  RISE_THEME_EVENT,
  type RiseTheme,
} from "@/lib/theme";
import { LegalFooterLinks } from "@/components/rise-legal";

type Role = AppRole;
type View =
  | "inicio"
  | "jornada"
  | "agenda"
  | "entregas"
  | "rise90"
  | "mentoras"
  | "painel"
  | "gestao-jornada"
  | "conteudos"
  | "alunas"
  | "turmas-acessos"
  | "whatsapp";
type AuthMode = "checking" | "login" | "authenticated" | "change-password";

const menteeViews: View[] = ["inicio", "jornada", "agenda", "entregas", "rise90", "mentoras"];
const staffViews: View[] = [
  "painel",
  "gestao-jornada",
  "conteudos",
  "agenda",
  "entregas",
  "alunas",
  "turmas-acessos",
  "whatsapp",
];

function defaultViewForRole(role: Role): View {
  return role === "mentee" ? "inicio" : "painel";
}

function allowedViewsForRole(role: Role) {
  return role === "mentee" ? menteeViews : staffViews;
}

const roleLabels: Record<Role, string> = {
  mentee: "Mentorada",
  admin: "Mentora · Administradora",
};

const journeyCoverByMonth: Record<number, string> = {
  1: "/journey-covers/reflection.jpg",
  2: "/journey-covers/identity-security.jpg",
  3: "/journey-covers/direction.jpg",
  4: "/journey-covers/execution.jpg",
  5: "/journey-covers/consistency.jpg",
  6: "/journey-covers/sustentation.jpg",
};

function RiseMark({ compact = false, onActivate }: { compact?: boolean; onActivate?: () => void }) {
  const content = (
    <>
      <span className="rise-mark__brand" aria-hidden="true">
        <img
          src="/brand/rise-logo-white-app.webp"
          alt=""
          className="rise-mark__logo rise-mark__logo--dark"
        />
        <img
          src="/brand/rise-logo-light-app.webp"
          alt=""
          className="rise-mark__logo rise-mark__logo--light"
        />
      </span>
      {!compact ? (
        <span className="rise-mark__pillars">Reflexão · Identidade · Segurança · Evolução</span>
      ) : null}
    </>
  );
  const className = `rise-mark ${compact ? "rise-mark--compact" : ""}`;
  return onActivate ? (
    <button
      className={`${className} rise-mark--button`}
      type="button"
      onClick={onActivate}
      aria-label="Voltar para o início"
    >
      {content}
    </button>
  ) : (
    <div className={className} role="img" aria-label="RISE NOW">
      {content}
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (authError) {
        setError("Email ou senha incorretos.");
        return;
      }
    } catch {
      setError(
        "Não foi possível liberar o acesso. Confirme se este é o email aprovado pela equipe RISE.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Digite seu email acima para receber o link de nova senha.");
      return;
    }
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) setError("Não foi possível enviar o link agora. Tente novamente.");
    else setSent(true);
  }

  return (
    <main className="login-shell">
      <div className="login-shell__art" aria-hidden="true">
        <div className="orb orb--one" />
        <div className="orb orb--two" />
        <div className="orb orb--three" />
        <span className="login-shell__spark">✦</span>
        <div className="login-shell__line" />
        <p className="login-shell__mantra">REFLEXÃO · IDENTIDADE · SEGURANÇA · EVOLUÇÃO</p>
      </div>

      <section className="login-panel">
        <div className="login-panel__content">
          <RiseMark />
          <div className="login-panel__copy">
            <h1>Seu próximo nível começa por dentro.</h1>
            <p>Acesse sua mentoria e acompanhe sua jornada de evolução.</p>
          </div>

          {sent ? (
            <div className="access-sent" role="status">
              <div className="access-sent__icon">
                <Check />
              </div>
              <div>
                <strong>Confira seu email</strong>
                <p>Enviamos um link para você criar uma nova senha.</p>
              </div>
            </div>
          ) : (
            <form className="login-form" onSubmit={requestAccess}>
              <div className="login-form__field">
                <label htmlFor="rise-email">Email</label>
                <div className="login-form__control">
                  <Mail size={19} aria-hidden="true" />
                  <input
                    id="rise-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>
              <div className="login-form__field">
                <label htmlFor="rise-password">Senha</label>
                <div className="login-form__control">
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input
                    id="rise-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="login-form__reveal"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                  </button>
                </div>
              </div>
              <p className="login-form__hint">
                Acesso seguro. Use o email aprovado pela equipe RISE.
              </p>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="button button--primary button--wide" type="submit" disabled={busy}>
                {busy ? "Verificando…" : "Entrar"}
                {!busy ? <ArrowRight size={21} /> : null}
              </button>
              <div className="login-form__links">
                <button className="demo-link" type="button" onClick={() => void forgotPassword()}>
                  Esqueci minha senha
                </button>
                <span>Ambiente exclusivo RISE</span>
              </div>
            </form>
          )}
          <div className="login-panel__legal">
            <LegalFooterLinks />
          </div>
        </div>
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
      data: { must_change_password: false },
    });
    setBusy(false);
    if (updateError) {
      const code = (updateError as { code?: string }).code;
      const messages: Record<string, string> = {
        invalid_credentials: "Sua sessão expirou. Solicite um novo link ou entre novamente.",
        weak_password: "Essa senha é fraca demais. Use letras, números e símbolos.",
        same_password: "A nova senha precisa ser diferente da atual.",
        session_not_found: "Sua sessão expirou. Saia e entre novamente.",
      };
      return setError(
        messages[code ?? ""] ?? `Não foi possível salvar a senha: ${updateError.message}`,
      );
    }
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
        <div className="login-panel__content">
          <RiseMark />
          <div className="login-panel__copy">
            <span className="eyebrow eyebrow--gold">
              {recovery ? "Recuperação de acesso" : "Primeiro acesso"}
            </span>
            <h1>Crie sua nova senha.</h1>
            <p>Por segurança, defina uma senha pessoal antes de continuar.</p>
          </div>
          <form className="login-form" onSubmit={save}>
            <label htmlFor="rise-new-password">Nova senha</label>
            <input
              id="rise-new-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="rise-confirm-password">Repita a nova senha</label>
            <input
              id="rise-confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button button--primary button--wide" type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar e entrar"}
              {!busy ? <ArrowRight size={18} /> : null}
            </button>
          </form>
        </div>
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
  onExit,
}: {
  activeView: View;
  onView: (view: View) => void;
  role: Role;
  name: string;
  onExit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const { data: me } = useMyProfile(true);
  const nav: Array<{ label: string; view: View }> =
    role === "mentee"
      ? [
          { label: "Início", view: "inicio" },
          { label: "Minha jornada", view: "jornada" },
          { label: "Agenda", view: "agenda" },
          { label: "Entregas", view: "entregas" },
          { label: "RISE 90", view: "rise90" },
          { label: "Mentoras", view: "mentoras" },
        ]
      : [
          { label: "Painel", view: "painel" },
          { label: "Minha jornada", view: "gestao-jornada" },
          { label: "Conteúdos", view: "conteudos" },
          { label: "Agenda", view: "agenda" },
          { label: "Entregas", view: "entregas" },
          { label: "Alunas", view: "alunas" },
          { label: "Turmas e acessos", view: "turmas-acessos" },
          { label: "WhatsApp", view: "whatsapp" },
        ];
  const visibleName = me?.display_name?.trim() || me?.full_name || name;
  const profileSubtitle =
    role === "mentee" && me?.profession_visible && me.profession ? me.profession : roleLabels[role];

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
      <RiseMark compact onActivate={() => onView(role === "mentee" ? "inicio" : "painel")} />
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
        <NotificationBell
          onNavigate={(link) =>
            onView(
              (role === "mentee"
                ? link.startsWith("lesson:")
                  ? "jornada"
                  : link
                : ["agenda", "entregas"].includes(link)
                  ? link
                  : "painel") as View,
            )
          }
        />
        <div className="profile-menu">
          <button
            className="profile-trigger"
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <Avatar name={visibleName} url={me?.avatar_url} size={36} />
            <span className="profile-trigger__copy">
              <strong>{visibleName}</strong>
              <small>{profileSubtitle}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          {profileOpen ? (
            <div className="profile-dropdown">
              <button
                type="button"
                onClick={() => {
                  setEditProfile(true);
                  setProfileOpen(false);
                }}
              >
                <UserRound size={16} /> Meu perfil
              </button>
              {role === "mentee" ? (
                <button
                  type="button"
                  onClick={() => {
                    setAssessmentOpen(true);
                    setProfileOpen(false);
                  }}
                >
                  <BrainCircuit size={16} /> Meu mapeamento
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
      {assessmentOpen ? <AssessmentProfileModal onClose={() => setAssessmentOpen(false)} /> : null}
    </header>
  );
}

const accents = [
  "linear-gradient(135deg, var(--rise-terracotta) 0%, var(--rise-graphite) 72%)",
  "linear-gradient(135deg, var(--rise-sand) 0%, var(--rise-graphite) 76%)",
  "linear-gradient(135deg, var(--rise-terracotta) 0%, var(--rise-sand) 48%, var(--rise-graphite) 100%)",
  "linear-gradient(135deg, var(--rise-graphite) 0%, var(--rise-terracotta) 100%)",
  "linear-gradient(135deg, var(--rise-sand) 0%, var(--rise-terracotta) 54%, var(--rise-graphite) 100%)",
  "linear-gradient(135deg, var(--rise-terracotta) 0%, var(--rise-graphite) 62%)",
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
          <h1>{phase?.question ?? "Onde estou?"}</h1>
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
              <Play size={18} fill="currentColor" />{" "}
              {trail.progressPct ? "Continuar jornada" : "Começar jornada"}
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
            <strong>{phase?.deliverable?.title ?? "A definir"}</strong>
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
      <div
        className="content-card__art"
        style={{ background: accents[(item.month - 1) % accents.length] }}
      >
        <span className="content-card__type">
          {item.kind === "aula" ? "Aula" : (item.format ?? "Encontro")}
        </span>
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
  return month < trail.currentMonth
    ? "completed"
    : month === trail.currentMonth
      ? "current"
      : "upcoming";
}

function JourneyRail({
  trail,
  onView,
  coversByMonth,
}: {
  trail: Trail;
  onView: () => void;
  coversByMonth: Map<number, JourneyContentItem>;
}) {
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
          const dynamicCover = coversByMonth.get(item.month);
          const themeCovers = dynamicCover ? resolveJourneyThemeCovers(dynamicCover) : null;
          const fallbackCover = journeyCoverByMonth[item.month];
          const hasCover = Boolean(themeCovers?.light || themeCovers?.dark || fallbackCover);
          return (
            <article
              key={item.month}
              className={`journey-card journey-card--${status}`}
              role="link"
              tabIndex={0}
              aria-label={`Abrir Minha jornada no mês ${item.month}: ${item.title}`}
              onClick={onView}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onView();
                }
              }}
            >
              {themeCovers?.light ? (
                <img
                  className="journey-card__cover journey-card__cover--light"
                  src={themeCovers.light}
                  alt={`${item.title}, mês ${item.month}`}
                  loading={item.month > 2 ? "lazy" : "eager"}
                />
              ) : null}
              {themeCovers?.dark ? (
                <img
                  className="journey-card__cover journey-card__cover--dark"
                  src={themeCovers.dark}
                  alt={`${item.title}, mês ${item.month}`}
                  loading={item.month > 2 ? "lazy" : "eager"}
                />
              ) : null}
              {!themeCovers?.light && !themeCovers?.dark && fallbackCover ? (
                <img
                  className="journey-card__cover"
                  src={fallbackCover}
                  alt={`${item.title}, mês ${item.month}`}
                  loading={item.month > 2 ? "lazy" : "eager"}
                />
              ) : null}
              <div className="journey-card__top">
                <span>MÊS {item.month}</span>
                {status === "completed" ? <CheckCircle2 size={19} /> : null}
                {status === "current" ? <span className="status-pill">AGORA</span> : null}
              </div>
              {!hasCover ? (
                <>
                  <div className="journey-card__letter">{item.pillar}</div>
                  <h3>{item.title}</h3>
                  <p>{item.question}</p>
                </>
              ) : null}
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
  onOpenContent,
}: {
  trail: Trail;
  onView: (view: View) => void;
  onOpen: (l: TrailLesson) => void;
  onOpenContent: (stepKey: string) => void;
}) {
  const loadNext = useServerFn(getNextJourneyStep);
  const startNext = useServerFn(startJourneyStep);
  const queryClient = useQueryClient();
  const journeyLibrary = useJourneyContentLibrary(true);
  const nextStepQuery = useQuery({
    queryKey: ["next-journey-step", trail.enrollmentId],
    queryFn: () => loadNext(),
    enabled: Boolean(trail.enrollmentId),
    ...liveJourneyQueryOptions,
  });
  const coversByMonth = useMemo(() => {
    const covers = new Map<number, JourneyContentItem>();
    for (const item of journeyLibrary.data?.items ?? []) {
      if (
        !covers.has(item.monthNumber) &&
        (item.coverUrl || item.coverUrlLight || item.coverUrlDark)
      ) {
        covers.set(item.monthNumber, item);
      }
    }
    return covers;
  }, [journeyLibrary.data?.items]);
  const revisit = trail.phases
    .flatMap((p) => p.lessons)
    .filter((l) => l.completed && l.kind === "aula");
  const highlightedStep = nextStepQuery.isError
    ? ({ state: "error" } satisfies NextJourneyStep)
    : (nextStepQuery.data ?? ({ state: "no_enrollment" } satisfies NextJourneyStep));

  async function openHighlightedStep() {
    if (highlightedStep.resourceType === "legacy_lesson" && highlightedStep.resourceId) {
      const lesson = trail.phases
        .flatMap((item) => item.lessons)
        .find((item) => item.id === highlightedStep.resourceId);
      if (lesson) {
        onOpen(lesson);
        void markHighlightedStepStarted();
        return;
      }
    }
    if (
      highlightedStep.stepKey &&
      (highlightedStep.hasStageContent ||
        [
          "questionnaire",
          "form",
          "recorded_class",
          "collective_recording",
          "cohort_onboarding",
        ].includes(highlightedStep.format ?? ""))
    ) {
      onOpenContent(highlightedStep.stepKey);
      void markHighlightedStepStarted();
      return;
    }
    if (
      highlightedStep.format === "individual_1_1" &&
      highlightedStep.actionLabel === "Ver meu encontro" &&
      highlightedStep.stepKey
    ) {
      onOpenContent(highlightedStep.stepKey);
      void markHighlightedStepStarted();
      return;
    }
    if (highlightedStep.format === "individual_1_1" || highlightedStep.format === "live_group") {
      if (highlightedStep.resourceUrl) {
        const url = new URL(highlightedStep.resourceUrl);
        if (url.protocol === "https:") window.open(url.toString(), "_blank", "noopener,noreferrer");
      } else onView("agenda");
      void markHighlightedStepStarted();
      return;
    }
    if (highlightedStep.resourceUrl) {
      const url = new URL(highlightedStep.resourceUrl);
      if (url.protocol === "https:") window.open(url.toString(), "_blank", "noopener,noreferrer");
      void markHighlightedStepStarted();
    }
  }

  async function markHighlightedStepStarted() {
    if (!highlightedStep.enrollmentId || !highlightedStep.stepKey) return;
    try {
      await startNext({
        data: { enrollmentId: highlightedStep.enrollmentId, stepKey: highlightedStep.stepKey },
      });
      await queryClient.invalidateQueries({ queryKey: ["next-journey-step"] });
    } catch (error) {
      console.error("Não foi possível registrar o início da etapa.", error);
    }
  }
  return (
    <div className="mentee-home-view">
      <NextStepHero
        step={highlightedStep}
        onAction={() => void openHighlightedStep()}
        busy={nextStepQuery.isPending}
      />
      <div className="dashboard-body">
        <ContinueJourneySection onOpen={(item) => onOpenContent(item.stepKey)} />
        <JourneyRail trail={trail} coversByMonth={coversByMonth} onView={() => onView("jornada")} />
        <NextMovementSection
          currentMonth={trail.currentMonth}
          onOpen={(item) => onOpenContent(item.stepKey)}
        />
        <Rail title="Revisite quando quiser" items={revisit} onOpen={onOpen} />
        <NextMeetingBanner onAgenda={() => onView("agenda")} />
        <NextUp trail={trail} onAgenda={() => onView("agenda")} />
      </div>
    </div>
  );
}

function NextUp({ trail, onAgenda }: { trail: Trail; onAgenda: () => void }) {
  const meetings = trail.phases
    .flatMap((p) => p.lessons)
    .filter((l) => l.kind === "encontro" && !l.completed);
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
          {d
            ? d.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()
            : `MÊS ${upcoming.month}`}
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

function JourneyView({
  trail,
  onOpen,
  onOpenLibrary,
}: {
  trail: Trail;
  onOpen: (l: TrailLesson) => void;
  onOpenLibrary: () => void;
}) {
  return (
    <main className="inner-page inner-page--section-hero">
      <SectionHero
        section="Minha jornada"
        phrase="Cada etapa revela a força que sustenta a sua evolução"
      />
      <div className="page-width journey-recorded-access">
        <div>
          <BookOpen size={24} />
          <span>
            <strong>Aulas gravadas</strong>
            <small>Assista e reveja os conteúdos de cada pilar.</small>
          </span>
        </div>
        <button className="button button--primary" type="button" onClick={onOpenLibrary}>
          Abrir biblioteca <ArrowRight size={17} />
        </button>
      </div>
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
                        <button
                          type="button"
                          disabled={
                            l.kind === "aula" && item.month > trail.currentMonth && !l.completed
                          }
                          onClick={() => onOpen(l)}
                          title={
                            l.kind === "aula" && item.month > trail.currentMonth && !l.completed
                              ? "Esta aula ainda não foi liberada"
                              : undefined
                          }
                        >
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
    </main>
  );
}

function AgendaView({ trail, onOpen }: { trail: Trail; onOpen: (l: TrailLesson) => void }) {
  return (
    <main className="inner-page inner-page--section-hero">
      <SectionHero section="Agenda" phrase="Os encontros certos dão ritmo à sua evolução" />
      <section className="page-width agenda-calendar-connect">
        <GoogleCalendarCard audience="mentee" />
        <RiseCalendar compact />
      </section>
      <MenteeBookingAgenda />
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
    <main className="inner-page inner-page--section-hero">
      <SectionHero
        section="Entregas"
        phrase="Cada entrega torna visível a evolução que você está construindo"
      />
      <TrailDeliverables trail={trail} />
    </main>
  );
}

function MenteeArea({ view, onView }: { view: View; onView: (v: View) => void }) {
  const { data: trail, isLoading } = useTrail();
  const journeyLibrary = useJourneyContentLibrary(true);
  const [lesson, setLesson] = useState<TrailLesson | null>(null);
  const [contentStepKey, setContentStepKey] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  function openJourneyContent(stepKey: string) {
    setLesson(null);
    setLibraryOpen(false);
    setContentStepKey(stepKey);
    if (view !== "jornada") onView("jornada");
  }
  function openTrailLesson(lessonToOpen: TrailLesson) {
    const content = findJourneyContentForLesson(lessonToOpen, journeyLibrary.data?.items ?? []);
    if (hasOpenableJourneyContent(content)) {
      openJourneyContent(content!.stepKey);
      return;
    }
    setContentStepKey(null);
    setLibraryOpen(false);
    setLesson(lessonToOpen);
  }
  useEffect(() => {
    if (view !== "jornada") {
      setContentStepKey(null);
      setLibraryOpen(false);
      return;
    }
    const step = new URLSearchParams(window.location.search).get("step");
    if (
      step &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(step)
    ) {
      setContentStepKey(step);
    }
  }, [view]);
  if (view === "mentoras") return <MentorsView />;
  if (isLoading)
    return (
      <main className="inner-page page-loading" aria-live="polite">
        <RiseMark compact />
        <span>Carregando sua jornada…</span>
      </main>
    );
  if (!trail || !trail.phases.length)
    return (
      <main className="inner-page">
        <PageIntro
          eyebrow="RISE NOW"
          title="Sua jornada está sendo preparada."
          copy="Em breve sua trilha aparece aqui."
        />
      </main>
    );
  return (
    <>
      {contentStepKey ? (
        <JourneyContentLessonPage
          stepKey={contentStepKey}
          onBack={() => setContentStepKey(null)}
          onNavigate={setContentStepKey}
        />
      ) : lesson?.kind === "aula" ? (
        <RecordedLessonPage
          lesson={lesson}
          trail={trail}
          onBack={() => setLesson(null)}
          onNavigate={setLesson}
        />
      ) : libraryOpen && view === "jornada" ? (
        <JourneyContentLibraryPage
          onOpen={(item: JourneyContentItem) => setContentStepKey(item.stepKey)}
          onBack={() => setLibraryOpen(false)}
        />
      ) : view === "inicio" ? (
        <HomeView
          trail={trail}
          onView={onView}
          onOpen={openTrailLesson}
          onOpenContent={openJourneyContent}
        />
      ) : view === "jornada" ? (
        <JourneyView
          trail={trail}
          onOpen={openTrailLesson}
          onOpenLibrary={() => setLibraryOpen(true)}
        />
      ) : view === "agenda" ? (
        <AgendaView trail={trail} onOpen={openTrailLesson} />
      ) : view === "entregas" ? (
        <DeliverablesView trail={trail} />
      ) : trail.enrollmentId ? (
        <Rise90Live enrollmentId={trail.enrollmentId} />
      ) : (
        <main className="inner-page">
          <PageIntro
            eyebrow="RISE 90"
            title="Seu ciclo será liberado em breve."
            copy="A equipe RISE está preparando suas metas e marcos de evolução."
          />
        </main>
      )}
      {lesson?.kind === "encontro" ? (
        <LessonScreen lesson={lesson} trail={trail} onClose={() => setLesson(null)} />
      ) : null}
    </>
  );
}

function AppFooter({ role, onView }: { role: Role; onView: (view: View) => void }) {
  return (
    <footer className="app-footer page-width">
      <RiseMark compact onActivate={() => onView(role === "mentee" ? "inicio" : "painel")} />
      <p>Reflexão, Identidade, Segurança e Evolução</p>
      <div className="rise-app-footer-legal">
        <LegalFooterLinks />
        <span>© 2026 RISE NOW · Ambiente privado</span>
      </div>
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
  useEffect(() => installDialogAccessibility(), []);
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [role, setRole] = useState<Role>("mentee");
  const [name, setName] = useState("Participante RISE");
  const [activeView, setActiveView] = useState<View>("inicio");
  const resolvedUserId = useRef<string | null>(null);
  const [assessmentPreview, setAssessmentPreview] = useState<"report" | "questionnaire" | null>(
    null,
  );
  const [theme, setTheme] = useState<RiseTheme>(() => readLocalRiseTheme());

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      setTheme(normalizeRiseTheme((event as CustomEvent<RiseTheme>).detail));
    };
    window.addEventListener(RISE_THEME_EVENT, handleThemeChange);
    applyRiseTheme(readLocalRiseTheme(), false);
    return () => window.removeEventListener(RISE_THEME_EVENT, handleThemeChange);
  }, []);

  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).get("assessment-preview");
    setAssessmentPreview(
      import.meta.env.DEV && (preview === "1" || preview === "questionnaire")
        ? preview === "questionnaire"
          ? "questionnaire"
          : "report"
        : null,
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!data.session) {
          resolvedUserId.current = null;
          setAuthMode("login");
          return;
        }

        if (data.session.user.user_metadata?.["must_change_password"]) {
          setAuthMode("change-password");
          return;
        }
        const userId = data.session.user.id;
        const [profileResult, rolesResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, full_name")
            .eq("id", userId)
            .maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);
        if (!mounted) return;

        const storedRole = resolveAppRole((rolesResult.data ?? []).map((item) => item.role));
        if (
          profileResult.error ||
          rolesResult.error ||
          !profileResult.data ||
          !storedRole ||
          !(["mentee", "mentor", "admin"] as const).includes(storedRole)
        ) {
          await supabase.auth.signOut();
          if (mounted) setAuthMode("login");
          return;
        }

        resolvedUserId.current = userId;
        setName(
          profileResult.data.display_name ||
            profileResult.data.full_name ||
            data.session.user.email?.split("@")[0] ||
            "Participante RISE",
        );
        const resolvedRole: Role = storedRole === "mentee" ? "mentee" : "admin";
        setRole(resolvedRole);
        const requested = new URLSearchParams(window.location.search).get("view") as View | null;
        const allowedViews = allowedViewsForRole(resolvedRole);
        const targetView =
          requested && allowedViews.includes(requested)
            ? requested
            : defaultViewForRole(resolvedRole);
        setActiveView(targetView);

        // Keep the current application view in the URL so auth refresh/focus events
        // cannot reset the user back to the default screen.
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get("view") !== targetView) {
          currentUrl.searchParams.set("view", targetView);
          window.history.replaceState(window.history.state, "", currentUrl);
        }
        setAuthMode("authenticated");
      } catch {
        if (mounted) setAuthMode("login");
      }
    }

    void resolveSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT" || !session) {
        resolvedUserId.current = null;
        if (mounted) setAuthMode("login");
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        if (mounted) setAuthMode("change-password");
        return;
      }

      if (event === "USER_UPDATED" || resolvedUserId.current !== session.user.id) {
        void resolveSession();
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  function navigateToView(view: View) {
    const allowedViews = allowedViewsForRole(role);
    const targetView = allowedViews.includes(view) ? view : defaultViewForRole(role);
    setActiveView(targetView);

    const nextUrl = new URL(window.location.href);
    const currentView = nextUrl.searchParams.get("view");
    nextUrl.searchParams.set("view", targetView);
    if (targetView !== "jornada") nextUrl.searchParams.delete("step");
    if (targetView !== "alunas") {
      nextUrl.searchParams.delete("mentee");
      nextUrl.searchParams.delete("tab");
    }

    if (currentView !== targetView || window.location.href !== nextUrl.href) {
      window.history.pushState({ ...window.history.state, riseView: targetView }, "", nextUrl);
    }
  }

  useEffect(() => {
    if (authMode !== "authenticated") return;

    const handlePopState = () => {
      const requested = new URLSearchParams(window.location.search).get("view") as View | null;
      const allowedViews = allowedViewsForRole(role);
      setActiveView(
        requested && allowedViews.includes(requested) ? requested : defaultViewForRole(role),
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [authMode, role]);

  const { data: currentProfile } = useMyProfile(authMode === "authenticated");
  useEffect(() => {
    if (authMode !== "authenticated" || !currentProfile) return;
    const savedTheme = normalizeRiseTheme(currentProfile.theme_preference);
    setTheme(savedTheme);
    applyRiseTheme(savedTheme);
  }, [authMode, currentProfile]);
  const shellClass = useMemo(() => `platform-shell platform-shell--${role}`, [role]);

  async function exit() {
    await supabase.auth.signOut();
    setRole("mentee");
    setName("Participante RISE");
    setAuthMode("login");
  }

  if (assessmentPreview)
    return (
      <div className="platform-shell platform-shell--admin" data-theme={theme}>
        <Header
          activeView="painel"
          onView={() => undefined}
          role="admin"
          name="Camila Mariano"
          onExit={() => undefined}
        />
        {assessmentPreview === "questionnaire" ? (
          <AssessmentVisualQuestionPreview />
        ) : (
          <AssessmentVisualPreview />
        )}
      </div>
    );

  if (authMode === "checking") return <LoadingScreen />;
  if (authMode === "change-password") return <NewPasswordScreen />;
  if (authMode === "login") return <LoginScreen />;

  return (
    <div className={shellClass} data-theme={theme}>
      <Header
        activeView={activeView}
        onView={navigateToView}
        role={role}
        name={name}
        onExit={() => void exit()}
      />
      {role !== "mentee" ? (
        <StaffArea
          view={
            ([
              "painel",
              "gestao-jornada",
              "conteudos",
              "agenda",
              "entregas",
              "alunas",
              "turmas-acessos",
              "whatsapp",
            ].includes(activeView)
              ? activeView
              : "painel") as StaffView
          }
          onView={navigateToView}
        />
      ) : (
        <MenteeArea view={activeView} onView={navigateToView} />
      )}
      <AppFooter role={role} onView={navigateToView} />
    </div>
  );
}
