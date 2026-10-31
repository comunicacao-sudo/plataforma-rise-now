import assert from "node:assert/strict";
import test from "node:test";

import type { TrailLesson } from "@/components/rise-trail";
import type { JourneyContentItem } from "@/lib/content.functions";
import {
  buildJourneyTimelineItems,
  findJourneyContentForLesson,
  hasOpenableJourneyContent,
  isJourneyTimelineItemDisabled,
  journeyTimelineLabel,
  resolveJourneyTimelineTarget,
} from "@/lib/journey-navigation";

const lesson: TrailLesson = {
  id: "legacy-lesson",
  title: "Mapa de Esclarecimento",
  kind: "encontro",
  format: "1:1",
  mentor: "Camila Um",
  duration: 60,
  description: "",
  topics: [],
  mediaUrl: null,
  joinUrl: null,
  scheduledAt: null,
  month: 1,
  phaseTitle: "Reflexão",
  completed: false,
};

function content(overrides: Partial<JourneyContentItem> = {}): JourneyContentItem {
  return {
    stepKey: "step-1",
    title: "Mapa de Esclarecimento",
    resourceType: null,
    format: "individual_1_1",
    description: "",
    summary: "",
    responsibleName: "Camila Um",
    durationMinutes: 60,
    monthNumber: 1,
    pillarName: "Reflexão",
    position: 1,
    coverUrl: null,
    coverUrlLight: null,
    coverUrlDark: null,
    mediaUrl: null,
    questionnaireUrl: null,
    questionnaireId: null,
    questionnaire: null,
    scheduledAt: null,
    releaseAt: null,
    topics: [],
    materials: [],
    accessScope: "general",
    availability: "available",
    completed: false,
    currentSeconds: 0,
    durationSeconds: null,
    ...overrides,
  };
}

test("associa a etapa legada ao conteúdo publicado pelo mês e título", () => {
  const match = findJourneyContentForLesson(lesson, [
    content({ stepKey: "wrong-month", monthNumber: 2 }),
    content({ stepKey: "correct", title: "Mapa de esclarecimento" }),
  ]);
  assert.equal(match?.stepKey, "correct");
});

test("abre somente conteúdo realmente disponível", () => {
  assert.equal(hasOpenableJourneyContent(content()), false);
  assert.equal(hasOpenableJourneyContent(content({ availability: "coming_soon" })), false);
  assert.equal(hasOpenableJourneyContent(content({ mediaUrl: "https://example.com/video" })), true);
  assert.equal(hasOpenableJourneyContent(content({ resourceType: "r2" })), true);
  assert.equal(hasOpenableJourneyContent(content({ resourceType: "rise_assessment" })), true);
  assert.equal(hasOpenableJourneyContent(content({ questionnaireId: "questionnaire" })), true);
});

test("combina a versão publicada com aulas legadas sem duplicar e preserva a ordem", () => {
  const onboarding = { ...lesson, id: "onboarding", title: "Onboarding RISE" };
  const timeline = buildJourneyTimelineItems(
    1,
    [onboarding, lesson],
    [
      content({ stepKey: "onboarding-step", title: "Onboarding RISE", position: 0 }),
      content({ stepKey: "map-step", position: 1 }),
      content({
        stepKey: "assessment-step",
        title: "Questionário do perfil comportamental",
        position: 2,
        format: "questionnaire",
        resourceType: "rise_assessment",
      }),
    ],
  );

  assert.deepEqual(
    timeline.map((item) => item.title),
    ["Onboarding RISE", "Mapa de Esclarecimento", "Questionário do perfil comportamental"],
  );
  assert.equal(timeline.filter((item) => item.title === "Mapa de Esclarecimento").length, 1);
  assert.equal(timeline[2]?.lesson, null);
  assert.equal(timeline[2]?.content?.stepKey, "assessment-step");
});

test("mantém itens legados ausentes na versão moderna e usa fallback sem biblioteca", () => {
  const extra = { ...lesson, id: "extra", title: "Encontro legado" };
  const combined = buildJourneyTimelineItems(1, [lesson, extra], [content()]);
  assert.deepEqual(
    combined.map((item) => item.title),
    ["Mapa de Esclarecimento", "Encontro legado"],
  );

  const fallback = buildJourneyTimelineItems(1, [lesson], []);
  assert.equal(fallback[0]?.content, null);
  assert.equal(fallback[0]?.lesson?.id, "legacy-lesson");
});

test("identifica o mapeamento comportamental como Questionário e respeita disponibilidade", () => {
  const assessment = content({
    title: "Questionário do perfil comportamental",
    format: "questionnaire",
    resourceType: "rise_assessment",
  });
  assert.equal(journeyTimelineLabel(assessment), "Questionário");
  const availableItem = buildJourneyTimelineItems(1, [], [assessment])[0];
  assert.ok(availableItem);
  assert.deepEqual(resolveJourneyTimelineTarget(availableItem), {
    type: "content",
    stepKey: assessment.stepKey,
  });
  assert.equal(isJourneyTimelineItemDisabled(availableItem, 1), false);

  const unavailableItem = buildJourneyTimelineItems(
    1,
    [],
    [{ ...assessment, availability: "coming_soon" }],
  )[0];
  assert.ok(unavailableItem);
  assert.equal(isJourneyTimelineItemDisabled(unavailableItem, 1), true);
  assert.equal(resolveJourneyTimelineTarget(unavailableItem), null);
});

test("mantém o clique das aulas legadas e bloqueia aula futura", () => {
  const futureLesson = { ...lesson, id: "future", month: 2, kind: "aula" as const };
  const item = buildJourneyTimelineItems(2, [futureLesson], [])[0];
  assert.ok(item);
  assert.equal(isJourneyTimelineItemDisabled(item, 1), true);
  assert.deepEqual(resolveJourneyTimelineTarget(item), {
    type: "lesson",
    lesson: futureLesson,
  });
});
