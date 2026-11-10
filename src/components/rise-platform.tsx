import { PwaInstallButton } from "@/components/pwa-install-button";
import { ProtectedOperationHost } from "@/components/protected-operation";
import { deferredView } from "@/components/deferred-view";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Bell,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  UserRound,
  Download,
  Eye,
  EyeOff,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Mail,
  Play,
  ShieldCheck,
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
const MenteeBookingAgenda = deferredView<
  import("react").ComponentProps<typeof import("@/components/rise-calendar").MenteeBookingAgenda> &
    object
>(() =>
  import("@/components/rise-calendar").then((module) => ({ default: module.MenteeBookingAgenda })),
);
const RiseCalendar = deferredView<
  import("react").ComponentProps<typeof import("@/components/rise-calendar").RiseCalendar> & object
>(() => import("@/components/rise-calendar").then((module) => ({ default: module.RiseCalendar })));
import { NextStepHero } from "@/components/journey-next-step";
import { RecordedLessonPage } from "@/components/recorded-lessons";
import {
  ContinueJourneySection,
  JourneyContentLessonPage,
  JourneyContentLibraryPage,
  NextMovementSection,
  useJourneyContentLibrary,
} from "@/components/journey-content";
import type { JourneyContentItem, JourneyContentLibrary } from "@/lib/content.functions";
const JourneyHub = deferredView<
  import("react").ComponentProps<typeof import("@/components/journey-hub").JourneyHub> & object
>(() => import("@/components/journey-hub").then((module) => ({ default: module.JourneyHub })));
import { installDialogAccessibility } from "@/lib/dialog-accessibility";
import { findJourneyContentForLesson, hasOpenableJourneyContent } from "@/lib/journey-navigation";
const AssessmentProfileModal = deferredView<
  import("react").ComponentProps<
    typeof import("@/components/rise-assessment").AssessmentProfileModal
  > &
    object
>(() =>
  import("@/components/rise-assessment").then((module) => ({
    default: module.AssessmentProfileModal,
  })),
);
const AssessmentVisualPreview = deferredView<
  import("react").ComponentProps<
    typeof import("@/components/rise-assessment").AssessmentVisualPreview
  > &
    object
>(() =>
  import("@/components/rise-assessment").then((module) => ({
    default: module.AssessmentVisualPreview,
  })),
);
const AssessmentVisualQuestionPreview = deferredView<
  import("react").ComponentProps<
    typeof import("@/components/rise-assessment").AssessmentVisualQuestionPreview
  > &
    object
>(() =>
  import("@/components/rise-assessment").then((module) => ({
    default: module.AssessmentVisualQuestionPreview,
  })),
);
import {
  getNextJourneyStep,
  startJourneyStep,
  type NextJourneyStep,
} from "@/lib/journey.functions";
import { resolveAppRole, type AppRole } from "@/lib/access";
import { liveJourneyQueryOptions } from "@/lib/journey-sync";
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

const menteeViews: View[] = ["inicio", "jornada", "agenda", "rise90", "mentoras"];
const staffViews: View[] = [
  "painel",
  "gestao-jornada",
  "conteudos",
  "agenda",
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
  mentee: "Participante",
  admin: "Mentora · Administradora",
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

const ACCESS_DENIED_KEY = "rise-access-denied";
const ACCESS_DENIED_MESSAGE =
  "Seu acesso ainda não foi liberado ou foi encerrado. Fale com a equipe RISE NOW para confirmar o e-mail aprovado.";

/** Avisa a tela de login que a conta entrou, mas não tem acesso liberado. */
function signalAccessDenied() {
  try {
    window.sessionStorage.setItem(ACCESS_DENIED_KEY, "1");
  } catch {
    /* sem armazenamento: o evento abaixo ainda avisa a tela aberta */
  }
  window.dispatchEvent(new Event(ACCESS_DENIED_KEY));
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Senha certa, mas sem acesso liberado: explica em vez de voltar em silêncio.
  useEffect(() => {
    const show = () => {
      try {
        if (window.sessionStorage.getItem(ACCESS_DENIED_KEY) !== "1") return;
        window.sessionStorage.removeItem(ACCESS_DENIED_KEY);
      } catch {
        /* segue e mostra a mensagem */
      }
      setError(ACCESS_DENIED_MESSAGE);
    };
    show();
    window.addEventListener(ACCESS_DENIED_KEY, show);
    return () => window.removeEventListener(ACCESS_DENIED_KEY, show);
  }, []);

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
            <PwaInstallButton />
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
          { label: "RISE 90", view: "rise90" },
          { label: "Mentoras", view: "mentoras" },
        ]
      : [
          { label: "Painel", view: "painel" },
          { label: "Jornada", view: "gestao-jornada" },
          { label: "Conteúdos", view: "conteudos" },
          { label: "Agenda", view: "agenda" },
          { label: "Participantes", view: "alunas" },
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
              <PwaInstallButton />
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

function HomeView({
  trail,
  onView,
  onOpen,
  onOpenContent,
  nextStepQuery,
}: {
  nextStepQuery: { data: NextJourneyStep | undefined; isError: boolean; isPending: boolean };
  trail: Trail;
  onView: (view: View) => void;
  onOpen: (l: TrailLesson) => void;
  onOpenContent: (stepKey: string) => void;
}) {
  const startNext = useServerFn(startJourneyStep);
  const queryClient = useQueryClient();
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
      {nextStepQuery.isPending ? (
        <section className="next-step-hero next-step-hero--message" role="status">
          <div className="next-step-hero__content page-width">
            <div className="next-step-hero__copy">
              <p>Carregando seu próximo passo…</p>
            </div>
          </div>
        </section>
      ) : (
        <NextStepHero
          step={highlightedStep}
          onAction={() => void openHighlightedStep()}
          busy={nextStepQuery.isPending}
        />
      )}
      <div className="dashboard-body">
        <ContinueJourneySection onOpen={(item) => onOpenContent(item.stepKey)} />
        <NextMovementSection
          currentMonth={trail.currentMonth}
          onOpen={(item) => onOpenContent(item.stepKey)}
        />
        <Rail title="Revisite quando quiser" items={revisit} onOpen={onOpen} />
        <NextMeetingBanner onAgenda={() => onView("agenda")} />
      </div>
    </div>
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
  onOpenContent,
  onView,
  library,
}: {
  trail: Trail;
  onOpen: (l: TrailLesson) => void;
  onOpenContent: (stepKey: string, contentId?: string | null) => void;
  onView: (v: View) => void;
  library: JourneyContentLibrary | null | undefined;
}) {
  return (
    <JourneyHub
      trail={trail}
      journeyItems={library?.items ?? []}
      resume={library?.resume}
      recentNotes={library?.recentNotes}
      onOpen={onOpen}
      onOpenContent={onOpenContent}
      onAgenda={() => onView("agenda")}
    />
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

function MenteeArea({
  view,
  onView,
  userId,
}: {
  view: View;
  onView: (v: View) => void;
  userId: string;
}) {
  const { data: trail, isLoading, isError: trailFailed, refetch: retryTrail } = useTrail();
  const journeyLibrary = useJourneyContentLibrary(true, true);
  const loadNext = useServerFn(getNextJourneyStep);
  const nextStepQuery = useQuery({
    queryKey: ["next-journey-step", userId],
    queryFn: () => loadNext(),
    enabled: view === "inicio",
    ...liveJourneyQueryOptions,
  });
  const [lesson, setLesson] = useState<TrailLesson | null>(null);
  const [contentStepKey, setContentStepKey] = useState<string | null>(null);
  const [contentInitialId, setContentInitialId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  function openJourneyContent(stepKey: string, contentId?: string | null) {
    setLesson(null);
    setLibraryOpen(false);
    setContentInitialId(contentId ?? null);
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
  if (trailFailed)
    return (
      <main className="inner-page">
        <PageIntro
          eyebrow="RISE NOW"
          title="Não foi possível carregar sua jornada."
          copy="Verifique sua conexão e tente novamente. Seu progresso continua salvo."
        />
        <button className="button button--primary" type="button" onClick={() => void retryTrail()}>
          Tentar novamente
        </button>
      </main>
    );
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
          key={contentStepKey + ":" + (contentInitialId ?? "")}
          stepKey={contentStepKey}
          initialContentId={contentInitialId}
          onBack={() => setContentStepKey(null)}
          onNavigate={(next) => {
            setContentInitialId(null);
            setContentStepKey(next);
          }}
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
          nextStepQuery={nextStepQuery}
          onView={onView}
          onOpen={openTrailLesson}
          onOpenContent={openJourneyContent}
        />
      ) : view === "jornada" ? (
        <JourneyView
          trail={trail}
          onOpen={openTrailLesson}
          onOpenContent={openJourneyContent}
          onView={onView}
          library={journeyLibrary.data}
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
  const [accessError, setAccessError] = useState(false);
  const [accessRetry, setAccessRetry] = useState(0);
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
    let checking = false;

    async function resolveSession() {
      if (checking || !mounted) return;
      checking = true;
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
        const email = String(data.session.user.email ?? "")
          .trim()
          .toLowerCase();
        const [profileResult, rolesResult, accessResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, full_name")
            .eq("id", userId)
            .maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
          email
            ? supabase
                .from("allowed_emails")
                .select("status, archived_at")
                .eq("email", email)
                .maybeSingle()
            : Promise.resolve({ data: null, error: new Error("Email de acesso ausente.") }),
        ]);
        if (!mounted) return;

        const storedRole = resolveAppRole((rolesResult.data ?? []).map((item) => item.role));
        if (profileResult.error || rolesResult.error || accessResult.error)
          throw new Error("Não foi possível verificar o acesso agora.");
        if (
          !profileResult.data ||
          !accessResult.data ||
          accessResult.data.status !== "approved" ||
          Boolean(accessResult.data.archived_at) ||
          !storedRole ||
          !(["mentee", "mentor", "admin"] as const).includes(storedRole)
        ) {
          signalAccessDenied();
          await supabase.auth.signOut();
          if (mounted) setAuthMode("login");
          return;
        }

        resolvedUserId.current = userId;
        setAccessError(false);
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
        if (mounted && !resolvedUserId.current) setAccessError(true);
      } finally {
        checking = false;
      }
    }

    void resolveSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;

      if (event === "TOKEN_REFRESHED") {
        void resolveSession();
        return;
      }

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
    const refreshAccessWhenVisible = () => {
      if (document.visibilityState === "visible") void resolveSession();
    };
    window.addEventListener("focus", refreshAccessWhenVisible);
    document.addEventListener("visibilitychange", refreshAccessWhenVisible);
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", refreshAccessWhenVisible);
      document.removeEventListener("visibilitychange", refreshAccessWhenVisible);
    };
  }, [accessRetry]);

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

  if (authMode === "checking")
    return accessError ? (
      <div className="platform-shell" data-theme={theme}>
        <main className="inner-page">
          <PageIntro
            eyebrow="RISE NOW"
            title="Não foi possível verificar seu acesso."
            copy="Verifique sua conexão e tente novamente."
          />
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              setAccessError(false);
              setAccessRetry((value) => value + 1);
            }}
          >
            Tentar novamente
          </button>
        </main>
      </div>
    ) : (
      <LoadingScreen />
    );
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
        <MenteeArea
          view={activeView}
          onView={navigateToView}
          userId={resolvedUserId.current ?? ""}
        />
      )}
      <AppFooter role={role} onView={navigateToView} />
      <ProtectedOperationHost />
    </div>
  );
}
