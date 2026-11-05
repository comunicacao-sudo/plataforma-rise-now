import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Send, Trash2, Users, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  AUDIENCE_LABELS,
  AUTOMATION_TRIGGERS,
  AUTOMATION_VARIABLE_HELP,
  MAX_AUTOMATION_TEMPLATE,
  TRIGGER_DEFINITIONS,
  WEEKDAY_LABELS,
  describeAutomation,
  renderAutomation,
  unknownAutomationVariables,
  type AutomationAudience,
  type AutomationTrigger,
} from "../../supabase/functions/_shared/whatsapp-automations.ts";
import {
  deleteWhatsAppAutomation,
  listWhatsAppAutomations,
  listWhatsAppGroups,
  saveWhatsAppAutomation,
  saveWhatsAppGroup,
  testWhatsAppAutomation,
  toggleWhatsAppAutomation,
  type WhatsAppAutomation,
  type WhatsAppAutomationDraft,
} from "@/lib/whatsapp.functions";

const QUERY_KEY = ["whatsapp-automations"];

type Unit = "minutos" | "horas" | "dias";
const UNIT_MINUTES: Record<Unit, number> = { minutos: 1, horas: 60, dias: 1440 };

function splitOffset(minutes: number): { value: number; unit: Unit } {
  if (minutes > 0 && minutes % 1440 === 0) return { value: minutes / 1440, unit: "dias" };
  if (minutes > 0 && minutes % 60 === 0) return { value: minutes / 60, unit: "horas" };
  return { value: minutes, unit: "minutos" };
}

const GROUPS: Array<{ title: string; audiences: AutomationAudience[] }> = [
  { title: "Para mentoradas", audiences: ["group", "mentees"] },
  { title: "Para mentoras", audiences: ["mentor", "staff"] },
  { title: "Para todas", audiences: ["member"] },
];

const blankDraft = (): WhatsAppAutomationDraft => ({
  name: "",
  trigger: "group_meeting_before",
  audience: "group",
  offsetMinutes: 60,
  weekday: 5,
  sendTime: "17:00",
  template: "",
  enabled: false,
});

/** Lista de automações de WhatsApp: liga/desliga, edita, cria, testa e escolhe o grupo. */
export function WhatsAppAutomations({
  connected,
  onFeedback,
}: {
  connected: boolean;
  onFeedback: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listWhatsAppAutomations(),
  });
  const [editing, setEditing] = useState<WhatsAppAutomationDraft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [groups, setGroups] = useState<Array<{ id: string; name: string }> | null>(null);

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(key);
    try {
      const result = await action();
      onFeedback(result.ok ? success : result.error || "Não foi possível concluir.");
      if (result.ok) await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return result.ok;
    } catch (actionError) {
      onFeedback(actionError instanceof Error ? actionError.message : "Não foi possível concluir.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function loadGroups() {
    setBusy("groups");
    try {
      const result = await listWhatsAppGroups();
      setGroups(result.groups ?? []);
      if (!result.ok) onFeedback(result.error || "Não foi possível listar os grupos.");
    } catch (listError) {
      onFeedback(
        listError instanceof Error ? listError.message : "Não foi possível listar os grupos.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <p className="ops-empty">Carregando automações…</p>;
  if (error || !data)
    return (
      <p className="ops-empty" role="alert">
        Não foi possível carregar as automações. Atualize a página.
      </p>
    );
  if (!data.available)
    return (
      <p className="whatsapp-error" role="alert">
        {data.error}
      </p>
    );

  return (
    <>
      <article className="admin-card whatsapp-card">
        <div className="section-heading">
          <div>
            <h2>
              <Users size={18} aria-hidden="true" /> Grupo da RISE no WhatsApp
            </h2>
            <p className="whatsapp-muted">
              Usado pelas automações enviadas “no grupo”. O número institucional precisa estar no
              grupo para ele aparecer aqui.
            </p>
          </div>
        </div>
        <p>
          <strong>{data.group ? data.group.name : "Nenhum grupo escolhido"}</strong>
        </p>
        <div className="ops-row">
          <button
            className="button button--glass"
            type="button"
            disabled={busy !== null || !connected}
            onClick={() => void loadGroups()}
          >
            <RefreshCw size={17} /> {busy === "groups" ? "Buscando…" : "Buscar grupos do número"}
          </button>
        </div>
        {groups ? (
          groups.length ? (
            <ul className="whatsapp-history">
              {groups.map((group) => (
                <li key={group.id}>
                  <span>
                    <strong>{group.name}</strong>
                  </span>
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy !== null || data.group?.id === group.id}
                    onClick={() =>
                      void run(
                        "group",
                        () => saveWhatsAppGroup({ data: { chatId: group.id } }),
                        `Grupo “${group.name}” escolhido.`,
                      ).then((ok) => ok && setGroups(null))
                    }
                  >
                    {data.group?.id === group.id ? "Escolhido" : "Usar este"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="whatsapp-muted">
              O número não está em nenhum grupo. Adicione-o ao grupo da RISE e busque de novo.
            </p>
          )
        ) : null}
      </article>

      <article className="admin-card whatsapp-card">
        <div className="section-heading">
          <div>
            <h2>Automações</h2>
            <p className="whatsapp-muted">
              Cada automação envia uma mensagem quando algo acontece. Ligue, edite o texto ou crie
              novas. Mensagens saem em fila, com pausa entre elas.
            </p>
          </div>
          <button
            className="button button--primary"
            type="button"
            disabled={busy !== null}
            onClick={() => setEditing(blankDraft())}
          >
            <Plus size={17} /> Nova automação
          </button>
        </div>

        <label className="ops-field">
          <span>Celular para receber os testes</span>
          <input
            type="tel"
            inputMode="tel"
            value={testPhone}
            onChange={(event) => setTestPhone(event.target.value)}
            placeholder="(11) 99999-9999"
          />
        </label>

        {GROUPS.map((group) => {
          const items = data.automations.filter((item) => group.audiences.includes(item.audience));
          if (!items.length) return null;
          return (
            <fieldset key={group.title} className="whatsapp-group">
              <legend>{group.title}</legend>
              {items.map((item) => (
                <AutomationRow
                  key={item.id}
                  item={item}
                  busy={busy}
                  canTest={connected && !!testPhone.trim()}
                  onToggle={(enabled) =>
                    void run(
                      `toggle:${item.id}`,
                      () => toggleWhatsAppAutomation({ data: { id: item.id, enabled } }),
                      enabled ? `“${item.name}” ligada.` : `“${item.name}” desligada.`,
                    )
                  }
                  onEdit={() => setEditing({ ...item })}
                  onTest={() =>
                    void run(
                      `test:${item.id}`,
                      () => testWhatsAppAutomation({ data: { ...item, phone: testPhone } }),
                      "Teste enviado para o seu celular.",
                    )
                  }
                  onDelete={() => {
                    if (window.confirm(`Excluir a automação “${item.name}”?`))
                      void run(
                        `delete:${item.id}`,
                        () => deleteWhatsAppAutomation({ data: { id: item.id } }),
                        "Automação excluída.",
                      );
                  }}
                />
              ))}
            </fieldset>
          );
        })}
      </article>

      {editing ? (
        <AutomationEditor
          draft={editing}
          saving={busy === "save"}
          onCancel={() => setEditing(null)}
          onSave={(draft) =>
            void run(
              "save",
              () => saveWhatsAppAutomation({ data: draft }),
              "Automação salva. Ela continua desligada até você ligar.",
            ).then((ok) => ok && setEditing(null))
          }
        />
      ) : null}
    </>
  );
}

function AutomationRow({
  item,
  busy,
  canTest,
  onToggle,
  onEdit,
  onTest,
  onDelete,
}: {
  item: WhatsAppAutomation;
  busy: string | null;
  canTest: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="whatsapp-automation">
      <label className="whatsapp-toggle">
        <span>
          <strong>{item.name}</strong>
          <small className="whatsapp-muted">{describeAutomation(item)}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label={`Ligar ${item.name}`}
          checked={item.enabled}
          disabled={busy !== null}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </label>
      <div className="whatsapp-automation-actions">
        <button type="button" disabled={busy !== null} onClick={onEdit}>
          <Pencil size={14} aria-hidden="true" /> Editar
        </button>
        <button
          type="button"
          disabled={busy !== null || !canTest}
          title={canTest ? undefined : "Informe o celular para testes e conecte o número"}
          onClick={onTest}
        >
          <Send size={14} aria-hidden="true" />{" "}
          {busy === `test:${item.id}` ? "Enviando…" : "Testar"}
        </button>
        <button type="button" disabled={busy !== null} onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" /> Excluir
        </button>
      </div>
    </div>
  );
}

function AutomationEditor({
  draft: initial,
  saving,
  onCancel,
  onSave,
}: {
  draft: WhatsAppAutomationDraft;
  saving: boolean;
  onCancel: () => void;
  onSave: (draft: WhatsAppAutomationDraft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const initialOffset = splitOffset(initial.offsetMinutes);
  const [offsetValue, setOffsetValue] = useState(initialOffset.value);
  const [offsetUnit, setOffsetUnit] = useState<Unit>(initialOffset.unit);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const definition = TRIGGER_DEFINITIONS[draft.trigger];

  const preview = useMemo(
    () =>
      draft.template ? renderAutomation(draft.trigger, draft.template, definition.sample) : "",
    [draft.trigger, draft.template, definition.sample],
  );
  const unknown = unknownAutomationVariables(draft.trigger, draft.template);

  function changeTrigger(trigger: AutomationTrigger) {
    const next = TRIGGER_DEFINITIONS[trigger];
    setDraft((current) => ({
      ...current,
      trigger,
      audience: next.audiences.includes(current.audience) ? current.audience : next.audiences[0]!,
    }));
  }

  function insertVariable(variable: string) {
    const token = `{${variable}}`;
    const field = textareaRef.current;
    const text = draft.template;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? text.length;
    setDraft((current) => ({
      ...current,
      template: `${text.slice(0, start)}${token}${text.slice(end)}`,
    }));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function submit() {
    onSave({
      ...draft,
      offsetMinutes:
        definition.kind === "before" ? Math.round(offsetValue * UNIT_MINUTES[offsetUnit]) : 0,
    });
  }

  return (
    <article className="admin-card whatsapp-card whatsapp-editor" aria-label="Editar automação">
      <div className="section-heading">
        <div>
          <h2>{draft.id ? "Editar automação" : "Nova automação"}</h2>
          <p className="whatsapp-muted">Ao salvar, a automação fica desligada até você ligá-la.</p>
        </div>
        <button
          className="button button--glass"
          type="button"
          onClick={onCancel}
          aria-label="Fechar editor"
        >
          <X size={17} />
        </button>
      </div>

      <div className="whatsapp-template-body">
        <div className="ops-form">
          <label className="ops-field">
            <span>Nome</span>
            <input
              value={draft.name}
              maxLength={120}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Ex.: Lembrete 30 min antes da aula"
            />
          </label>

          <label className="ops-field">
            <span>Quando</span>
            <select
              value={draft.trigger}
              onChange={(event) => changeTrigger(event.target.value as AutomationTrigger)}
            >
              {AUTOMATION_TRIGGERS.map((trigger) => (
                <option key={trigger} value={trigger}>
                  {TRIGGER_DEFINITIONS[trigger].label}
                </option>
              ))}
            </select>
            <small className="whatsapp-muted">{definition.description}</small>
          </label>

          {definition.kind === "before" ? (
            <div className="ops-field">
              <span>Quanto tempo antes</span>
              <div className="ops-row">
                <input
                  type="number"
                  min={0}
                  aria-label="Quantidade"
                  value={offsetValue}
                  onChange={(event) => setOffsetValue(Math.max(0, Number(event.target.value) || 0))}
                  style={{ maxWidth: 110 }}
                />
                <select
                  aria-label="Unidade"
                  value={offsetUnit}
                  onChange={(event) => setOffsetUnit(event.target.value as Unit)}
                >
                  <option value="minutos">minutos</option>
                  <option value="horas">horas</option>
                  <option value="dias">dias</option>
                </select>
              </div>
              <small className="whatsapp-muted">Use 0 para enviar na hora do encontro.</small>
            </div>
          ) : null}

          {definition.kind === "weekly" ? (
            <div className="ops-row">
              <label className="ops-field">
                <span>Dia da semana</span>
                <select
                  value={draft.weekday ?? 5}
                  onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ops-field">
                <span>Horário</span>
                <input
                  type="time"
                  value={draft.sendTime ?? "17:00"}
                  onChange={(event) => setDraft({ ...draft, sendTime: event.target.value })}
                />
              </label>
            </div>
          ) : null}

          <label className="ops-field">
            <span>Para quem</span>
            <select
              value={draft.audience}
              onChange={(event) =>
                setDraft({ ...draft, audience: event.target.value as AutomationAudience })
              }
            >
              {definition.audiences.map((audience) => (
                <option key={audience} value={audience}>
                  {AUDIENCE_LABELS[audience]}
                </option>
              ))}
            </select>
          </label>

          <label className="ops-field">
            <span>Texto da mensagem</span>
            <textarea
              ref={textareaRef}
              rows={8}
              maxLength={MAX_AUTOMATION_TEMPLATE}
              value={draft.template}
              onChange={(event) => setDraft({ ...draft, template: event.target.value })}
            />
          </label>
          <small className="whatsapp-muted">
            {draft.template.length}/{MAX_AUTOMATION_TEMPLATE} · *texto* fica em negrito no WhatsApp.
          </small>
          <div className="whatsapp-variables" aria-label="Inserir variável">
            {definition.variables.map((variable) => (
              <button key={variable} type="button" onClick={() => insertVariable(variable)}>
                {`{${variable}}`}
                <small>{AUTOMATION_VARIABLE_HELP[variable]}</small>
              </button>
            ))}
          </div>
          {unknown.length ? (
            <p className="whatsapp-error" role="alert">
              Este gatilho não reconhece: {unknown.map((name) => `{${name}}`).join(", ")}.
            </p>
          ) : null}
        </div>

        <figure className="whatsapp-preview">
          <figcaption>Prévia com dados de exemplo</figcaption>
          <p>{preview || "Escreva o texto para ver a prévia."}</p>
        </figure>
      </div>

      <div className="ops-row">
        <button className="button button--primary" type="button" disabled={saving} onClick={submit}>
          {saving ? "Salvando…" : "Salvar automação"}
        </button>
        <button className="button button--glass" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </article>
  );
}
