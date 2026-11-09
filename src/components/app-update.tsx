import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  appUpdateGuards,
  appVersionUrl,
  canReloadApp,
  createVersionChecker,
  UPDATE_CHECK_INTERVAL,
  UPDATE_REMINDER_INTERVAL,
} from "@/lib/app-update";
import "./app-update.css";

function subscribeConnection(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}
const readConnection = () => navigator.onLine;
const serverConnection = () => true;

export default function AppUpdate() {
  const online = useSyncExternalStore(subscribeConnection, readConnection, serverConnection);
  const [version, setVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const updating = useRef(false);

  useEffect(() => {
    const monitor = createVersionChecker({
      currentVersion: import.meta.env.RISE_APP_VERSION,
      canCheck: () =>
        document.visibilityState === "visible" && navigator.onLine && window.self === window.top,
      fetchVersion: async (signal) => {
        const response = await fetch(appVersionUrl(), {
          cache: "no-store",
          credentials: "omit",
          signal,
        });
        if (!response.ok) throw new Error("Versão indisponível");
        return response.json();
      },
      onVersion: setVersion,
    });
    const check = () => {
      void monitor.check();
    };
    const initial = window.setTimeout(check, 2000);
    const interval = window.setInterval(check, UPDATE_CHECK_INTERVAL);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      monitor.stop();
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  useEffect(() => {
    if (!dismissed) return;
    const reminder = window.setTimeout(() => setDismissed(null), UPDATE_REMINDER_INTERVAL);
    return () => window.clearTimeout(reminder);
  }, [dismissed]);

  function update() {
    if (updating.current) return;
    updating.current = true;
    setBusy(true);
    setMessage("");
    const updated = appUpdateGuards.runIfSafe(() => {
      if (!canReloadApp(document, navigator.onLine)) return false;
      window.location.reload();
      return true;
    });
    if (!updated) {
      setMessage(
        "Salve e feche os formulários abertos, aguarde os envios e pause a aula antes de atualizar. Confira também sua conexão.",
      );
      updating.current = false;
      setBusy(false);
    }
  }

  if (online && (!version || version === dismissed)) return null;
  return (
    <aside
      className="rise-app-update"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={online ? "Atualização do aplicativo" : "Conexão com a internet"}
    >
      <span className="rise-app-update__brand">RISE NOW</span>
      {!online ? (
        <>
          <h2>Sem conexão com a internet</h2>
          <p>
            Reconecte para continuar. Aguarde a confirmação de salvamento antes de fechar o
            aplicativo.
          </p>
        </>
      ) : (
        <>
          <h2>Nova versão disponível</h2>
          <p>Temos melhorias na RISE. Atualize quando terminar o que está fazendo.</p>
          {message ? <p className="rise-app-update__message">{message}</p> : null}
          <div className="rise-app-update__actions">
            <button
              type="button"
              className="rise-app-update__primary"
              onClick={update}
              disabled={busy}
            >
              {busy ? "Atualizando…" : "Atualizar agora"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(version);
                setMessage("");
              }}
              disabled={busy}
            >
              Mais tarde
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
