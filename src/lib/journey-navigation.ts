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

export type JourneyTimelineItem = {
  key: string;
  title: string;
  label: string;
  completed: boolean;
  availability: JourneyContentItem["availability"] | null;
  content: JourneyContentItem | null;
  lesson: TrailLesson | null;
};

export type JourneyTimelineTarget =
  | { type: "content"; stepKey: string }
  | { type: "lesson"; lesson: TrailLesson };

export function journeyTimelineLabel(item: JourneyContentItem) {
  if (
    item.resourceType === "rise_assessment" ||
    item.format === "questionnaire" ||
    item.format === "form"
  ) {
    return "Questionário";
  }
  if (item.format === "recorded_class" || item.format === "collective_recording") {
    return "Aula";
  }
  if (item.format === "individual_1_1") return "1:1";
  if (item.format === "cohort_onboarding" || item.format === "live_group") return "Coletivo";
  return "Etapa";
}

export function buildJourneyTimelineItems(
  month: number,
  lessons: TrailLesson[],
  contents: JourneyContentItem[],
): JourneyTimelineItem[] {
  const monthContents = contents
    .filter((item) => item.monthNumber === month)
    .sort((a, b) => a.position - b.position);

  if (!monthContents.length) {
    return lessons.map((lesson) => ({
      key: `lesson:${lesson.id}`,
      title: lesson.title,
      label: lesson.kind === "aula" ? "Aula" : (lesson.format ?? "Encontro"),
      completed: lesson.completed,
      availability: null,
      content: null,
      lesson,
    }));
  }

  const matchedLessonIds = new Set<string>();
  const publishedItems = monthContents.map<JourneyTimelineItem>((content) => {
    const normalizedContentTitle = normalizeTitle(content.title);
    const lesson =
      lessons.find(
        (candidate) =>
          !matchedLessonIds.has(candidate.id) &&
          normalizeTitle(candidate.title) === normalizedContentTitle,
      ) ?? null;
    if (lesson) matchedLessonIds.add(lesson.id);

    return {
      key: `step:${content.stepKey}`,
      title: content.title,
      label: journeyTimelineLabel(content),
      completed: content.completed || Boolean(lesson?.completed),
      availability: content.availability,
      content,
      lesson,
    };
  });

  const unmatchedLegacyItems = lessons
    .filter((lesson) => !matchedLessonIds.has(lesson.id))
    .map<JourneyTimelineItem>((lesson) => ({
      key: `lesson:${lesson.id}`,
      title: lesson.title,
      label: lesson.kind === "aula" ? "Aula" : (lesson.format ?? "Encontro"),
      completed: lesson.completed,
      availability: null,
      content: null,
      lesson,
    }));

  return [...publishedItems, ...unmatchedLegacyItems];
}

export function isJourneyTimelineItemDisabled(
  item: JourneyTimelineItem,
  currentMonth: number,
) {
  if (item.availability !== null) return item.availability !== "available";
  return Boolean(
    item.lesson?.kind === "aula" &&
      item.lesson.month > currentMonth &&
      !item.completed,
  );
}

export function resolveJourneyTimelineTarget(
  item: JourneyTimelineItem,
): JourneyTimelineTarget | null {
  if (item.content && hasOpenableJourneyContent(item.content)) {
    return { type: "content", stepKey: item.content.stepKey };
  }
  if (item.lesson) return { type: "lesson", lesson: item.lesson };
  return null;
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
