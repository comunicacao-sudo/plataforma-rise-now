import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Link2,
  MessageCircleMore,
  Power,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Unplug,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  disconnectWhatsAppSession,
  getWhatsAppAdminState,
  getWhatsAppQrCode,
  restartWhatsAppSession,
  saveWhatsAppSettings,
  sendWhatsAppTest,
  startWhatsAppSession,
} from "@/lib/whatsapp.functions";

type WhatsAppSettings = {
  accountCreated: boolean;
  meetingReminder: boolean;
  stageReleased: boolean;
  stageCompletedMentee: boolean;
  stageCompletedMentor: boolean;
  meetingReminderHours: number;
};

type WhatsAppAdminState = {
  configured: boolean;
  qrCode?: string | null;
  session: {
    name: string;
    engine: string;
    status: string;
    phone?: string | null;
  };
  settings: WhatsAppSettings;
};

const defaultSettings: WhatsAppSettings = {
  accountCreated: false,
  meetingReminder: false,
  stageReleased: false,
  stageCompletedMentee: false,
  stageCompletedMentor: false,
  meetingReminderHours: 24,
};

const notificationOptions: Array<{
  key: Exclude<keyof WhatsAppSettings, "meetingReminderHours">;
  title: string;
  description: string;
}> = [
  {
    key: "accountCreated",
    title: "Conta criada",
    description: "Envia o acesso seguro quando uma mentora ou mentorada é cadastrada.",
  },
  {
    key: "meetingReminder",
    title: "Lembrete de encontro",
    description: "Lembra as participantes antes de um encontro agendado.",
  },
  {
    key: "stageReleased",
    title: "Nova etapa liberada",
    description: "Avisa a mentorada quando uma etapa da jornada fica disponível.",
  },
  {
    key: "stageCompletedMentee",
    title: "Etapa concluída para a mentorada",
    description: "Confirma a conclusão e oferece o link para continuar a jornada.",
  },
  {
    key: "stageCompletedMentor",
    title: "Etapa concluída para a mentora",
    description: "Notifica as mentoras responsáveis pela evolução da mentorada.",
  },
];

const cardStyle: CSSProperties = {
  minHeight: 0,
  padding: "1.35rem",
  border: "1px solid rgba(208, 172, 92, 0.24)",
  borderRadius: 16,
  background: "rgba(27, 9, 9, 0.94)",
  color: "#fffaf5",
};

const mutedStyle: CSSProperties = {
  color: "rgba(255, 250, 245, 0.66)",
  fontSize: ".86rem",
  lineHeight: 1.55,
};

function statusDetails(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "WORKING") return { label: "Conectado", color: "#7bd89c" };
  if (normalized === "SCAN_QR_CODE") return { label: "Aguardando leitura do QR", color: "#d0ac5c" };
  if (normalized === "STARTING") return { label: "Iniciando", color: "#f6ddb0" };
  if (normalized === "FAILED") return { label: "Falha na conexão", color: "#ff8d91" };
  return { label: "Desconectado", color: "rgba(255, 250, 245, .66)" };
}

function Toggle({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: "1rem",
        padding: "1rem 0",
        borderBottom: "1px solid rgba(255, 250, 245, .09)",
        cursor: "pointer",
      }}
    >
      <span style={{ display: "grid", gap: ".25rem" }}>
        <strong style={{ fontSize: ".95rem" }}>{title}</strong>
        <small style={mutedStyle}>{description}</small>
      </span>
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: 46,
          height: 26,
          flex: "0 0 auto",
          borderRadius: 999,
          border: `1px solid ${checked ? "#d0ac5c" : "rgba(255, 250, 245, .24)"}`,
          background: checked ? "rgba(208, 172, 92, .24)" : "rgba(255, 250, 245, .06)",
          transition: "all .2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 4,
            left: checked ? 24 : 4,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: checked ? "#d0ac5c" : "rgba(255, 250, 245, .6)",
            transition: "left .2s ease",
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
      />
    </label>
  );
}

export function WhatsAppAdmin() {
  const queryClient = useQueryClient();
  const getState = useServerFn(getWhatsAppAdminState);
  const saveSettings = useServerFn(saveWhatsAppSettings);
  const startSession = useServerFn(startWhatsAppSession);
  const restartSession = useServerFn(restartWhatsAppSession);
  const disconnectSession = useServerFn(disconnectWhatsAppSession);
  const requestQrCode = useServerFn(getWhatsAppQrCode);
  const sendTest = useServerFn(sendWhatsAppTest);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["whatsapp-admin-state"],
    queryFn: () => getState() as Promise<WhatsAppAdminState>,
    refetchInterval: (query) => {
      const status = (query.state.data as WhatsAppAdminState | undefined)?.session.status;
      return status === "STARTING" || status === "SCAN_QR_CODE" ? 5_000 : false;
    },
  });
  const [settings, setSettings] = useState(defaultSettings);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Olá! Esta é uma mensagem de teste da plataforma RISE NOW.",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (data?.settings) setSettings({ ...defaultSettings, ...data.settings });
    if (data?.qrCode) setQrCode(data.qrCode);
  }, [data]);

  const session = data?.session ?? {
    name: "rise-principal",
    engine: "GOWS",
    status: "STOPPED",
    phone: null,
  };
  const status = useMemo(() => statusDetails(session.status), [session.status]);
  const connected = session.status.toUpperCase() === "WORKING";

  async function refreshState() {
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-state"] });
    await refetch();
  }

  async function runAction(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(key);
    setFeedback("");
    try {
      const result = await action();
      setFeedback(result.ok ? success : result.error || "Não foi possível concluir a ação.");
      await refreshState();
    } catch {
      setFeedback("Não foi possível concluir a ação. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  async function showQrCode() {
    setBusy("qr");
    setFeedback("");
    try {
      const result = await requestQrCode();
      if (result.ok && result.qrCode) {
        setQrCode(result.qrCode);
        setFeedback("QR Code atualizado. Leia com o WhatsApp do número institucional.");
      } else {
        setFeedback(result.error || "O QR Code ainda não está disponível.");
      }
      await refreshState();
    } catch {
      setFeedback("O QR Code ainda não está disponível. Tente novamente em alguns segundos.");
    } finally {
      setBusy(null);
    }
  }

  async function persistSettings() {
    await runAction(
      "settings",
      () => saveSettings({ data: settings }),
      "Preferências de notificação salvas.",
    );
  }

  async function sendTestMessage() {
    if (!phone.trim() || !testMessage.trim()) {
      setFeedback("Informe o telefone e a mensagem de teste.");
      return;
    }
    await runAction(
      "test",
      () => sendTest({ data: { phone: phone.trim(), message: testMessage.trim() } }),
      "Mensagem de teste enviada.",
    );
  }

  return (
    <main className="inner-page">
      <div className="page-intro page-width">
        <span className="eyebrow eyebrow--gold">Administração</span>
        <h1>WhatsApp</h1>
        <p>Configure o número institucional e as notificações transacionais da jornada RISE NOW.</p>
      </div>

      <section className="page-width ops-section" aria-live="polite">
        {isLoading ? <p className="ops-empty">Carregando integração do WhatsApp…</p> : null}
        {error ? (
          <p className="ops-empty" role="alert">
            Não foi possível carregar a integração. Atualize a página e tente novamente.
          </p>
        ) : null}
        {!isLoading && data ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: ".8rem",
              }}
            >
              <article className="admin-card" style={cardStyle}>
                <Smartphone size={22} color="#d0ac5c" />
                <span style={{ ...mutedStyle, display: "block", marginTop: ".9rem" }}>Status</span>
                <strong style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 9, height: 9, borderRadius: "50%", background: status.color }}
                  />
                  {status.label}
                </strong>
              </article>
              <article className="admin-card" style={cardStyle}>
                <MessageCircleMore size={22} color="#d0ac5c" />
                <span style={{ ...mutedStyle, display: "block", marginTop: ".9rem" }}>Número</span>
                <strong>{session.phone || "Ainda não conectado"}</strong>
              </article>
              <article className="admin-card" style={cardStyle}>
                <Link2 size={22} color="#d0ac5c" />
                <span style={{ ...mutedStyle, display: "block", marginTop: ".9rem" }}>Sessão</span>
                <strong>{session.name}</strong>
              </article>
              <article className="admin-card" style={cardStyle}>
                <CheckCircle2 size={22} color="#d0ac5c" />
                <span style={{ ...mutedStyle, display: "block", marginTop: ".9rem" }}>Engine</span>
                <strong>{session.engine}</strong>
              </article>
            </div>

            <article className="admin-card" style={cardStyle}>
              <div className="section-heading">
                <div>
                  <h2>Conexão do número institucional</h2>
                  <p style={mutedStyle}>
                    A plataforma usa uma única sessão segura. Nenhuma credencial do WhatsApp fica
                    exposta no navegador.
                  </p>
                </div>
              </div>
              {!data.configured ? (
                <p className="ops-empty" role="alert">
                  A infraestrutura WAHA ainda não foi configurada no servidor. Preencha as variáveis
                  protegidas antes de conectar o número.
                </p>
              ) : null}
              <div className="ops-row">
                {!connected ? (
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy !== null || !data.configured}
                    onClick={() =>
                      void runAction(
                        "start",
                        () => startSession(),
                        "Sessão iniciada. Agora leia o QR Code.",
                      )
                    }
                  >
                    <Power size={17} /> {busy === "start" ? "Conectando…" : "Conectar"}
                  </button>
                ) : null}
                <button
                  className="button button--glass"
                  type="button"
                  disabled={busy !== null || !data.configured}
                  onClick={() =>
                    void runAction("restart", () => restartSession(), "Sessão reiniciada.")
                  }
                >
                  <RefreshCw size={17} /> {busy === "restart" ? "Reiniciando…" : "Reconectar"}
                </button>
                <button
                  className="button button--glass"
                  type="button"
                  disabled={busy !== null || !data.configured}
                  onClick={() => void showQrCode()}
                >
                  <QrCode size={17} /> {busy === "qr" ? "Atualizando…" : "Mostrar QR Code"}
                </button>
                <button
                  className="button button--glass"
                  type="button"
                  disabled={busy !== null || !data.configured || !connected}
                  onClick={() =>
                    void runAction("disconnect", () => disconnectSession(), "Número desconectado.")
                  }
                >
                  <Unplug size={17} /> {busy === "disconnect" ? "Desconectando…" : "Desconectar"}
                </button>
              </div>
              {qrCode && !connected ? (
                <div
                  style={{
                    display: "grid",
                    width: "min(100%, 360px)",
                    justifyItems: "center",
                    gap: ".75rem",
                    marginTop: "1.2rem",
                    padding: "1rem",
                    borderRadius: 14,
                    background: "#fff",
                    color: "#1b0909",
                    textAlign: "center",
                  }}
                >
                  <img
                    src={qrCode}
                    alt="QR Code para conectar o WhatsApp institucional"
                    style={{ display: "block", width: "min(100%, 300px)", aspectRatio: "1" }}
                  />
                  <small>WhatsApp → Aparelhos conectados → Conectar aparelho</small>
                </div>
              ) : null}
            </article>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "1rem",
              }}
            >
              <article className="admin-card" style={cardStyle}>
                <div className="section-heading">
                  <div>
                    <h2>Notificações automáticas</h2>
                    <p style={mutedStyle}>Escolha quais eventos enviam mensagens transacionais.</p>
                  </div>
                </div>
                {notificationOptions.map((option) => (
                  <Toggle
                    key={option.key}
                    checked={settings[option.key]}
                    title={option.title}
                    description={option.description}
                    onChange={(checked) =>
                      setSettings((current) => ({ ...current, [option.key]: checked }))
                    }
                  />
                ))}
                <label className="ops-field" style={{ marginTop: "1rem" }}>
                  <span style={{ color: "rgba(255, 250, 245, .72)" }}>
                    Antecedência do lembrete de encontro
                  </span>
                  <div className="ops-row">
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={settings.meetingReminderHours}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          meetingReminderHours: Math.max(
                            1,
                            Math.min(168, Number(event.target.value) || 1),
                          ),
                        }))
                      }
                      style={{ maxWidth: 130 }}
                    />
                    <span style={mutedStyle}>horas antes</span>
                  </div>
                </label>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void persistSettings()}
                  style={{ marginTop: "1rem" }}
                >
                  <Save size={17} /> {busy === "settings" ? "Salvando…" : "Salvar preferências"}
                </button>
              </article>

              <article className="admin-card" style={cardStyle}>
                <div className="section-heading">
                  <div>
                    <h2>Enviar mensagem de teste</h2>
                    <p style={mutedStyle}>
                      Confirme a conexão usando um telefone com DDD. O número será normalizado para
                      o padrão internacional.
                    </p>
                  </div>
                </div>
                <div className="ops-form">
                  <label className="ops-field">
                    <span style={{ color: "rgba(255, 250, 245, .72)" }}>Telefone</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="(11) 99999 9999"
                    />
                  </label>
                  <label className="ops-field">
                    <span style={{ color: "rgba(255, 250, 245, .72)" }}>Mensagem</span>
                    <textarea
                      rows={5}
                      value={testMessage}
                      onChange={(event) => setTestMessage(event.target.value)}
                    />
                  </label>
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy !== null || !connected}
                    onClick={() => void sendTestMessage()}
                  >
                    <Send size={17} /> {busy === "test" ? "Enviando…" : "Enviar teste"}
                  </button>
                  {!connected ? (
                    <small style={mutedStyle}>
                      Conecte o número institucional para liberar o teste.
                    </small>
                  ) : null}
                </div>
              </article>
            </div>

            {feedback ? (
              <p className="form-message" role="status">
                {feedback}
              </p>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
