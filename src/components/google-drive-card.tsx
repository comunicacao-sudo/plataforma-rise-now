import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  authorizeDriveVideo,
  disconnectGoogleDrive,
  googleDriveStatus,
  startGoogleDriveConnect,
} from "@/lib/google.functions";
import { waitForGoogleOAuth } from "@/lib/google-oauth";

export function GoogleDriveCard() {
  const qc = useQueryClient();
  const statusFn = useServerFn(googleDriveStatus);
  const startFn = useServerFn(startGoogleDriveConnect);
  const authorizeFn = useServerFn(authorizeDriveVideo);
  const disconnectFn = useServerFn(disconnectGoogleDrive);
  const [expanded, setExpanded] = useState(false);
  const status = useQuery({
    queryKey: ["google-drive-status"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
    retry: false,
    enabled: expanded,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["google-drive-status"] }),
      qc.invalidateQueries({ queryKey: ["stage-contents"] }),
      qc.invalidateQueries({ queryKey: ["stage-video-preview"] }),
    ]);
  }
  async function connect() {
    const popup = window.open("", "rise-google-drive", "width=600,height=720");
    if (!popup) return setMessage("Libere as janelas pop-up para conectar o Google Drive.");
    setBusy(true);
    setMessage("");
    try {
      const { authorizationUrl } = await startFn();
      const done = waitForGoogleOAuth(popup, "google_drive");
      popup.location.href = authorizationUrl;
      await done;
      await refresh();
      setMessage("Google Drive conectado. Autorize abaixo as gravações já cadastradas.");
    } catch (error) {
      popup.close();
      setMessage(
        error instanceof Error ? error.message : "Não foi possível conectar o Google Drive.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function authorize(contentId: string) {
    setBusy(true);
    setMessage("");
    try {
      await authorizeFn({ data: { contentId } });
      await refresh();
      setMessage(
        "Gravação autorizada. O arquivo permanece no Drive e o público da aula foi preservado.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível autorizar a gravação.");
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await disconnectFn();
      await refresh();
      setMessage("Drive desconectado da RISE. As autorizações desta conexão foram removidas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível desconectar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="admin-card drive-connection"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <strong>Vídeos privados do Google Drive</strong>
        <span>
          {status.data?.connected ? "Conectado" : "Configurar conexão"}
          <ChevronDown size={18} aria-hidden="true" />
        </span>
      </summary>
      <div className="drive-connection__body">
        <p>
          Conecte a conta que tem acesso às gravações para reproduzi-las dentro da RISE. Os arquivos
          permanecem no Drive e cada aula mantém seu público.
        </p>
        <p>
          O Google pedirá permissão para ler e baixar os arquivos acessíveis à sua conta. A RISE usa
          essa conexão somente para reproduzir os vídeos que você cadastrar ou autorizar. Ela não
          altera nem exclui arquivos do Drive.
        </p>
        {status.isError && (
          <p role="alert">
            Não foi possível verificar a conexão.{" "}
            <button type="button" onClick={() => void status.refetch()}>
              Tentar novamente
            </button>
          </p>
        )}
        {status.isLoading ? (
          <p role="status">Verificando conexão…</p>
        ) : (
          <div className="drive-connection__actions">
            <button
              type="button"
              className="button button--gold"
              disabled={busy || status.isError}
              onClick={() => void connect()}
            >
              {busy
                ? "Aguarde…"
                : status.data?.connected || status.data?.reconnectRequired
                  ? "Reconectar Google Drive"
                  : "Conectar Google Drive"}
            </button>
            {status.data?.connected && (
              <>
                <span>{status.data.email}</span>
                <button
                  type="button"
                  className="button button--glass"
                  disabled={busy}
                  onClick={() => void disconnect()}
                >
                  Desconectar
                </button>
              </>
            )}
          </div>
        )}
        {!!status.data?.videos.length && (
          <ul className="drive-connection__videos">
            {status.data.videos.map((video) => (
              <li key={video.id}>
                <div>
                  <strong>{video.title}</strong>
                  {video.audience && <span>{video.audience}</span>}
                  <small>
                    {video.authorized ? "Autorização registrada" : "Precisa de autorização"}
                  </small>
                </div>
                <button
                  type="button"
                  className="button button--glass"
                  disabled={busy || !status.data.connected}
                  onClick={() => void authorize(video.id)}
                >
                  {video.authorized ? "Renovar autorização" : "Autorizar gravação"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
