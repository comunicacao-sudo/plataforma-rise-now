import type { TrailLesson } from "@/components/rise-trail";
import type { JourneyContentItem } from "@/lib/content.functions";

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findJourneyContentForLesson(lesson: TrailLesson, items: JourneyContentItem[]) {
  const title = normalizeTitle(lesson.title);
  return (
    items.find(
      (item) => item.monthNumber === lesson.month && normalizeTitle(item.title) === title,
    ) ?? items.find((item) => normalizeTitle(item.title) === title)
  );
}

export function hasOpenableJourneyContent(item: JourneyContentItem | undefined) {
  if (!item || item.availability !== "available") return false;
  return Boolean(
    item.mediaUrl ||
    item.resourceType === "r2" ||
    item.resourceType === "rise_assessment" ||
    item.questionnaireId ||
    item.questionnaireUrl ||
    item.questionnaire,
  );
}
