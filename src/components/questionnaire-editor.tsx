import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import type { StageContentItem, StageQuestion } from "@/lib/content.functions";
import "./questionnaire-editor.css";

type QuestionnaireDraft = Pick<
  StageContentItem,
  "title" | "description" | "accessScope" | "cohortId" | "menteeId"
> & { questions: StageQuestion[] };
type Props = {
  value: QuestionnaireDraft;
  onChange: (change: Partial<QuestionnaireDraft>) => void;
  stepTitle: string;
  editing: boolean;
  cohorts: Array<{ id: string; name: string }>;
  mentees: Array<{ id: string; name: string }>;
  busy: boolean;
  message: string;
  onSave: () => void;
  onClose: () => void;
};

function GrowingTextarea({
  value,
  onChange,
  id,
  name,
  maxLength,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  name?: string;
  maxLength: number;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(112, element.scrollHeight + 2)}px`;
  }, [value]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = 0;
    const observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect().width;
      if (Math.abs(next - width) < 1) return;
      width = next;
      element.style.height = "auto";
      element.style.height = `${Math.max(112, element.scrollHeight + 2)}px`;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      id={id}
      name={name}
      rows={rows}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function QuestionnaireEditor({
  value,
  onChange,
  stepTitle,
  editing,
  cohorts,
  mentees,
  busy,
  message,
  onSave,
  onClose,
}: Props) {
  const formId = useId();
  const [target] = useState(() =>
    typeof document === "undefined"
      ? null
      : (document.querySelector<HTMLElement>(".platform-shell") ?? document.body),
  );
  const [generalOpen, setGeneralOpen] = useState(!editing);
  const [expanded, setExpanded] = useState(
    () => new Set(value.questions[0] ? [value.questions[0].id] : []),
  );
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const titleId = `${formId}-title`;
  const titleInput = `${formId}-name`;
  const audience =
    value.accessScope === "general"
      ? "Todos os mentorados"
      : value.accessScope === "cohort"
        ? (cohorts.find((c) => c.id === value.cohortId)?.name ?? "Turma específica")
        : (mentees.find((m) => m.id === value.menteeId)?.name ?? "Mentorado específico");
  const required = value.questions.filter((q) => q.required).length;
  const count = `${value.questions.length} ${value.questions.length === 1 ? "pergunta" : "perguntas"}`;
  function change(patch: Partial<QuestionnaireDraft>) {
    setError("");
    onChange(patch);
  }
  function updateQuestion(id: string, patch: Partial<StageQuestion>) {
    change({ questions: value.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  }
  function focusField(id: string) {
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }
  function addQuestion(source?: StageQuestion, index = value.questions.length - 1) {
    if (value.questions.length >= 50) return;
    const question: StageQuestion = source
      ? { ...source, id: crypto.randomUUID(), options: [...source.options] }
      : { id: crypto.randomUUID(), prompt: "", type: "long_text", required: true, options: [] };
    const questions = [...value.questions];
    questions.splice(index + 1, 0, question);
    change({ questions });
    setExpanded(new Set([question.id]));
    focusField(`${formId}-${question.id}`);
  }
  function moveQuestion(index: number, direction: number) {
    const destination = index + direction;
    if (destination < 0 || destination >= value.questions.length) return;
    const questions = [...value.questions];
    [questions[index], questions[destination]] = [questions[destination]!, questions[index]!];
    change({ questions });
  }
  function toggleQuestion(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function save() {
    if (busy) return;
    setError("");
    if (!value.title.trim()) {
      setPreview(false);
      setGeneralOpen(true);
      setError("Informe o título do questionário.");
      focusField(titleInput);
      return;
    }
    if (
      (value.accessScope === "cohort" && !value.cohortId) ||
      (value.accessScope === "mentee" && !value.menteeId)
    ) {
      setPreview(false);
      setGeneralOpen(true);
      setError(value.accessScope === "cohort" ? "Selecione a turma." : "Selecione o mentorado.");
      focusField(`${formId}-target`);
      return;
    }
    if (!value.questions.length) {
      setPreview(false);
      setError("Adicione pelo menos uma pergunta.");
      return;
    }
    const invalid = value.questions.find(
      (q) =>
        !q.prompt.trim() ||
        q.prompt.length > 1000 ||
        (q.type === "single_choice" &&
          (q.options.filter((o) => o.trim()).length < 2 ||
            q.options.some((o) => !o.trim()) ||
            new Set(q.options.map((o) => o.trim())).size !== q.options.length)),
    );
    if (invalid) {
      setPreview(false);
      setExpanded((current) => new Set([...current, invalid.id]));
      setError(
        !invalid.prompt.trim()
          ? "Preencha o texto de todas as perguntas."
          : invalid.prompt.length > 1000
            ? "Cada pergunta pode ter até 1.000 caracteres."
            : "As perguntas de escolha única precisam de pelo menos duas opções preenchidas e diferentes.",
      );
      focusField(`${formId}-${invalid.id}`);
      return;
    }
    onSave();
  }
  if (!target) return null;
  return createPortal(
    <div className="modal-backdrop questionnaire-backdrop" role="presentation">
      <section
        ref={root}
        className="content-modal questionnaire-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
      >
        <header className="questionnaire-editor__header">
          <div>
            <p className="questionnaire-editor__context">Conteúdos / {stepTitle}</p>
            <h2 id={titleId}>{editing ? "Editar questionário" : "Novo questionário"}</h2>
          </div>
          <div className="questionnaire-editor__header-actions">
            <span className="questionnaire-editor__state">{preview ? "Prévia" : "Edição"}</span>
            <button
              className="modal-close questionnaire-editor__close"
              type="button"
              aria-label="Fechar"
              disabled={busy}
              onClick={onClose}
            >
              <X size={21} />
            </button>
          </div>
        </header>
        <div className="questionnaire-editor__scroll">
          {preview ? (
            <section className="questionnaire-editor__preview" aria-label="Prévia do mentorado">
              <header>
                <p className="questionnaire-editor__kicker">PRÉVIA DO MENTORADO</p>
                <h3>{value.title.trim() || "Seu questionário"}</h3>
                {value.description && (
                  <p className="questionnaire-editor__description">{value.description}</p>
                )}
              </header>
              {value.questions.length ? (
                value.questions.map((q, index) => (
                  <fieldset className="questionnaire-editor__preview-question" key={q.id}>
                    <legend>
                      Pergunta {index + 1}
                      {q.required ? " · Obrigatória" : ""}
                    </legend>
                    <label
                      className="questionnaire-editor__field"
                      htmlFor={q.type === "single_choice" ? undefined : `${formId}-preview-${q.id}`}
                    >
                      <span>{q.prompt || "Sua pergunta aparecerá aqui."}</span>
                      {q.type === "long_text" ? (
                        <textarea
                          id={`${formId}-preview-${q.id}`}
                          rows={5}
                          placeholder="Escreva sua reflexão…"
                        />
                      ) : q.type === "short_text" ? (
                        <input id={`${formId}-preview-${q.id}`} placeholder="Sua resposta…" />
                      ) : null}
                    </label>
                    {q.type === "single_choice" ? (
                      <div
                        className="questionnaire-editor__preview-options"
                        role="radiogroup"
                        aria-label={q.prompt || `Pergunta ${index + 1}`}
                      >
                        {q.options.map((option, i) => (
                          <label key={i}>
                            <input type="radio" name={`${formId}-preview-${q.id}`} value={i} />
                            <span>{option || `Opção ${i + 1}`}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </fieldset>
                ))
              ) : (
                <p>Adicione perguntas para visualizar o questionário.</p>
              )}
            </section>
          ) : (
            <fieldset className="questionnaire-editor__fields" disabled={busy}>
              <details
                className="questionnaire-editor__general"
                open={generalOpen}
                onToggle={(event) => setGeneralOpen(event.currentTarget.open)}
              >
                <summary>
                  <Settings2 size={20} />
                  <div>
                    <strong>Informações do questionário</strong>
                    <span>
                      {value.title.trim() || "Nome, descrição e público"} · {audience}
                    </span>
                  </div>
                  <ChevronDown size={19} />
                </summary>
                {generalOpen ? (
                  <div className="questionnaire-editor__general-body">
                    <label className="questionnaire-editor__field" htmlFor={titleInput}>
                      <span>Título</span>
                      <input
                        id={titleInput}
                        name="questionnaire-title"
                        value={value.title}
                        maxLength={180}
                        placeholder="Dê um nome ao questionário"
                        onChange={(event) => change({ title: event.target.value })}
                      />
                    </label>
                    <label
                      className="questionnaire-editor__field"
                      htmlFor={`${formId}-description`}
                    >
                      <span>
                        Descrição para o mentorado <small>Opcional</small>
                      </span>
                      <GrowingTextarea
                        id={`${formId}-description`}
                        value={value.description}
                        maxLength={5000}
                        rows={3}
                        onChange={(description) => change({ description })}
                      />
                    </label>
                    <div className="questionnaire-editor__audience">
                      <label className="questionnaire-editor__field">
                        <span>Quem poderá responder?</span>
                        <select
                          value={value.accessScope}
                          onChange={(event) => {
                            const accessScope = event.target
                              .value as StageContentItem["accessScope"];
                            change({
                              accessScope,
                              cohortId: accessScope === "cohort" ? value.cohortId : null,
                              menteeId: accessScope === "mentee" ? value.menteeId : null,
                            });
                          }}
                        >
                          <option value="general">Todos os mentorados</option>
                          <option value="cohort">Uma turma específica</option>
                          <option value="mentee">Um mentorado específico</option>
                        </select>
                      </label>
                      {value.accessScope !== "general" ? (
                        <label className="questionnaire-editor__field" htmlFor={`${formId}-target`}>
                          <span>{value.accessScope === "cohort" ? "Turma" : "Mentorado"}</span>
                          <select
                            id={`${formId}-target`}
                            value={
                              (value.accessScope === "cohort" ? value.cohortId : value.menteeId) ??
                              ""
                            }
                            onChange={(event) =>
                              change(
                                value.accessScope === "cohort"
                                  ? { cohortId: event.target.value }
                                  : { menteeId: event.target.value },
                              )
                            }
                          >
                            <option value="">Selecione</option>
                            {(value.accessScope === "cohort" ? cohorts : mentees).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </details>
              <div className="questionnaire-editor__section-heading">
                <h3>Perguntas</h3>
                <span aria-live="polite">{count}</span>
              </div>
              <div className="questionnaire-editor__questions">
                {value.questions.map((q, index) => {
                  const open = expanded.has(q.id);
                  const questionId = `${formId}-${q.id}`;
                  return (
                    <article
                      className="questionnaire-editor__question"
                      key={q.id}
                      data-question-id={q.id}
                    >
                      <div className="questionnaire-editor__question-heading">
                        <button
                          type="button"
                          className="questionnaire-editor__toggle"
                          aria-expanded={open}
                          aria-controls={`${questionId}-body`}
                          onClick={() => toggleQuestion(q.id)}
                        >
                          <span className="questionnaire-editor__number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="questionnaire-editor__question-name">
                            <strong>Pergunta {index + 1}</strong>
                            {!open && <small>{q.prompt || "Escreva sua pergunta"}</small>}
                          </span>
                          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <div className="questionnaire-editor__question-actions">
                          <button
                            type="button"
                            aria-label={`Mover pergunta ${index + 1} para cima`}
                            disabled={index === 0}
                            onClick={() => moveQuestion(index, -1)}
                          >
                            <ArrowUp size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Mover pergunta ${index + 1} para baixo`}
                            disabled={index === value.questions.length - 1}
                            onClick={() => moveQuestion(index, 1)}
                          >
                            <ArrowDown size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Duplicar pergunta ${index + 1}`}
                            disabled={value.questions.length >= 50}
                            onClick={() => addQuestion(q, index)}
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remover pergunta ${index + 1}`}
                            onClick={() =>
                              change({
                                questions: value.questions.filter((item) => item.id !== q.id),
                              })
                            }
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      {open ? (
                        <div
                          id={`${questionId}-body`}
                          className="questionnaire-editor__question-body"
                        >
                          <label className="questionnaire-editor__field" htmlFor={questionId}>
                            <span>Pergunta</span>
                            <GrowingTextarea
                              id={questionId}
                              value={q.prompt}
                              maxLength={1000}
                              placeholder="Escreva a pergunta completa…"
                              onChange={(prompt) => updateQuestion(q.id, { prompt })}
                            />
                            <small className="questionnaire-editor__character-count">
                              {q.prompt.length}/1.000 caracteres
                            </small>
                          </label>
                          <div className="questionnaire-editor__answer-settings">
                            <label className="questionnaire-editor__field">
                              <span>Tipo de resposta</span>
                              <select
                                value={q.type}
                                onChange={(event) => {
                                  const type = event.target.value as StageQuestion["type"];
                                  updateQuestion(q.id, {
                                    type,
                                    options:
                                      type === "single_choice" && !q.options.length
                                        ? ["", ""]
                                        : q.options,
                                  });
                                }}
                              >
                                <option value="long_text">Resposta longa</option>
                                <option value="short_text">Resposta curta</option>
                                <option value="single_choice">Escolha única</option>
                              </select>
                            </label>
                            <label className="questionnaire-editor__required">
                              <input
                                type="checkbox"
                                checked={q.required}
                                onChange={(event) =>
                                  updateQuestion(q.id, { required: event.target.checked })
                                }
                              />
                              <span>Resposta obrigatória</span>
                            </label>
                          </div>
                          {q.type === "single_choice" ? (
                            <div className="questionnaire-editor__options">
                              <p>Opções de resposta</p>
                              {q.options.map((option, i) => (
                                <div className="questionnaire-editor__option" key={i}>
                                  <label className="questionnaire-editor__field">
                                    <span>Opção {i + 1}</span>
                                    <input
                                      value={option}
                                      maxLength={300}
                                      onChange={(event) =>
                                        updateQuestion(q.id, {
                                          options: q.options.map((text, position) =>
                                            position === i ? event.target.value : text,
                                          ),
                                        })
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    aria-label={`Remover opção ${i + 1} da pergunta ${index + 1}`}
                                    disabled={q.options.length <= 2}
                                    onClick={() =>
                                      updateQuestion(q.id, {
                                        options: q.options.filter((_, position) => position !== i),
                                      })
                                    }
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                </div>
                              ))}
                              <button
                                className="questionnaire-editor__secondary"
                                type="button"
                                disabled={q.options.length >= 20}
                                onClick={() =>
                                  updateQuestion(q.id, { options: [...q.options, ""] })
                                }
                              >
                                <Plus size={17} />
                                Adicionar opção
                              </button>
                            </div>
                          ) : (
                            <p className="questionnaire-editor__hint">
                              {q.type === "long_text"
                                ? "O mentorado terá um campo amplo para escrever sua reflexão."
                                : "O mentorado responderá em um campo de texto curto."}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div id={`${questionId}-body`} hidden />
                      )}
                    </article>
                  );
                })}
              </div>
              <button
                className="questionnaire-editor__add"
                type="button"
                disabled={value.questions.length >= 50}
                onClick={() => addQuestion()}
              >
                <Plus size={18} />
                {value.questions.length >= 50
                  ? "Limite de 50 perguntas atingido"
                  : "Adicionar pergunta"}
              </button>
              <p className="questionnaire-editor__hint">
                As respostas deste questionário ficam para acompanhamento das mentoras, sem análise
                por IA.
              </p>
            </fieldset>
          )}
        </div>
        {(error || message) && (
          <p className="questionnaire-editor__error" role="alert">
            {error || message}
          </p>
        )}
        <footer className="questionnaire-editor__footer">
          <span>
            {count} · {required} {required === 1 ? "obrigatória" : "obrigatórias"}
          </span>
          <div>
            <button
              type="button"
              className="questionnaire-editor__secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="questionnaire-editor__secondary"
              onClick={() => setPreview((current) => !current)}
              disabled={busy}
            >
              <Eye size={18} />
              {preview ? "Voltar à edição" : "Pré-visualizar"}
            </button>
            <button
              type="button"
              className="questionnaire-editor__save"
              onClick={save}
              disabled={busy}
            >
              <Check size={18} />
              {busy ? "Salvando…" : "Salvar questionário"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    target,
  );
}
