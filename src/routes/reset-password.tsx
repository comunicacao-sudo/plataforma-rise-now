import { ArrowRight, Check, Mail } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { NewPasswordScreen } from "@/components/rise-platform";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha | RISE NOW" },
      { name: "description", content: "Crie uma nova senha para acessar a plataforma RISE NOW." },
      { property: "og:title", content: "Nova senha | RISE NOW" },
      { property: "og:description", content: "Redefinição de senha da plataforma RISE NOW." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

type ResetStatus = "checking" | "ready" | "expired" | "sent";

function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ResetStatus>("checking");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const search = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    // Supabase redirects expired/used invitation and recovery links here with
    // error parameters. Never show a password form without a valid session.
    if (
      search.has("error") ||
      search.has("error_code") ||
      fragment.has("error") ||
      fragment.has("error_code")
    ) {
      setStatus("expired");
      return;
    }

    // The Supabase client restores the session from the invitation/recovery
    // redirect during initialization. Both invitation and recovery links work.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setStatus("ready");
      }
      if (event === "SIGNED_OUT") setStatus("expired");
    });

    void supabase.auth
      .getSession()
      .then(({ data, error: authError }) => {
        if (active) setStatus(!authError && data.session ? "ready" : "expired");
      })
      .catch(() => {
        if (active) setStatus("expired");
      });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function requestNewLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedEmail = email.trim().toLowerCase();
    if (!requestedEmail) {
      setError("Informe seu email cadastrado na RISE NOW.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(requestedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        setError(
          "Não foi possível enviar o novo link agora. Tente novamente ou fale com a equipe RISE.",
        );
        return;
      }
      setStatus("sent");
    } catch {
      setError("Não foi possível enviar o novo link. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "ready") {
    return <NewPasswordScreen recovery onDone={() => void navigate({ to: "/" })} />;
  }

  return (
    <main className="login-shell">
      <div className="login-shell__art" aria-hidden="true">
        <div className="orb orb--one" />
        <div className="orb orb--two" />
        <div className="orb orb--three" />
        <span className="login-shell__spark">✦</span>
        <div className="login-shell__line" />
      </div>

      <section className="login-panel">
        <div className="login-panel__content">
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

          <div className="login-panel__copy">
            <span className="eyebrow eyebrow--gold">Recuperação de acesso</span>
            {status === "checking" ? (
              <>
                <h1>Verificando seu acesso.</h1>
                <p>Estamos validando seu link de criação de senha.</p>
              </>
            ) : status === "sent" ? (
              <>
                <h1>Confira seu email.</h1>
                <p>
                  Se o endereço estiver cadastrado, você receberá um novo link para criar sua senha.
                </p>
              </>
            ) : (
              <>
                <h1>Este link não está mais válido.</h1>
                <p>
                  Ele pode ter expirado ou já ter sido utilizado. Solicite um novo link com o email
                  cadastrado na RISE NOW para continuar com segurança.
                </p>
              </>
            )}
          </div>

          {status === "sent" ? (
            <div className="access-sent" role="status">
              <div className="access-sent__icon">
                <Check aria-hidden="true" />
              </div>
              <div>
                <strong>Solicitação recebida</strong>
                <p>Abra apenas o link mais recente recebido no email.</p>
              </div>
            </div>
          ) : status === "expired" ? (
            <form className="login-form" onSubmit={(event) => void requestNewLink(event)}>
              <div className="login-form__field">
                <label htmlFor="rise-recovery-email">Email cadastrado</label>
                <div className="login-form__control">
                  <Mail size={19} aria-hidden="true" />
                  <input
                    id="rise-recovery-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="button button--primary button--wide" type="submit" disabled={busy}>
                {busy ? "Enviando…" : "Receber novo link"}
                {!busy ? <ArrowRight size={18} aria-hidden="true" /> : null}
              </button>
            </form>
          ) : null}

          {status !== "checking" ? (
            <div className="login-form__links">
              <button
                className="demo-link"
                type="button"
                onClick={() => void navigate({ to: "/" })}
              >
                Voltar para entrar
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
