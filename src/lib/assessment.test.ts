import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_VERSION,
  SCORING_VERSION,
  calculateAssessment,
  filterAssessmentResultForAudience,
} from "./assessment";

const answers = (value: number) =>
  ASSESSMENT_QUESTIONS.map((question) => ({ itemId: question.id, value }));

test("instrumento possui exatamente 50 respostas e duas perspectivas equivalentes", () => {
  assert.equal(ASSESSMENT_QUESTIONS.length, 50);
  const natural = ASSESSMENT_QUESTIONS.filter((question) => question.perspective === "natural");
  const adapted = ASSESSMENT_QUESTIONS.filter((question) => question.perspective === "adapted");
  assert.equal(natural.length, 19);
  assert.equal(adapted.length, 19);
  assert.deepEqual(
    natural.map((question) => question.baseKey),
    adapted.map((question) => question.baseKey),
  );
});

test("cálculo é determinístico e mantém versionamento", () => {
  const first = calculateAssessment(answers(3));
  const second = calculateAssessment(answers(3));
  assert.equal(first.assessmentVersion, ASSESSMENT_VERSION);
  assert.equal(first.scoringVersion, SCORING_VERSION);
  assert.equal(first.responseCount, 50);
  assert.deepEqual({ ...first, calculatedAt: "ignored" }, { ...second, calculatedAt: "ignored" });
});

test("Natural e Adaptado são calculados separadamente e comparados sem porcentagem", () => {
  const input = ASSESSMENT_QUESTIONS.map((question) => ({
    itemId: question.id,
    value: question.perspective === "natural" ? 2 : question.perspective === "adapted" ? 4 : 3,
  }));
  const result = calculateAssessment(input);
  assert.ok(result.competencies.every((item) => item.natural === 2));
  assert.ok(result.competencies.every((item) => item.adapted === 4));
  assert.ok(result.comparisons.every((item) => item.delta === 2));
  assert.match(result.summary.relevantDifference ?? "", /trabalho aparece maior/i);
  assert.ok(!JSON.stringify(result).includes("%"));
});

test("dois mentorados podem produzir resultados diferentes e nova aplicação não altera a anterior", () => {
  const first = calculateAssessment(answers(1));
  const second = calculateAssessment(answers(5));
  assert.notDeepEqual(first.competencies, second.competencies);
  assert.ok(first.competencies.every((item) => item.adapted === 1));
  assert.ok(second.competencies.every((item) => item.adapted === 5));
  assert.equal(first.assessmentVersion, second.assessmentVersion);
});

test("respostas incompletas ou fora da escala são recusadas", () => {
  assert.throws(() => calculateAssessment(answers(3).slice(0, 49)), /50 respostas/);
  const invalid = answers(3);
  invalid[0] = { ...invalid[0]!, value: 0 };
  assert.throws(() => calculateAssessment(invalid), /escala permitida/);
});

test("relatório bloqueado omite leitura completa e relatório liberado a preserva", () => {
  const result = calculateAssessment(answers(4));
  const locked = filterAssessmentResultForAudience(result, "mentee_summary");
  const released = filterAssessmentResultForAudience(result, "mentee_full");
  assert.equal("leadership" in locked, false);
  assert.equal("development" in locked, false);
  assert.deepEqual(released.leadership, result.leadership);
  assert.deepEqual(released.development, result.development);
});

test("migration protege persistência, histórico e notas privadas no servidor", () => {
  const sql = readFileSync(
    new URL("../../drizzle/migrations/0012_rise_behavioral_assessment.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /assessment_attempts/);
  assert.match(sql, /assessment_responses/);
  assert.match(sql, /assessment_development_private_notes/);
  assert.match(sql, /revoke all on public\.assessment_attempts from anon, authenticated/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /assessment_version text not null/i);
  assert.match(sql, /scoring_version text not null/i);
  assert.match(sql, /prompt_version text not null/i);
  assert.match(sql, /Questionário do perfil comportamental/i);
  assert.match(sql, /resource_type[^\n]+rise_assessment|rise_assessment[^\n]+resource_type/i);
});

test("etapa do mapeamento permanece logo após o Mapa de Esclarecimento", () => {
  const sql = readFileSync(
    new URL(
      "../../drizzle/migrations/0013_assessment_after_clarification_map.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /Mapa de Esclarecimento/i);
  assert.match(sql, /assessment_position <> map_position \+ 1/i);
  assert.match(sql, /set position = map_position \+ 1/i);
});
