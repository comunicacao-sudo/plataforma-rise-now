export type GoogleConnector = "google_calendar" | "google_drive";

/** O state é validado no servidor; esta leitura só identifica a janela de origem. */
export function oauthConnector(state: string | null): GoogleConnector {
  try {
    const part = state?.split(".")[0];
    if (!part) return "google_calendar";
    const payload = part.replaceAll("-", "+").replaceAll("_", "/");
    const parsed = JSON.parse(atob(payload + "=".repeat((4 - (payload.length % 4)) % 4)));
    return parsed.connectorId === "google_drive" ? "google_drive" : "google_calendar";
  } catch {
    return "google_calendar";
  }
}

export function waitForGoogleOAuth(popup: Window, connectorId: GoogleConnector) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== connectorId
      )
        return;
      const type = event.data?.type;
      if (type !== "riseGoogleOAuthComplete" && type !== "riseGoogleOAuthFailed") return;
      cleanup();
      if (type === "riseGoogleOAuthComplete") resolve();
      else
        reject(
          new Error(
            typeof event.data?.message === "string"
              ? event.data.message
              : "A autorização do Google não foi concluída.",
          ),
        );
    };
    window.addEventListener("message", onMessage);
    const poll = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("A janela de autorização foi fechada."));
      }
    }, 500);
  });
}
