import { useEffect, useState, type ReactNode } from "react";
import { PwaContext, type InstallPromptEvent } from "@/lib/pwa";

export function PwaProvider({ children }: { children: ReactNode }) {
  const [standalone, setStandalone] = useState(true);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const mode = window.matchMedia("(display-mode: standalone)");
    const detectMode = () =>
      setStandalone(
        mode.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true ||
          window.self !== window.top,
      );
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const installed = () => {
      setStandalone(true);
      setPrompt(null);
    };
    detectMode();
    mode.addEventListener("change", detectMode);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);

    // Registro em segundo plano: não bloqueia a abertura e não recarrega formulários.
    if (
      import.meta.env.PROD &&
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      window.self === window.top
    ) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Instalação pelo navegador e acesso online continuam disponíveis.
        });
    }
    return () => {
      mode.removeEventListener("change", detectMode);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  return (
    <PwaContext.Provider value={{ standalone, prompt, clearPrompt: () => setPrompt(null) }}>
      {children}
    </PwaContext.Provider>
  );
}
