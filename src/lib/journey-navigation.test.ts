import assert from "node:assert/strict";
import test from "node:test";

import type { TrailLesson } from "@/components/rise-trail";
import type { JourneyContentItem } from "@/lib/content.functions";
import { findJourneyContentForLesson, hasOpenableJourneyContent } from "@/lib/journey-navigation";

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
