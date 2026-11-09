import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { authorizeProtectedOperation } from "@/lib/protected.functions";
import {
  protectedDialogEvent as eventName,
  type ProtectedDialogRequest as Request,
} from "@/lib/protected-dialog";
export function ProtectedOperationHost() {
  const authorize = useServerFn(authorizeProtectedOperation);
  const [request, setRequest] = useState<Request | null>(null);
  const current = useRef<Request | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    function receive(event: Event) {
      const next = (event as CustomEvent<Request>).detail;
      if (!next?.scope || typeof next.resolve !== "function") return;
      if (current.current) {
        next.resolve(null);
        return;
      }
      next.accept();
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      current.current = next;
      setError("");
      setEmail("");
      setPassword("");
      setRequest(next);
    }
    window.addEventListener(eventName, receive);
    return () => {
      window.removeEventListener(eventName, receive);
      current.current?.resolve(null);
      current.current = null;
    };
  }, []);
  const close = useCallback((proof: string | null) => {
    const previous = current.current;
    current.current = null;
    setPassword("");
    setEmail("");
    setError("");
    setRequest(null);
    previous?.resolve(proof);
  }, []);
  useEffect(() => {
    if (!request) return;
    const previousFocus = returnFocus.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [request]);
  async function confirm() {
    if (!request || busy || !email.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      const result = await authorize({ data: { scope: request.scope, email, password } });
      close(result.proof);
    } catch (caught) {
      setPassword("");
      setError(
        caught instanceof Error ? caught.message : "Não foi possível confirmar sua identidade.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!request) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="content-modal ops-modal protected-confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="protected-confirm-title"
        aria-describedby="protected-confirm-description"
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Fechar"
          disabled={busy}
          onClick={() => close(null)}
        >
          <X size={20} />
        </button>
        <form
          className="content-modal__body ops-form"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <span className="eyebrow eyebrow--gold">Confirmação de identidade</span>
          <h2 id="protected-confirm-title">{request.title}</h2>
          <p id="protected-confirm-description">{request.description}</p>
          {request.scope.operation === "delete" && (
            <p>
              Você poderá recuperar o registro por 30 dias. Depois desse prazo, ele será excluído
              definitivamente da RISE.
            </p>
          )}
          <p>Confirme o e-mail e a senha da conta que está conectada.</p>
          <label>
            <span>E-mail da conta conectada</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              autoFocus
              required
              disabled={busy}
            />
          </label>
          <label>
            <span>Senha atual</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="content-modal__actions">
            <button type="button" disabled={busy} onClick={() => close(null)}>
              Cancelar
            </button>
            <button
              type="submit"
              className="ops-danger-action"
              disabled={busy || !email.trim() || !password}
            >
              {busy
                ? "Verificando…"
                : (request.confirmLabel ??
                  (request.scope.operation === "restore"
                    ? "Recuperar registro"
                    : "Enviar para a lixeira"))}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
