import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleMore, Power, QrCode, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getWhatsAppAdminState,
  getWhatsAppQrCode,
  saveWhatsAppSettings,
  saveWhatsAppTemplates,
  sendWhatsAppTest,
  startWhatsAppSession,
  type WhatsAppAdminState,
  type WhatsAppSettings,
} from "@/lib/whatsapp.functions";

import { WhatsAppTemplatesEditor } from "./whatsapp-templates-editor";

const defaultSettings: WhatsAppSettings = {
  accountCreated: false,
  meetingReminder: false,
  meetingReminderMentor: false,
  stageReleased: false,
  stageCompletedMentee: false,
  stageCompletedMentor: false,
  meetingReminderHours: 24,
};

type NotificationOption = {
  key: Exclude<keyof WhatsAppSettings, "meetingReminderHours">;
  title: string;
  description: string;
};

const notificationGroups: Array<{ title: string; options: NotificationOption[] }> = [
  {
    title: "Para mentoradas",
    options: [
      {
        key: "meetingReminder",
        title: "Lembrete de encontro",
        description: "Lembra cada mentorada antes de um encontro em que ela participa.",
      },
      {
        key: "stageReleased",
        title: "Nova etapa liberada",
        description: "Avisa quando uma etapa com data de liberação fica disponível.",
      },
      {
        key: "stageCompletedMentee",
        title: "Etapa concluída",
        description: "Parabeniza e oferece o link para continuar a jornada.",
      },
    ],
  },
  {
    title: "Para mentoras",
    options: [
      {
        key: "meetingReminderMentor",
        title: "Lembrete de encontro",
        description: "Lembra a mentora responsável antes de cada encontro que ela conduz.",
      },
      {
        key: "stageCompletedMentor",
        title: "Mentorada concluiu uma etapa",
        description: "Avisa as mentoras responsáveis quando uma mentorada avança.",
      },
    ],
  },
  {
    title: "Para todas",
    options: [
      {
        key: "accountCreated",
        title: "Conta criada",
        description: "Avisa que o acesso foi criado e que o link de ativação chegou no e-mail.",
      },
    ],
  },
];

const eventLabels: Record<string, string> = {
  account_created: "Conta criada",
  meeting_reminder: "Lembrete de encontro",
  meeting_reminder_mentor: "Lembrete à mentora",
  stage_released: "Etapa liberada",
  stage_completed_mentee: "Etapa concluída",
  stage_completed_mentor: "Aviso à mentora",
};

const historyLabels: Record<string, string> = {
  pending: "Na fila",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
};

function statusDetails(status: string) {
  if (status === "ready") return { label: "Conectado", tone: "ok" };
  if (status === "qr_ready") return { label: "Aguardando leitura do QR Code", tone: "wait" };
  if (status === "starting" || status === "initializing")
    return { label: "Iniciando…", tone: "wait" };
  if (status === "failed") return { label: "Falha na conexão", tone: "error" };
  if (status === "unreachable") return { label: "Gateway indisponível", tone: "error" };
  if (status === "unconfigured") return { label: "Não configurado", tone: "off" };
  return { label: "Desconectado", tone: "off" };
}

function formatPhone(digits: string | null) {
  if (!digits) return "—";
  const m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${digits}`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function WhatsAppAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["whatsapp-admin-state"],
    queryFn: () => getWhatsAppAdminState(),
    // O QR Code expira em ~20 s: enquanto a sessão não conecta, atualiza a cada 5 s.
    refetchInterval: (query) => {
      const status = (query.state.data as WhatsAppAdminState | undefined)?.session.status;
      return status === "qr_ready" || status === "starting" || status === "initializing"
        ? 5_000
        : false;
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
    setQrCode(data?.qrCode ?? null);
  }, [data]);

  const configured = !!data?.configured;
  const status = data?.session.status ?? "unconfigured";
  const connected = status === "ready";
  const details = statusDetails(status);

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
    } catch (actionError) {
      setFeedback(
        actionError instanceof Error ? actionError.message : "Não foi possível concluir a ação.",
      );
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-state"] });
      setBusy(null);
    }
  }

  async function showQrCode() {
    await runAction(
      "qr",
      async () => {
        const result = await getWhatsAppQrCode();
        if (result.ok && result.qrCode) setQrCode(result.qrCode);
        return result;
      },
      "QR Code atualizado. Leia em até 20 segundos com o celular do número institucional.",
    );
  }

  function sendTestMessage() {
    if (!phone.trim() || !testMessage.trim()) {
      setFeedback("Informe o telefone e a mensagem de teste.");
      return;
    }
    void runAction(
      "test",
      () => sendWhatsAppTest({ data: { phone: phone.trim(), message: testMessage.trim() } }),
      "Mensagem de teste enviada.",
    );
  }

  return (
    <main className="inner-page">
      <div className="page-intro page-width">
        <span className="eyebrow eyebrow--gold">Administração</span>
        <h1>WhatsApp</h1>
        <p>Número institucional e notificações automáticas da jornada RISE NOW.</p>
      </div>

      <section className="page-width ops-section whatsapp-admin" aria-live="polite">
        {isLoading ? <p className="ops-empty">Carregando integração do WhatsApp…</p> : null}
        {error ? (
          <p className="ops-empty" role="alert">
            Não foi possível carregar a integração. Atualize a página e tente novamente.
          </p>
        ) : null}

        {data ? (
          <>
            {!configured ? (
              <article className="admin-card whatsapp-unconfigured">
                <MessageCircleMore size={28} aria-hidden="true" />
                <div>
                  <h2>WhatsApp ainda não configurado</h2>
                  <p>
                    Cadastre os secrets <code>WHATSAPP_GATEWAY_URL</code>,{" "}
                    <code>WHATSAPP_GATEWAY_API_KEY</code> e <code>WHATSAPP_GATEWAY_SESSION_ID</code>{" "}
                    nas Edge Functions do Supabase. Nenhuma mensagem é enviada até lá.
                  </p>
                </div>
              </article>
            ) : null}

            <article className="admin-card whatsapp-card">
              <div className="section-heading">
                <div>
                  <h2>Número institucional</h2>
                  <p className="whatsapp-muted">
                    A conexão acontece pelo gateway seguro da Pamaris. Nenhuma credencial fica
                    exposta no navegador.
                  </p>
                </div>
              </div>
              <dl className="whatsapp-status">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span
                      className={`whatsapp-dot whatsapp-dot--${details.tone}`}
                      aria-hidden="true"
                    />
                    {details.label}
                  </dd>
                </div>
                <div>
                  <dt>Número</dt>
                  <dd>{formatPhone(data.session.phone)}</dd>
                </div>
                <div>
                  <dt>Nome no WhatsApp</dt>
                  <dd>{data.session.name || "—"}</dd>
                </div>
              </dl>
              {data.session.lastError && !connected ? (
                <p className="whatsapp-error" role="alert">
                  {data.session.lastError}
                </p>
              ) : null}
              {configured && !connected ? (
                <div className="ops-row">
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void runAction(
                        "start",
                        () => startWhatsAppSession(),
                        "Sessão iniciada. Em instantes o QR Code aparece aqui.",
                      )
                    }
                  >
                    <Power size={17} /> {busy === "start" ? "Ligando…" : "Ligar sessão"}
                  </button>
                  <button
                    className="button button--glass"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void showQrCode()}
                  >
                    <QrCode size={17} /> {busy === "qr" ? "Atualizando…" : "Mostrar QR Code"}
                  </button>
                  <button
                    className="button button--glass"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-state"] })
                    }
                  >
                    <RefreshCw size={17} /> Atualizar status
                  </button>
                </div>
              ) : null}
              {qrCode && !connected ? (
                <figure className="whatsapp-qr">
                  <img src={qrCode} alt="QR Code para conectar o WhatsApp institucional" />
                  <figcaption>
                    No celular do número institucional: WhatsApp → ⋮ → Aparelhos conectados →
                    Conectar um aparelho. O código muda a cada ~20 segundos.
                  </figcaption>
                </figure>
              ) : null}
            </article>

            <div className="whatsapp-grid">
              <article className="admin-card whatsapp-card">
                <div className="section-heading">
                  <div>
                    <h2>Notificações automáticas</h2>
                    <p className="whatsapp-muted">Escolha quais eventos enviam mensagens.</p>
                  </div>
                </div>
                {notificationGroups.map((group) => (
                  <fieldset key={group.title} className="whatsapp-group">
                    <legend>{group.title}</legend>
                    {group.options.map((option) => (
                      <label key={option.key} className="whatsapp-toggle">
                        <span>
                          <strong>{option.title}</strong>
                          <small className="whatsapp-muted">{option.description}</small>
                        </span>
                        <input
                          type="checkbox"
                          role="switch"
                          checked={settings[option.key]}
                          disabled={!configured}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              [option.key]: event.target.checked,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </fieldset>
                ))}
                <label className="ops-field">
                  <span>Antecedência dos lembretes de encontro (horas)</span>
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
                  />
                </label>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={busy !== null || !configured}
                  onClick={() =>
                    void runAction(
                      "settings",
                      () => saveWhatsAppSettings({ data: settings }),
                      "Preferências de notificação salvas.",
                    )
                  }
                >
                  <Save size={17} /> {busy === "settings" ? "Salvando…" : "Salvar preferências"}
                </button>
              </article>

              <article className="admin-card whatsapp-card">
                <div className="section-heading">
                  <div>
                    <h2>Mensagem de teste</h2>
                    <p className="whatsapp-muted">
                      Use um telefone com DDD que espera receber o teste.
                    </p>
                  </div>
                </div>
                <div className="ops-form">
                  <label className="ops-field">
                    <span>Telefone</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </label>
                  <label className="ops-field">
                    <span>Mensagem</span>
                    <textarea
                      rows={4}
                      maxLength={2000}
                      value={testMessage}
                      onChange={(event) => setTestMessage(event.target.value)}
                    />
                  </label>
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy !== null || !connected}
                    onClick={sendTestMessage}
                  >
                    <Send size={17} /> {busy === "test" ? "Enviando…" : "Enviar teste"}
                  </button>
                  {!connected ? (
                    <small className="whatsapp-muted">Conecte o número para liberar o teste.</small>
                  ) : null}
                </div>
              </article>
            </div>

            <WhatsAppTemplatesEditor
              templates={data.templates}
              available={data.templatesAvailable}
              disabled={!configured || busy !== null}
              saving={busy === "templates"}
              onSave={(templates) =>
                void runAction(
                  "templates",
                  () => saveWhatsAppTemplates({ data: { templates } }),
                  "Textos das mensagens salvos.",
                )
              }
              onUseInTest={(message) => {
                setTestMessage(message);
                setFeedback("Prévia copiada para a mensagem de teste.");
              }}
            />

            {feedback ? (
              <p className="form-message" role="status">
                {feedback}
              </p>
            ) : null}

            <article className="admin-card whatsapp-card">
              <div className="section-heading">
                <div>
                  <h2>Últimos envios</h2>
                  <p className="whatsapp-muted">
                    Mensagens na fila são reenviadas automaticamente quando o número reconecta.
                  </p>
                </div>
              </div>
              {data.history.length ? (
                <ul className="whatsapp-history">
                  {data.history.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{eventLabels[item.eventType] ?? item.eventType}</strong>
                        <small className="whatsapp-muted">
                          {item.phone ?? "—"} · {formatDate(item.at)}
                          {item.error ? ` · ${item.error}` : ""}
                        </small>
                      </span>
                      <span className={`whatsapp-badge whatsapp-badge--${item.status}`}>
                        {historyLabels[item.status] ?? item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="whatsapp-muted">Nenhuma notificação enviada ainda.</p>
              )}
            </article>

            <article className="admin-card whatsapp-safety">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <strong>Boas práticas para não bloquear o número</strong>
                <p>
                  Use um número dedicado à RISE NOW, nunca um celular pessoal. A plataforma envia em
                  fila, com pausa entre mensagens, e só para quem tem conta ativa.
                </p>
              </div>
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}
