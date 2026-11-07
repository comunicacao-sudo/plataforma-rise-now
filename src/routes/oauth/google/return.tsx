import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { completeGoogleConnect } from "@/lib/google.functions";
import { oauthConnector } from "@/lib/google-oauth";

export const Route = createFileRoute("/oauth/google/return")({
  head: () => ({
    meta: [
      { title: "Conectando Google · RISE NOW" },
      { name: "description", content: "Finalizando a conexão com o Google." },
      { property: "og:title", content: "Conectando Google · RISE NOW" },
      { property: "og:description", content: "Finalizando a conexão com o Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finalizando a conexão…");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const connectorId = oauthConnector(params.get("state"));
    const notify = (
      type: "riseGoogleOAuthComplete" | "riseGoogleOAuthFailed",
      failureMessage?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId, message: failureMessage },
        window.location.origin,
      );
      window.close();
    };
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state || params.get("error")) {
      setMessage("A conexão não foi concluída. Você pode fechar esta janela.");
      notify("riseGoogleOAuthFailed", "A autorização do Google foi cancelada ou recusada.");
      return;
    }
    void completeGoogleConnect({ data: { code, state } })
      .then(() => {
        setMessage("Conexão concluída. Você pode fechar esta janela.");
        notify("riseGoogleOAuthComplete");
      })
      .catch((error: unknown) => {
        const failureMessage =
          error instanceof Error ? error.message : "A conexão não foi concluída. Tente de novo.";
        setMessage(`${failureMessage} Você pode fechar esta janela.`);
        notify("riseGoogleOAuthFailed", failureMessage);
      });
  }, []);
  return (
    <main className="loading-screen">
      <span>{message}</span>
    </main>
  );
}
