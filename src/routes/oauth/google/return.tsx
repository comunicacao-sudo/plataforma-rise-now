import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed", code?: string) => {
      window.opener?.postMessage({ type, connectorId: "google_calendar", code: code ?? null }, window.location.origin);
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage("A conexão não foi concluída. Você pode fechar esta janela.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") return notify("appUserConnectorOAuthComplete");
      setMessage("A conexão não foi concluída.");
      return notify("appUserConnectorOAuthFailed");
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);
  return (
    <main className="loading-screen">
      <span>{message}</span>
    </main>
  );
}
