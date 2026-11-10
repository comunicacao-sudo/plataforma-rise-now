import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import type { StageQuestion } from "@/lib/content.functions";
import "./questionnaire-editor.css";

/**
 * Peças do editor de questionário usadas dentro do formulário de conteúdos
 * (mesmo layout de aula e material): lista de perguntas, prévia e checagem.
 */

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

export function QuestionsBuilder({
  questions,
  onChange,
  disabled = false,
  focusId = null,
}: {
  questions: StageQuestion[];
  onChange: (questions: StageQuestion[]) => void;
  disabled?: boolean;
  /** Pergunta a abrir e focar (ex.: a que tem problema ao salvar). */
  focusId?: string | null;
}) {
  const formId = useId();
  const [expanded, setExpanded] = useState(() => new Set(questions[0] ? [questions[0].id] : []));
  useEffect(() => {
    if (!focusId) return;
    setExpanded((current) => new Set([...current, focusId]));
    requestAnimationFrame(() => document.getElementById(`${formId}-${focusId}`)?.focus());
  }, [focusId, formId]);

  function updateQuestion(id: string, patch: Partial<StageQuestion>) {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function addQuestion(source?: StageQuestion, index = questions.length - 1) {
    if (questions.length >= 50) return;
    const question: StageQuestion = source
      ? { ...source, id: crypto.randomUUID(), options: [...source.options] }
      : { id: crypto.randomUUID(), prompt: "", type: "long_text", required: true, options: [] };
    const next = [...questions];
    next.splice(index + 1, 0, question);
    onChange(next);
    setExpanded(new Set([question.id]));
    requestAnimationFrame(() => document.getElementById(`${formId}-${question.id}`)?.focus());
  }
  function moveQuestion(index: number, direction: number) {
    const destination = index + direction;
    if (destination < 0 || destination >= questions.length) return;
    const next = [...questions];
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    onChange(next);
  }
  function toggleQuestion(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <fieldset className="questionnaire-editor questionnaire-editor--embedded" disabled={disabled}>
      <legend className="content-editor__sr">Perguntas do questionário</legend>
      <div className="questionnaire-editor__questions">
        {questions.map((q, index) => {
          const open = expanded.has(q.id);
          const questionId = `${formId}-${q.id}`;
          return (
            <article className="questionnaire-editor__question" key={q.id} data-question-id={q.id}>
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
                    disabled={index === questions.length - 1}
                    onClick={() => moveQuestion(index, 1)}
                  >
                    <ArrowDown size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Duplicar pergunta ${index + 1}`}
                    disabled={questions.length >= 50}
                    onClick={() => addQuestion(q, index)}
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover pergunta ${index + 1}`}
                    onClick={() => onChange(questions.filter((item) => item.id !== q.id))}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {open ? (
                <div id={`${questionId}-body`} className="questionnaire-editor__question-body">
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
                              type === "single_choice" && !q.options.length ? ["", ""] : q.options,
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
                        onClick={() => updateQuestion(q.id, { options: [...q.options, ""] })}
                      >
                        <Plus size={17} />
                        Adicionar opção
                      </button>
                    </div>
                  ) : (
                    <p className="questionnaire-editor__hint">
                      {q.type === "long_text"
                        ? "Quem participa terá um campo amplo para escrever a reflexão."
                        : "A resposta será dada em um campo de texto curto."}
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
        disabled={questions.length >= 50}
        onClick={() => addQuestion()}
      >
        <Plus size={18} />
        {questions.length >= 50 ? "Limite de 50 perguntas atingido" : "Adicionar pergunta"}
      </button>
      <p className="questionnaire-editor__hint">
        As respostas deste questionário ficam para acompanhamento das mentoras, sem análise por IA.
      </p>
    </fieldset>
  );
}

export function QuestionnairePreview({
  title,
  description,
  questions,
}: {
  title: string;
  description: string;
  questions: StageQuestion[];
}) {
  const formId = useId();
  return (
    <section
      className="questionnaire-editor questionnaire-editor--embedded questionnaire-editor__preview"
      aria-label="Prévia de quem participa"
    >
      <header>
        <p className="questionnaire-editor__kicker">PRÉVIA DE QUEM PARTICIPA</p>
        <h3>{title.trim() || "Seu questionário"}</h3>
        {description ? <p className="questionnaire-editor__description">{description}</p> : null}
      </header>
      {questions.length ? (
        questions.map((q, index) => (
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
  );
}
