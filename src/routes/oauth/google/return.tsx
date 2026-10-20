import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { completeGoogleConnect } from "@/lib/google.functions";

export const Route = createFileRoute("/oauth/google/return")({
  head: () => ({
    meta: [
      { title: "Conectando Google Agenda · RISE NOW" },
      { name: "description", content: "Finalizando a conexão com o Google Agenda." },
      { property: "og:title", content: "Conectando Google Agenda · RISE NOW" },
      { property: "og:description", content: "Finalizando a conexão com o Google Agenda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finalizando a conexão…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "riseGoogleOAuthComplete" | "riseGoogleOAuthFailed") => {
      window.opener?.postMessage(
        { type, connectorId: "google_calendar", code: null },
        window.location.origin,
      );
      window.close();
    };
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state || params.get("error")) {
      setMessage("A conexão não foi concluída. Você pode fechar esta janela.");
      notify("riseGoogleOAuthFailed");
      return;
    }
    void completeGoogleConnect({ data: { code, state } })
      .then(() => notify("riseGoogleOAuthComplete"))
      .catch(() => {
        setMessage("A conexão não foi concluída. Você pode fechar esta janela.");
        notify("riseGoogleOAuthFailed");
      });
  }, []);
  return (
    <main className="loading-screen">
      <span>{message}</span>
    </main>
  );
}
