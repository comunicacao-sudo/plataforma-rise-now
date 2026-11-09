// @ts-nocheck
/** Cada cadastro ganha sua própria identidade; público e etapa não são chaves únicas. */
export async function saveStageContentRecord(admin, payload, id) {
  const query = id
    ? admin.from("journey_stage_contents").update(payload).is("deleted_at", null).eq("id", id)
    : admin.from("journey_stage_contents").insert(payload);
  const result = await query.select("*").is("deleted_at", null).single();
  if (result.error || !result.data)
    throw new Error(result.error?.message ?? "Não foi possível salvar o conteúdo.");
  return result.data;
}

/** Recebe somente os registros previamente filtrados pelas permissões e liberação da etapa. */
export function visibleStageQuestionnaires(locked, rows) {
  if (locked) return [];
  return rows
    .filter((row) => row.content_type === "questionnaire")
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) ||
        String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      questions: Array.isArray(row.questionnaire?.questions) ? row.questionnaire.questions : [],
    }));
}

/** Respostas são isoladas por questionário, matrícula e pessoa. */
export async function allStageQuestionnairesSubmitted(admin, rows, row, enrollmentId, userId) {
  const ids = [
    ...new Set(
      rows
        .filter(
          (item) =>
            item.pillar_id === row.pillar_id &&
            item.step_key === row.step_key &&
            item.content_type === "questionnaire",
        )
        .map((item) => item.id),
    ),
  ];
  if (!ids.length) return false;
  const result = await admin
    .from("journey_stage_questionnaire_responses")
    .select("content_id")
    .eq("enrollment_id", enrollmentId)
    .eq("user_id", userId)
    .in("content_id", ids)
    .not("submitted_at", "is", null);
  if (result.error)
    throw new Error(
      "Não foi possível conferir o envio dos questionários. Suas respostas foram preservadas.",
    );
  const submitted = new Set((result.data ?? []).map((item) => item.content_id));
  return ids.every((id) => submitted.has(id));
}
