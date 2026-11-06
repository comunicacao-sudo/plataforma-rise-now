import { Download, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { installDevice, usePwa } from "@/lib/pwa";

export function PwaInstallButton({ className = "rise-install-button" }: { className?: string }) {
  const { standalone, prompt, clearPrompt } = usePwa();
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    if (help) dialog.current?.showModal();
  }, [help]);

  if (standalone) return null;

  async function install() {
    if (busy) return;
    if (!prompt) {
      setHelp(true);
      return;
    }
    setBusy(true);
    try {
      const choice = await prompt.prompt();
      const result = choice ?? (await prompt.userChoice);
      if (result.outcome !== "accepted") setHelp(true);
    } catch {
      setMessage("A instalação não foi aberta. Siga as instruções abaixo.");
      setHelp(true);
    } finally {
      clearPrompt();
      setBusy(false);
    }
  }

  const device =
    typeof navigator === "undefined"
      ? "desktop"
      : installDevice(navigator.userAgent, navigator.maxTouchPoints);
  return (
    <>
      <button type="button" className={className} onClick={() => void install()} disabled={busy}>
        <Download size={17} aria-hidden="true" />{" "}
        {busy ? "Abrindo instalação…" : "Instalar aplicativo"}
      </button>
      {help
        ? createPortal(
            <dialog
              className="rise-install-dialog"
              ref={dialog}
              aria-labelledby={heading}
              onClose={() => setHelp(false)}
            >
              <button
                type="button"
                className="rise-install-dialog__close"
                aria-label="Fechar instruções de instalação"
                onClick={() => dialog.current?.close()}
              >
                <X size={22} aria-hidden="true" />
              </button>
              <img src="/app-icons/icon-192.png" alt="" width={72} height={72} />
              <h2 id={heading}>A RISE sempre com você</h2>
              <p>
                Instale a RISE NOW para abrir sua mentoria pelo ícone no computador ou no celular.
                Use seu e-mail e senha habituais.
              </p>
              {message ? <p role="status">{message}</p> : null}
              {device === "ios" ? (
                <ol>
                  <li>Abra este site no Safari do iPhone ou iPad.</li>
                  <li>
                    Toque em <strong>Compartilhar</strong> (quadrado com uma seta para cima).
                  </li>
                  <li>
                    Escolha <strong>Adicionar à Tela de Início</strong> e confirme em{" "}
                    <strong>Adicionar</strong>.
                  </li>
                </ol>
              ) : device === "android" ? (
                <ol>
                  <li>Abra este site no Chrome.</li>
                  <li>Toque no menu de três pontos.</li>
                  <li>
                    Escolha <strong>Instalar aplicativo</strong> ou{" "}
                    <strong>Adicionar à tela inicial</strong> e confirme.
                  </li>
                </ol>
              ) : device === "mac" ? (
                <ol>
                  <li>
                    No Chrome ou Edge, procure a opção <strong>Instalar RISE NOW</strong> na barra
                    de endereço ou no menu do navegador.
                  </li>
                  <li>
                    No Safari compatível, use <strong>Arquivo → Adicionar ao Dock</strong>.
                  </li>
                  <li>Depois, abra a RISE pelo ícone criado.</li>
                </ol>
              ) : (
                <ol>
                  <li>Abra este site no Chrome ou Microsoft Edge.</li>
                  <li>
                    No menu do navegador ou na barra de endereço, escolha{" "}
                    <strong>Instalar RISE NOW</strong> ou{" "}
                    <strong>Instalar esta página como aplicativo</strong>.
                  </li>
                  <li>Confirme a instalação e abra pelo ícone criado.</li>
                </ol>
              )}
              <p className="rise-install-dialog__note">
                Aulas, agenda e atividades precisam de internet. As atualizações chegam pelo próprio
                site.
              </p>
              <button
                type="button"
                className="rise-install-dialog__done"
                onClick={() => dialog.current?.close()}
              >
                Entendi
              </button>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
