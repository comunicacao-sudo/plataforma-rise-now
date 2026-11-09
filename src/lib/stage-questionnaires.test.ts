import assert from "node:assert/strict";
import test from "node:test";
import {
  saveStageContentRecord,
  visibleStageQuestionnaires,
  allStageQuestionnairesSubmitted,
} from "../../supabase/functions/_shared/stage-questionnaires";

test("vários questionários do mesmo público e etapa recebem identidades independentes", async () => {
  const rows: Array<Record<string, unknown>> = [];
  const admin = {
    from() {
      let mode = "",
        payload: Record<string, unknown> = {},
        target = "";
      const chain = {
        insert(data: Record<string, unknown>) {
          mode = "insert";
          payload = data;
          return chain;
        },
        update(data: Record<string, unknown>) {
          mode = "update";
          payload = data;
          return chain;
        },
        is() {
          return chain;
        },
        eq(_key: string, id: string) {
          target = id;
          return chain;
        },
        select() {
          return chain;
        },
        async single() {
          if (mode === "insert") {
            const row = { id: String(rows.length + 1), deleted_at: null, ...payload };
            rows.push(row);
            return { data: row, error: null };
          }
          const index = rows.findIndex((row) => row["id"] === target && row["deleted_at"] === null);
          if (index < 0) return { data: null, error: null };
          rows[index] = { ...rows[index], ...payload };
          return { data: rows[index], error: null };
        },
      };
      return chain;
    },
  };
  for (const access_scope of ["general", "cohort", "mentee"]) {
    const payload = {
      pillar_id: "pilar",
      step_key: "etapa",
      content_type: "questionnaire",
      access_scope,
      cohort_id: access_scope === "cohort" ? "turma" : null,
      mentee_id: access_scope === "mentee" ? "pessoa" : null,
    };
    const first = await saveStageContentRecord(admin, { ...payload, title: "Primeiro" }, "");
    const second = await saveStageContentRecord(admin, { ...payload, title: "Segundo" }, "");
    assert.notEqual(first.id, second.id);
    await saveStageContentRecord(admin, { ...payload, title: "Primeiro revisado" }, first.id);
    assert.equal(rows.find((row) => row["id"] === second.id)?.["title"], "Segundo");
  }
  assert.equal(rows.length, 6);
  rows[0]!["deleted_at"] = "2026-11-09";
  await assert.rejects(
    () => saveStageContentRecord(admin, { title: "Não restaurar pela edição" }, "1"),
    /Não foi possível salvar/,
  );
});

test("a etapa bloqueada não expõe nenhum dos questionários e a ordem não altera os originais", () => {
  const rows = [
    {
      id: "b",
      title: "Segundo",
      content_type: "questionnaire",
      position: 2,
      questionnaire: { questions: [{ id: "q2", prompt: "Segunda pergunta" }] },
    },
    {
      id: "a",
      title: "Primeiro",
      content_type: "questionnaire",
      position: 1,
      questionnaire: { questions: [{ id: "q1", prompt: "Primeira pergunta" }] },
    },
    { id: "video", content_type: "video" },
  ];
  const original = JSON.stringify(rows);
  assert.deepEqual(visibleStageQuestionnaires(true, rows), []);
  assert.deepEqual(
    visibleStageQuestionnaires(false, rows).map((row: { id: string }) => row.id),
    ["a", "b"],
  );
  assert.equal(JSON.stringify(rows), original);
});

const questionnaireRows = [
  { id: "q1", pillar_id: "p", step_key: "s", content_type: "questionnaire" },
  { id: "q2", pillar_id: "p", step_key: "s", content_type: "questionnaire" },
  { id: "outro", pillar_id: "outro", step_key: "outra", content_type: "questionnaire" },
];
function responsesFixture(
  rows: Array<{
    content_id: string;
    enrollment_id: string;
    user_id: string;
    submitted_at: string | null;
  }>,
  failure = false,
) {
  return {
    from() {
      const conditions: Record<string, unknown> = {};
      let ids: string[] = [];
      const chain = {
        select() {
          return chain;
        },
        eq(key: string, value: unknown) {
          conditions[key] = value;
          return chain;
        },
        in(_key: string, value: string[]) {
          ids = value;
          return chain;
        },
        not() {
          return chain;
        },
        then(resolve: (value: unknown) => void) {
          resolve({
            error: failure ? { message: "indisponível" } : null,
            data: rows.filter(
              (row) =>
                row.submitted_at &&
                ids.includes(row.content_id) &&
                Object.entries(conditions).every(
                  ([key, value]) => row[key as keyof typeof row] === value,
                ),
            ),
          });
        },
      };
      return chain;
    },
  };
}
test("enviar o primeiro questionário não conclui a etapa enquanto o segundo estiver pendente", async () => {
  const admin = responsesFixture([
    { content_id: "q1", enrollment_id: "matricula", user_id: "pessoa", submitted_at: "2026-11-09" },
  ]);
  assert.equal(
    await allStageQuestionnairesSubmitted(
      admin,
      questionnaireRows,
      questionnaireRows[0],
      "matricula",
      "pessoa",
    ),
    false,
  );
});
test("respostas de outra pessoa ou matrícula não completam o questionário pendente", async () => {
  const admin = responsesFixture([
    { content_id: "q1", enrollment_id: "matricula", user_id: "pessoa", submitted_at: "2026-11-09" },
    { content_id: "q2", enrollment_id: "matricula", user_id: "outra", submitted_at: "2026-11-09" },
    { content_id: "q2", enrollment_id: "outra", user_id: "pessoa", submitted_at: "2026-11-09" },
  ]);
  assert.equal(
    await allStageQuestionnairesSubmitted(
      admin,
      questionnaireRows,
      questionnaireRows[0],
      "matricula",
      "pessoa",
    ),
    false,
  );
});
test("todos os envios da própria etapa concluem o conjunto sem exigir outro módulo", async () => {
  const admin = responsesFixture(
    ["q1", "q2"].map((content_id) => ({
      content_id,
      enrollment_id: "matricula",
      user_id: "pessoa",
      submitted_at: "2026-11-09",
    })),
  );
  assert.equal(
    await allStageQuestionnairesSubmitted(
      admin,
      questionnaireRows,
      questionnaireRows[0],
      "matricula",
      "pessoa",
    ),
    true,
  );
});
test("falha ao conferir progresso não é tratada como conclusão", async () => {
  await assert.rejects(
    () =>
      allStageQuestionnairesSubmitted(
        responsesFixture([], true),
        questionnaireRows,
        questionnaireRows[0],
        "matricula",
        "pessoa",
      ),
    /respostas foram preservadas/,
  );
});
