import assert from "node:assert/strict";
import test from "node:test";

import { questionnaireProblem } from "./questionnaire-validation";

const pergunta = (patch = {}) => ({
  id: "q1",
  prompt: "O que aconteceu?",
  type: "long_text" as const,
  required: true,
  options: [] as string[],
  ...patch,
});

test("questionário: exige ao menos uma pergunta preenchida e opções válidas", () => {
  assert.equal(questionnaireProblem([])?.message, "Adicione pelo menos uma pergunta.");
  assert.equal(questionnaireProblem([pergunta()]), null);
  assert.equal(questionnaireProblem([pergunta({ prompt: "  " })])?.id, "q1");
  assert.match(
    questionnaireProblem([pergunta({ type: "single_choice", options: ["Sim", "Sim"] })])!.message,
    /duas opções/,
  );
  assert.equal(
    questionnaireProblem([pergunta({ type: "single_choice", options: ["Sim", "Não"] })]),
    null,
  );
});
