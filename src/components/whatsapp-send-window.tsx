import { useQueryClient } from "@tanstack/react-query";
import { Clock3, Save } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DEFAULT_SEND_WINDOW,
  WEEKDAY_SHORT,
  describeSendWindow,
  type SendWindow,
} from "../../supabase/functions/_shared/send-window.ts";
import { saveWhatsAppWindow } from "@/lib/whatsapp.functions";

const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

/** Horário comercial dos envios de WhatsApp (público CLT). */
export function WhatsAppSendWindow({
  value,
  onFeedback,
}: {
  value: SendWindow | undefined;
  onFeedback: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const saved = value ?? DEFAULT_SEND_WINDOW;
  const [draft, setDraft] = useState<SendWindow>(saved);
  const [saving, setSaving] = useState(false);
  const serialized = JSON.stringify(saved);
  useEffect(() => setDraft(JSON.parse(serialized) as SendWindow), [serialized]);
  const changed = JSON.stringify(draft) !== serialized;

  function toggleDay(day: number) {
    setDraft((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((item) => item !== day)
        : [...current.days, day].sort(),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveWhatsAppWindow({ data: draft });
      onFeedback(
        result.ok ? "Horário comercial salvo." : result.error || "Não foi possível salvar.",
      );
      if (result.ok) await queryClient.invalidateQueries({ queryKey: ["whatsapp-admin-state"] });
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="admin-card whatsapp-card">
      <div className="section-heading">
        <div>
          <h2>
            <Clock3 size={18} aria-hidden="true" /> Horário comercial dos envios
          </h2>
          <p className="whatsapp-muted">
            Agora: <strong>{describeSendWindow(saved)}</strong> (horário de Brasília). Avisos
            criados fora desse horário esperam a próxima abertura; avisos com hora marcada (link da
            aula, “15 min antes”, “1 hora antes”) não saem fora dele. O lembrete de “1 dia antes”
            vai no dia útil anterior.
          </p>
        </div>
      </div>
      <div className="ops-row">
        <label className="ops-field">
          <span>Início</span>
          <input
            type="time"
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
          />
        </label>
        <label className="ops-field">
          <span>Fim</span>
          <input
            type="time"
            value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value })}
          />
        </label>
      </div>
      <div className="whatsapp-template-tabs" role="group" aria-label="Dias da semana permitidos">
        {ORDERED_DAYS.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={draft.days.includes(day)}
            className={draft.days.includes(day) ? "is-active" : undefined}
            onClick={() => toggleDay(day)}
          >
            {WEEKDAY_SHORT[day]}
          </button>
        ))}
      </div>
      <div className="ops-row">
        <button
          className="button button--primary"
          type="button"
          disabled={!changed || saving}
          onClick={() => void save()}
        >
          <Save size={17} /> {saving ? "Salvando…" : "Salvar horário"}
        </button>
      </div>
    </article>
  );
}
