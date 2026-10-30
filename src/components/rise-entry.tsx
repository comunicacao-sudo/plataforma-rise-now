import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";

import { LegalFooterLinks } from "@/components/rise-legal";
import { supabase } from "@/integrations/supabase/client";

const AuthenticatedPlatform = lazy(() =>
  import("@/components/rise-platform").then((module) => ({ default: module.RisePlatform })),
);

function PublicRiseMark() {
  return (
    <div className="rise-mark" role="img" aria-label="RISE NOW">
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
      <span className="rise-mark__pillars">Reflexão · Identidade · Segurança · Evolução</span>
    </div>
  );
}

function PublicLoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <PublicRiseMark />
      <span>Preparando seu acesso…</span>
    </main>
  );
}

function PublicLoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        setError("Email ou senha incorretos.");
        return;
      }
      onSignedIn();
    } catch {
      setError("Não foi possível acessar agora. Verifique sua conexão e tente novamente.");
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
          <PublicRiseMark />
          <div className="login-panel__copy">
            <h1>Seu próximo nível começa por dentro.</h1>
            <p>Acesse sua mentoria e acompanhe sua jornada de evolução.</p>
          </div>

          {sent ? (
            <div className="access-sent" role="status">
              <div className="access-sent__icon">
                <Check aria-hidden="true" />
              </div>
              <div>
                <strong>Confira seu email</strong>
                <p>Enviamos um link para você criar uma nova senha.</p>
              </div>
            </div>
          ) : (
            <form className="login-form" onSubmit={signIn}>
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
                {!busy ? <ArrowRight size={21} aria-hidden="true" /> : null}
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

export function RiseEntry() {
  const [state, setState] = useState<"checking" | "public" | "authenticated">("checking");

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState(data.session ? "authenticated" : "public");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      setState(session ? "authenticated" : "public");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state === "checking") return <PublicLoadingScreen />;
  if (state === "public") return <PublicLoginScreen onSignedIn={() => setState("authenticated")} />;
  return (
    <Suspense fallback={<PublicLoadingScreen />}>
      <AuthenticatedPlatform />
    </Suspense>
  );
}
