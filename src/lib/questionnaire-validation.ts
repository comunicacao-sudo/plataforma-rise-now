import type { StageQuestion } from "@/lib/content.functions";

/** Primeiro problema das perguntas de um questionário (ou null quando está tudo certo). */
export function questionnaireProblem(
  questions: StageQuestion[],
): { id: string | null; message: string } | null {
  if (!questions.length) return { id: null, message: "Adicione pelo menos uma pergunta." };
  const invalid = questions.find(
    (q) =>
      !q.prompt.trim() ||
      q.prompt.length > 1000 ||
      (q.type === "single_choice" &&
        (q.options.filter((o) => o.trim()).length < 2 ||
          q.options.some((o) => !o.trim()) ||
          new Set(q.options.map((o) => o.trim())).size !== q.options.length)),
  );
  if (!invalid) return null;
  return {
    id: invalid.id,
    message: !invalid.prompt.trim()
      ? "Preencha o texto de todas as perguntas."
      : invalid.prompt.length > 1000
        ? "Cada pergunta pode ter até 1.000 caracteres."
        : "As perguntas de escolha única precisam de pelo menos duas opções preenchidas e diferentes.",
  };
}
