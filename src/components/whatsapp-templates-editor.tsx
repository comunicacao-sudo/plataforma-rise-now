import { RotateCcw, Save, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  MAX_TEMPLATE_LENGTH,
  WHATSAPP_TEMPLATE_DEFINITIONS,
  WHATSAPP_TEMPLATE_KEYS,
  WHATSAPP_VARIABLE_HELP,
  renderTemplate,
  unknownVariables,
  type WhatsAppTemplateKey,
} from "../../supabase/functions/_shared/whatsapp-templates.ts";

type Props = {
  templates: Record<WhatsAppTemplateKey, string>;
  available: boolean;
  disabled: boolean;
  saving: boolean;
  onSave: (templates: Record<WhatsAppTemplateKey, string>) => void;
  onUseInTest: (message: string) => void;
};

/** Edição dos textos de cada notificação, com variáveis e prévia. */
export function WhatsAppTemplatesEditor({
  templates,
  available,
  disabled,
  saving,
  onSave,
  onUseInTest,
}: Props) {
  const [drafts, setDrafts] = useState(templates);
  const [active, setActive] = useState<WhatsAppTemplateKey>("account_created");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A tela atualiza o status a cada poucos segundos; só reinicia o rascunho
  // quando os textos salvos realmente mudarem, para não apagar o que está sendo digitado.
  const saved = JSON.stringify(templates);
  useEffect(() => setDrafts(JSON.parse(saved)), [saved]);

  const definition = WHATSAPP_TEMPLATE_DEFINITIONS[active];
  const text = drafts[active] ?? definition.defaultText;
  const preview = useMemo(
    () => renderTemplate(active, { [active]: text }, definition.sample),
    [active, text, definition.sample],
  );
  const unknown = unknownVariables(active, text);
  const changed = WHATSAPP_TEMPLATE_KEYS.some((key) => drafts[key] !== templates[key]);
  const missingLink = !text.includes("{link}");
  const locked = disabled || !available;

  function update(value: string) {
    setDrafts((current) => ({ ...current, [active]: value }));
  }

  function insertVariable(variable: string) {
    const token = `{${variable}}`;
    const field = textareaRef.current;
    if (!field) return update(`${text}${token}`);
    const start = field.selectionStart ?? text.length;
    const end = field.selectionEnd ?? text.length;
    update(`${text.slice(0, start)}${token}${text.slice(end)}`);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <article className="admin-card whatsapp-card">
      <div className="section-heading">
        <div>
          <h2>Textos das mensagens</h2>
          <p className="whatsapp-muted">
            Personalize o que cada aviso diz. As palavras entre chaves, como {"{nome}"}, são
            trocadas pelos dados de cada pessoa na hora do envio.
          </p>
        </div>
      </div>

      {!available ? (
        <p className="whatsapp-error" role="alert">
          Para editar os textos, aplique no banco a atualização
          <code> 0042_whatsapp_message_templates</code>. Enquanto isso, os textos padrão são usados.
        </p>
      ) : null}

      <div className="whatsapp-template-tabs" role="tablist" aria-label="Tipo de aviso">
        {WHATSAPP_TEMPLATE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === active}
            className={key === active ? "is-active" : undefined}
            onClick={() => setActive(key)}
          >
            {WHATSAPP_TEMPLATE_DEFINITIONS[key].label}
            {drafts[key] !== WHATSAPP_TEMPLATE_DEFINITIONS[key].defaultText ? (
              <span className="whatsapp-template-dot" aria-label="personalizado" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="whatsapp-template-body">
        <div className="ops-form">
          <label className="ops-field">
            <span>Texto — {definition.label}</span>
            <textarea
              ref={textareaRef}
              rows={9}
              maxLength={MAX_TEMPLATE_LENGTH}
              value={text}
              disabled={locked}
              onChange={(event) => update(event.target.value)}
            />
          </label>
          <small className="whatsapp-muted">
            {text.length}/{MAX_TEMPLATE_LENGTH} caracteres · *texto* fica em negrito no WhatsApp.
          </small>
          <div className="whatsapp-variables" aria-label="Inserir variável">
            {definition.variables.map((variable) => (
              <button
                key={variable}
                type="button"
                disabled={locked}
                title={WHATSAPP_VARIABLE_HELP[variable]}
                onClick={() => insertVariable(variable)}
              >
                {`{${variable}}`}
                <small>{WHATSAPP_VARIABLE_HELP[variable]}</small>
              </button>
            ))}
          </div>
          {unknown.length ? (
            <p className="whatsapp-error" role="alert">
              Este aviso não reconhece: {unknown.map((name) => `{${name}}`).join(", ")}. Esses
              trechos sairão do jeito que estão escritos.
            </p>
          ) : null}
          {missingLink ? (
            <p className="whatsapp-muted" role="note">
              Dica: sem {"{link}"}, a pessoa não recebe o atalho para a plataforma.
            </p>
          ) : null}
        </div>

        <figure className="whatsapp-preview">
          <figcaption>Prévia com dados de exemplo</figcaption>
          <p>{preview}</p>
        </figure>
      </div>

      <div className="ops-row">
        <button
          className="button button--primary"
          type="button"
          disabled={locked || saving || !changed}
          onClick={() => onSave(drafts)}
        >
          <Save size={17} /> {saving ? "Salvando…" : "Salvar textos"}
        </button>
        <button
          className="button button--glass"
          type="button"
          disabled={locked || text === definition.defaultText}
          onClick={() => update(definition.defaultText)}
        >
          <RotateCcw size={17} /> Voltar ao texto padrão
        </button>
        <button className="button button--glass" type="button" onClick={() => onUseInTest(preview)}>
          <Send size={17} /> Usar prévia no teste
        </button>
      </div>
    </article>
  );
}
