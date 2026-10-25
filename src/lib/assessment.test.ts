import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AI_MENTEE_RELEASE_SECTIONS,
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_VERSION,
  PROMPT_VERSION,
  SCORING_VERSION,
  calculateAssessment,
  filterAssessmentResultForAudience,
  parseAIAssessmentInterpretation,
  projectAIAssessmentSections,
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

test("Natural e Adaptado são calculados separadamente com DISC independente", () => {
  const input = ASSESSMENT_QUESTIONS.map((question) => ({
    itemId: question.id,
    value: question.perspective === "natural" ? 2 : question.perspective === "adapted" ? 4 : 3,
  }));
  const result = calculateAssessment(input);
  assert.ok(result.competencies.every((item) => item.natural === 2));
  assert.ok(result.competencies.every((item) => item.adapted === 4));
  assert.ok(result.comparisons.every((item) => item.delta === 2));
  assert.ok(result.disc.natural.factors.every((item) => item.score === 25));
  assert.ok(result.disc.adapted.factors.every((item) => item.score === 75));
  assert.equal(result.disc.natural.balanced, true);
  assert.equal(result.disc.adapted.balanced, true);
  assert.match(result.summary.relevantDifference ?? "", /trabalho aparece maior/i);
});

test("DISC usa D, I, S e C como escalas independentes e preserva todas as evidências", () => {
  const factorValues = new Map([
    ["D", 5],
    ["I", 4],
    ["S", 2],
    ["C", 1],
  ]);
  const input = ASSESSMENT_QUESTIONS.map((question) => {
    if (question.perspective !== "natural" && question.perspective !== "adapted")
      return { itemId: question.id, value: 3 };
    const factor = ["initiative", "direction", "objectivity", "positioning"].includes(
      question.baseKey ?? "",
    )
      ? "D"
      : ["influence", "expression", "energy", "interaction"].includes(question.baseKey ?? "")
        ? "I"
        : ["people", "calm", "continuity", "focus", "autonomy"].includes(question.baseKey ?? "")
          ? "S"
          : "C";
    return { itemId: question.id, value: factorValues.get(factor)! };
  });
  const result = calculateAssessment(input);
  assert.deepEqual(
    result.disc.natural.factors.map((item) => [item.factor, item.score]),
    [
      ["D", 100],
      ["I", 75],
      ["S", 25],
      ["C", 0],
    ],
  );
  assert.deepEqual(result.disc.natural.primary, ["D"]);
  assert.equal(
    result.disc.natural.factors.reduce((sum, item) => sum + item.score, 0),
    200,
  );
  assert.equal(new Set(result.disc.natural.factors.flatMap((item) => item.evidence)).size, 19);
});

test("DISC reconhece empate e perfil equilibrado sem forçar rótulo único", () => {
  const result = calculateAssessment(answers(3));
  assert.equal(result.disc.natural.balanced, true);
  assert.deepEqual(result.disc.natural.primary, ["D", "I", "S", "C"]);
  assert.match(result.disc.natural.label, /equilibrado/i);
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
  assert.deepEqual(locked.disc, result.disc);
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

const aiFixture = {
  summary_for_mentee: "Resumo seguro para a mentorada.",
  profile_essence: "Essência exploratória do perfil.",
  strengths: ["Força baseada no resultado."],
  competencies: ["Competência observada."],
  development_points: ["Ponto de desenvolvimento."],
  attention_points: ["Ponto de atenção."],
  behavior_patterns: ["Padrão relatado."],
  development_recommendations: ["Recomendação prática."],
  reflection_questions: ["Qual situação concreta merece ser aprofundada?"],
  communication_guidance: ["Combine contexto, mensagem e confirmação de entendimento."],
  recommended_readings: [
    {
      title: "Livro real",
      author: "Autoria verificada",
      rationale: "Leitura ligada ao objetivo de desenvolvimento.",
      sources: [{ title: "Fonte editorial", url: "https://example.com/livro" }],
    },
  ],
  mentor_guidance: ["Orientação exclusiva para a mentoria."],
  evidence_notes: [{ note: "Leitura apoiada pelas respostas.", evidence_ids: ["N01", "A01"] }],
};

test("contrato da interpretação aceita somente a saída estruturada completa", () => {
  assert.deepEqual(parseAIAssessmentInterpretation(aiFixture), aiFixture);
  assert.throws(
    () => parseAIAssessmentInterpretation({ ...aiFixture, strengths: "não é um array" }),
    /formato inválido/i,
  );
  assert.throws(
    () => parseAIAssessmentInterpretation({ ...aiFixture, summary_for_mentee: "" }),
    /resumos obrigatórios/i,
  );
  assert.throws(
    () =>
      parseAIAssessmentInterpretation({
        ...aiFixture,
        recommended_readings: [
          { ...aiFixture.recommended_readings[0], sources: [{ title: "Fonte", url: "inventada" }] },
        ],
      }),
    /leituras recomendadas/i,
  );
});

test("projeção da mentorada nunca inclui orientação privada nem notas de evidência", () => {
  const projected = projectAIAssessmentSections(aiFixture, AI_MENTEE_RELEASE_SECTIONS);
  assert.equal(projected.summary_for_mentee, aiFixture.summary_for_mentee);
  assert.equal("mentor_guidance" in projected, false);
  assert.equal("evidence_notes" in projected, false);
});

test("integração de IA usa Responses API no backend e mantém idempotência no banco", () => {
  const backend = readFileSync(
    new URL("../../supabase/functions/rise-backend/index.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../../drizzle/migrations/0031_assessment_ai_idempotency.sql", import.meta.url),
    "utf8",
  );
  assert.match(backend, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(backend, /Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.match(backend, /Deno\.env\.get\("OPENAI_MODEL"\)/);
  assert.match(backend, /type:\s*"json_schema"/);
  assert.match(backend, /strict:\s*true/);
  assert.match(backend, /store:\s*false/);
  assert.match(backend, /type:\s*"web_search"/);
  assert.match(backend, /tool_choice:\s*"required"/);
  assert.match(backend, /queueAssessmentAISafely/);
  assert.match(migration, /unique index/i);
  assert.match(migration, /attempt_id, audience, prompt_version/i);
  assert.equal(PROMPT_VERSION, "rise-disc-insights-2.1");
});

test("backend usa os nomes reais dos parâmetros dos RPCs da jornada", () => {
  const backend = readFileSync(
    new URL("../../supabase/functions/rise-backend/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    backend,
    /rpc\("save_journey_draft",\s*\{\s*p_pillar_id:[\s\S]*?p_expected_revision:[\s\S]*?p_steps:/,
  );
  assert.match(
    backend,
    /rpc\("publish_journey_draft",\s*\{\s*p_pillar_id:[\s\S]*?p_expected_revision:[\s\S]*?p_apply_active:/,
  );
  assert.doesNotMatch(backend, /rpc\("save_journey_draft",\s*\{\s*_pillar_id:/);
  assert.doesNotMatch(backend, /rpc\("publish_journey_draft",\s*\{\s*_pillar_id:/);
});

test("publicação da jornada aceita frase de impacto opcional e preserva o rascunho em falha", () => {
  const migration = readFileSync(
    new URL("../../drizzle/migrations/0041_fix_journey_publish_validation.sql", import.meta.url),
    "utf8",
  );
  const editor = readFileSync(new URL("../components/journey-admin.tsx", import.meta.url), "utf8");
  assert.match(migration, /coalesce\(trim\(title\), ''\) = ''/i);
  assert.match(migration, /coalesce\(trim\(description\), ''\) = ''/i);
  assert.doesNotMatch(migration, /impact_lead\s*=\s*''/i);
  assert.match(editor, /O rascunho foi salvo, mas a publicação não foi concluída/);
  assert.match(editor, /invalidateJourneyData\(qc\)/);
});

test("relatório distribui a interpretação gerada e não exibe placeholders de integração", () => {
  const report = readFileSync(
    new URL("../components/rise-assessment.tsx", import.meta.url),
    "utf8",
  );
  assert.match(report, /reflection_questions/);
  assert.match(report, /communication_guidance/);
  assert.match(report, /recommended_readings/);
  assert.doesNotMatch(report, /Integração preparada/);
});

test("perfil da mentorada direciona cada aba para a seção funcional correspondente", () => {
  const profile = readFileSync(new URL("../components/rise-ops.tsx", import.meta.url), "utf8");
  const report = readFileSync(
    new URL("../components/rise-assessment.tsx", import.meta.url),
    "utf8",
  );

  assert.match(profile, /mapeamento:\s*"Mapeamento"/);
  assert.match(profile, /testes:\s*"Testes realizados"/);
  assert.match(profile, /plano:\s*"Plano de desenvolvimento"/);
  assert.match(profile, /leituras:\s*"Leituras recomendadas"/);
  assert.match(profile, /activeTab=\{assessmentTab\}/);
  assert.match(profile, /hideTabs/);
  assert.doesNotMatch(profile, /A fonte de recomendações ainda não foi definida/);
  assert.match(report, /const tab = activeTab \?\? internalTab/);
  assert.match(report, /activeTab=\{activeTab\}/);
  assert.match(report, /Pesquisar e gerar leituras/);
});

test("relatório mantém hierarquia visual consistente e não duplica o contexto nas abas externas", () => {
  const report = readFileSync(
    new URL("../components/rise-assessment.tsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(report, /const showReportContext = !hideTabs \|\| tab === "Mapeamento"/);
  for (const section of [
    "mapping",
    "leadership",
    "competencies",
    "development",
    "plan",
    "readings",
    "history",
  ]) {
    assert.match(report, new RegExp(`assessment-section assessment-section--${section}`));
  }
  assert.match(styles, /\.assessment-section__eyebrow/);
  assert.match(
    styles,
    /\.assessment-comparison-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/,
  );
  assert.match(styles, /\.assessment-reading-empty\s*\{[\s\S]*border:/);
});
