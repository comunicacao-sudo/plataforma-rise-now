import assert from "node:assert/strict";
import test from "node:test";

import {
  filterStageContents,
  paginate,
  stageMatchesFilters,
  summarizeStageContent,
} from "./content-admin";
import type { StageContentItem } from "./content.functions";

const base: Omit<StageContentItem, "id" | "contentType" | "title"> = {
  pillarId: "pillar-1",
  stepKey: "step-1",
  description: "",
  durationMinutes: null,
  mediaPath: null,
  filePath: null,
  externalUrl: null,
  questionnaire: { questions: [] },
  accessScope: "general",
  cohortId: null,
  menteeId: null,
  position: 0,
  active: true,
};

const items: StageContentItem[] = [
  { ...base, id: "1", contentType: "video", title: "Boas-vindas", position: 2 },
  {
    ...base,
    id: "2",
    contentType: "material",
    title: "Guia de reflexão",
    accessScope: "cohort",
    cohortId: "cohort-1",
    position: 1,
  },
  {
    ...base,
    id: "3",
    contentType: "questionnaire",
    title: "Questionário inicial",
    accessScope: "mentee",
    menteeId: "mentee-1",
    position: 3,
  },
];

test("content admin calculates real totals by type", () => {
  assert.deepEqual(summarizeStageContent(items), {
    total: 3,
    video: 1,
    material: 1,
    questionnaire: 1,
  });
});

test("content admin combines search, audience and cohort filters", () => {
  const filtered = filterStageContents(items, {
    search: "reflexao",
    cohortId: "cohort-1",
    audience: "cohort",
    contentType: "material",
    sort: "position",
  });
  assert.deepEqual(
    filtered.map((item) => item.id),
    ["2"],
  );
  assert.equal(
    stageMatchesFilters("Onboarding", items, {
      search: "guia",
      cohortId: "cohort-1",
      audience: "cohort",
    }),
    true,
  );
  const visibleToCohort = filterStageContents(items, {
    search: "",
    cohortId: "cohort-1",
    audience: "all",
    contentType: "all",
    sort: "position",
  });
  assert.deepEqual(
    visibleToCohort.map((item) => item.id),
    ["2", "1"],
    "conteúdo geral e conteúdo específico da turma devem aparecer juntos",
  );
});

test("content admin sorting and pagination stay deterministic", () => {
  const sorted = filterStageContents(items, {
    search: "",
    cohortId: "all",
    audience: "all",
    contentType: "all",
    sort: "position",
  });
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["2", "1", "3"],
  );
  assert.deepEqual(paginate(sorted, 2, 2), {
    items: [sorted[2]],
    page: 2,
    pageCount: 2,
    total: 3,
  });
});
