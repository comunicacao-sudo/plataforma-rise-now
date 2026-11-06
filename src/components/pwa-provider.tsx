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

    let registrationTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRegistration = () => {
      registrationTimer = setTimeout(() => {
        void navigator.serviceWorker
          .register("/sw.js", { scope: "/", updateViaCache: "none" })
          .catch(() => {
            /* Acesso online e instalação pelo navegador permanecem disponíveis. */
          });
      }, 1500);
    };

    // Registro em segundo plano: não bloqueia a abertura e não recarrega formulários.
    if (
      import.meta.env.PROD &&
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      window.self === window.top
    ) {
      if (document.readyState === "complete") scheduleRegistration();
      else window.addEventListener("load", scheduleRegistration, { once: true });
    }
    return () => {
      mode.removeEventListener("change", detectMode);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("load", scheduleRegistration);
      clearTimeout(registrationTimer);
    };
  }, []);

  return (
    <PwaContext.Provider value={{ standalone, prompt, clearPrompt: () => setPrompt(null) }}>
      {children}
    </PwaContext.Provider>
  );
}
