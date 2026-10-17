import riseLogo from "@/assets/rise-logo-light.png.asset.json";
import riseIcon from "@/assets/rise-icon-light.png.asset.json";
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
import { FormEvent, useEffect, useMemo, useState } from "react";

import { mentors } from "@/data/rise-content";
import {
  Avatar,
  MentorsSection,
  NotificationBell,
  ProfileModal,
  Rise90Live,
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
  MenteeMeetings,
  NextMeetingBanner,
  StaffArea,
  type StaffView,
} from "@/components/rise-ops";
import { NextStepHero } from "@/components/journey-next-step";
import { RecordedLessonPage } from "@/components/recorded-lessons";
import {
  ContinueJourneySection,
  JourneyContentLessonPage,
  JourneyContentLibraryPage,
} from "@/components/journey-content";
import type { JourneyContentItem } from "@/lib/content.functions";
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

type Role = AppRole;
type View =
  "inicio" | "jornada" | "agenda" | "entregas" | "rise90" | "painel" | "gestao-jornada" | "alunas";
type AuthMode = "checking" | "login" | "authenticated" | "change-password";

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

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
              <div className="login-form__field">
                <label htmlFor="rise-email">E-mail</label>
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
              {method === "password" ? (
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
              ) : null}
              <p className="login-form__hint">
                Acesso seguro. Use o e-mail aprovado pela equipe RISE.
              </p>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="button button--primary button--wide" type="submit" disabled={busy}>
                {busy ? "Verificando…" : method === "password" ? "Entrar" : "Receber acesso seguro"}
                {!busy ? <ArrowRight size={21} /> : null}
              </button>
              <div className="login-form__links">
                {method === "password" ? (
                  <button className="demo-link" type="button" onClick={() => void forgotPassword()}>
                    Esqueci minha senha
                  </button>
                ) : null}
                <span>Ambiente exclusivo RISE</span>
              </div>
              <div className="login-form__secondary">
                <button
                  className="demo-link"
                  type="button"
                  onClick={() => setMethod(method === "password" ? "link" : "password")}
                >
                  {method === "password" ? "Entrar com link por e-mail" : "Entrar com senha"}
                </button>
              </div>
            </form>
          )}
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
      return setError(
        messages[code ?? ""] ?? `Não foi possível salvar a senha: ${updateError.message}`,
      );
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
        <div className="login-panel__content">
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
                <input
                  id="rise-current-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </>
            ) : null}
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
        ]
      : [
          { label: "Painel", view: "painel" },
          { label: "Minha jornada", view: "gestao-jornada" },
          { label: "Agenda", view: "agenda" },
          { label: "Entregas", view: "entregas" },
          { label: "Alunas e turmas", view: "alunas" },
        ];
  const visibleName = me?.display_name?.trim() || me?.full_name || name;
  const profileSubtitle =
    role === "mentee" && me?.profession_visible && me.profession
      ? me.profession
      : roleLabels[role];

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
          const cover = journeyCoverByMonth[item.month];
          return (
            <article
              key={item.month}
              className={`journey-card journey-card--${status}`}
              aria-label={`Mês ${item.month}: ${item.title}`}
            >
              {cover ? (
                <img
                  className="journey-card__cover"
                  src={cover}
                  alt={`${item.title} — mês ${item.month}`}
                  loading={item.month > 2 ? "lazy" : "eager"}
                />
              ) : null}
              <div className="journey-card__top">
                <span>MÊS {item.month}</span>
                {status === "completed" ? <CheckCircle2 size={19} /> : null}
                {status === "current" ? <span className="status-pill">AGORA</span> : null}
              </div>
              {!cover ? (
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
  const nextStepQuery = useQuery({
    queryKey: ["next-journey-step", trail.enrollmentId],
    queryFn: () => loadNext(),
    enabled: Boolean(trail.enrollmentId),
    refetchOnWindowFocus: true,
  });
  const phase = currentPhase(trail);
  const next = trail.phases.find((p) => p.month === trail.currentMonth + 1);
  const revisit = trail.phases
    .flatMap((p) => p.lessons)
    .filter((l) => l.completed && l.kind === "aula");
  const highlightedStep = nextStepQuery.isError
    ? ({ state: "error" } satisfies NextJourneyStep)
    : (nextStepQuery.data ?? ({ state: "no_enrollment" } satisfies NextJourneyStep));

  async function openHighlightedStep() {
    if (highlightedStep.enrollmentId && highlightedStep.stepKey) {
      await startNext({
        data: { enrollmentId: highlightedStep.enrollmentId, stepKey: highlightedStep.stepKey },
      });
      void queryClient.invalidateQueries({ queryKey: ["next-journey-step"] });
    }
    if (highlightedStep.resourceType === "legacy_lesson" && highlightedStep.resourceId) {
      const lesson = trail.phases
        .flatMap((item) => item.lessons)
        .find((item) => item.id === highlightedStep.resourceId);
      if (lesson) {
        onOpen(lesson);
        return;
      }
    }
    if (
      highlightedStep.stepKey &&
      [
        "questionnaire",
        "form",
        "recorded_class",
        "collective_recording",
        "cohort_onboarding",
      ].includes(highlightedStep.format ?? "")
    ) {
      onOpenContent(highlightedStep.stepKey);
      return;
    }
    if (
      highlightedStep.format === "individual_1_1" &&
      highlightedStep.actionLabel === "Ver meu encontro" &&
      highlightedStep.stepKey
    ) {
      onOpenContent(highlightedStep.stepKey);
      return;
    }
    if (highlightedStep.format === "individual_1_1" || highlightedStep.format === "live_group") {
      if (highlightedStep.resourceUrl) {
        const url = new URL(highlightedStep.resourceUrl);
        if (url.protocol === "https:") window.open(url.toString(), "_blank", "noopener,noreferrer");
      } else onView("agenda");
      return;
    }
    if (highlightedStep.resourceUrl) {
      const url = new URL(highlightedStep.resourceUrl);
      if (url.protocol === "https:") window.open(url.toString(), "_blank", "noopener,noreferrer");
    }
  }
  return (
    <>
      <NextStepHero
        step={highlightedStep}
        onAction={() => void openHighlightedStep()}
        busy={nextStepQuery.isFetching}
      />
      <div className="dashboard-body">
        <ContinueJourneySection onOpen={(item) => onOpenContent(item.stepKey)} />
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
        <MentorsSection />
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
    <main className="inner-page">
      <PageIntro
        eyebrow="RISE NOW · 6 meses"
        title="Sua jornada, em uma única visão."
        copy="Cada etapa transforma clareza em decisão, posicionamento, liderança e execução."
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
      <MentorsSection />
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

function MenteeArea({ view, onView }: { view: View; onView: (v: View) => void }) {
  const { data: trail, isLoading } = useTrail();
  const [lesson, setLesson] = useState<TrailLesson | null>(null);
  const [contentStepKey, setContentStepKey] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  if (isLoading) return <main className="inner-page" />;
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
          onOpen={setLesson}
          onOpenContent={setContentStepKey}
        />
      ) : view === "jornada" ? (
        <JourneyView trail={trail} onOpen={setLesson} onOpenLibrary={() => setLibraryOpen(true)} />
      ) : view === "agenda" ? (
        <AgendaView trail={trail} onOpen={setLesson} />
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
  const [name, setName] = useState("Participante RISE");
  const [activeView, setActiveView] = useState<View>("inicio");
  const [assessmentPreview, setAssessmentPreview] = useState<"report" | "questionnaire" | null>(null);

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

        setName(
          profileResult.data.display_name ||
            profileResult.data.full_name ||
            data.session.user.email?.split("@")[0] ||
            "Participante RISE",
        );
        const resolvedRole: Role = storedRole === "mentee" ? "mentee" : "admin";
        setRole(resolvedRole);
        setActiveView((v) =>
          resolvedRole === "mentee"
            ? v === "painel" || v === "alunas"
              ? "inicio"
              : v
            : v === "inicio"
              ? "painel"
              : v,
        );
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

  const { data: currentProfile } = useMyProfile(authMode === "authenticated");
  const theme = currentProfile?.theme_preference === "light" ? "light" : "dark";
  const shellClass = useMemo(() => `platform-shell platform-shell--${role}`, [role]);

  async function exit() {
    await supabase.auth.signOut();
    setRole("mentee");
    setName("Participante RISE");
    setAuthMode("login");
  }

  if (assessmentPreview)
    return (
      <div className="platform-shell platform-shell--admin" data-theme="dark">
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
        onView={setActiveView}
        role={role}
        name={name}
        onExit={() => void exit()}
      />
      {role !== "mentee" ? (
        <StaffArea
          view={
            (["painel", "gestao-jornada", "agenda", "entregas", "alunas"].includes(activeView)
              ? activeView
              : "painel") as StaffView
          }
          onView={setActiveView}
        />
      ) : (
        <MenteeArea view={activeView} onView={setActiveView} />
      )}
      <AppFooter />
    </div>
  );
}
