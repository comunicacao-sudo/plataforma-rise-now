import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listWhatsAppContacts,
  saveWhatsAppContact,
  type WhatsAppContact,
} from "@/lib/whatsapp.functions";

function ContactRow({ contact }: { contact: WhatsAppContact }) {
  const client = useQueryClient();
  const [phone, setPhone] = useState(contact.phone);
  const [authorized, setAuthorized] = useState(contact.authorized);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const changed = phone !== contact.phone || authorized !== contact.authorized;
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const result = await saveWhatsAppContact({ data: { userId: contact.id, phone, authorized } });
      if (!result.ok) throw new Error(result.error || "Não foi possível salvar.");
      setMessage("Telefone e autorização salvos.");
      await client.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="admin-card whatsapp-card">
      <h3>{contact.name}</h3>
      <p className="whatsapp-muted">
        {contact.email} · {contact.audience}
      </p>
      <strong>{contact.authorized ? "Envio autorizado" : "Sem autorização de envio"}</strong>
      <div className="ops-form">
        <label className="ops-field">
          <span>Telefone de WhatsApp com DDD</span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            disabled={busy}
            placeholder="(11) 99999-9999"
            onChange={(event) => {
              setPhone(event.target.value);
              setAuthorized(false);
              setMessage("");
            }}
          />
        </label>
        <label className="whatsapp-toggle">
          <span>Esta pessoa autorizou receber mensagens da RISE NOW neste número</span>
          <input
            type="checkbox"
            checked={authorized}
            disabled={busy || !phone.trim()}
            onChange={(event) => setAuthorized(event.target.checked)}
          />
        </label>
        {contact.recordedAt ? (
          <small className="whatsapp-muted">
            Último registro em{" "}
            {new Date(contact.recordedAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
            {contact.recordedBy ? ` por ${contact.recordedBy}` : ""}.
          </small>
        ) : null}
        <button
          type="button"
          className="button button--primary"
          disabled={busy || !changed}
          onClick={() => void save()}
        >
          {busy ? "Salvando…" : "Salvar telefone e autorização"}
        </button>
        {message ? (
          <p className="form-message" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function WhatsAppContacts() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["whatsapp-contacts"],
    queryFn: () => listWhatsAppContacts(),
  });
  const contacts = (query.data?.contacts ?? []).filter((person) =>
    `${person.name} ${person.email}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <section className="whatsapp-card" aria-labelledby="whatsapp-contacts-title">
      <h2 id="whatsapp-contacts-title">Contatos e autorização de WhatsApp</h2>
      <p>
        Cadastre o telefone e marque a autorização somente depois de confirmá-la com a pessoa.
        Mensagens privadas automáticas exigem autorização para o número cadastrado. Ao trocar o
        telefone, confirme a autorização novamente.
      </p>
      <p className="whatsapp-muted">
        A autorização individual vale para envios privados. Os avisos no grupo seguem a configuração
        do grupo.
      </p>
      <label className="ops-field">
        <span>Buscar pessoa por nome ou e-mail</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {query.isLoading ? <p role="status">Carregando contatos…</p> : null}
      {query.isError ? (
        <div role="alert">
          <p>Não foi possível carregar os contatos.</p>
          <button
            type="button"
            className="button button--glass"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
      <div className="whatsapp-grid">
        {contacts.map((contact) => (
          <ContactRow
            key={`${contact.id}:${contact.phone}:${contact.authorized}:${contact.recordedAt}`}
            contact={contact}
          />
        ))}
      </div>
      {query.isSuccess && !contacts.length ? <p>Nenhuma pessoa encontrada.</p> : null}
    </section>
  );
}
