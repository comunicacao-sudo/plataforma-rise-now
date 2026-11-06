export function isJourneyContentLocked(
  step: { month_number: number; release_at?: string | null },
  currentMonth: number,
  now: number,
) {
  return (
    step.month_number > currentMonth ||
    Boolean(step.release_at && Date.parse(step.release_at) > now)
  );
}

export function visibleStageQuestionnaire(
  locked: boolean,
  row: { id?: string; questionnaire?: unknown } | null | undefined,
) {
  const questionnaire = row?.questionnaire;
  return {
    questionnaireId: locked ? null : (row?.id ?? null),
    questionnaire:
      !locked && questionnaire && typeof questionnaire === "object" && !Array.isArray(questionnaire)
        ? questionnaire
        : null,
  };
}
