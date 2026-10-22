import { MessageCircleMore, ShieldCheck } from "lucide-react";

/** Provider-neutral state while the official service contract is unavailable. */
export function WhatsAppAdmin() {
  return (
    <main className="inner-page">
      <div className="page-intro page-width">
        <span className="eyebrow eyebrow--gold">Administração</span>
        <h1>WhatsApp</h1>
        <p>Notificações transacionais da jornada RISE NOW.</p>
      </div>
      <section className="page-width ops-section" aria-live="polite">
        <article className="admin-card whatsapp-unconfigured">
          <MessageCircleMore size={28} aria-hidden="true" />
          <div>
            <h2>WhatsApp ainda não configurado</h2>
            <p>
              Os eventos, modelos, preferências e o histórico permanecem preservados. Todos os
              disparos estão desabilitados até a conexão segura do provider oficial.
            </p>
          </div>
        </article>
        <article className="admin-card whatsapp-safety">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <strong>Nenhuma mensagem será enviada</strong>
            <p>
              O contrato de API do novo serviço precisa ser validado antes de habilitar
              notificações. Não há QR Code, sessão ou credencial de provider exposta nesta tela.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
