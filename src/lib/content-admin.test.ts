import assert from "node:assert/strict";
import test from "node:test";

import {
  filterStageContents,
  groupByModule,
  moduleNames,
  moveModule,
  moveWithinModule,
  placeInModule,
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

test("módulos agrupam na ordem do primeiro conteúdo e as setas ficam dentro do módulo", () => {
  const lessons: StageContentItem[] = [
    { ...base, id: "a", contentType: "video", title: "A1", position: 0, moduleTitle: "Módulo A" },
    { ...base, id: "b", contentType: "video", title: "B1", position: 1, moduleTitle: "Módulo B" },
    {
      ...base,
      id: "c",
      contentType: "video",
      title: "A2",
      position: 2,
      moduleTitle: " Módulo  A ",
    },
    { ...base, id: "d", contentType: "material", title: "Solto", position: 3 },
  ];
  const groups = groupByModule(lessons);
  assert.deepEqual(
    groups.map((group) => [group.title, group.items.map((item) => item.id)]),
    [
      ["Módulo A", ["a", "c"]],
      ["Módulo B", ["b"]],
      ["", ["d"]],
    ],
  );
  assert.deepEqual(moduleNames(lessons), ["Módulo A", "Módulo B"]);
  // "c" sobe dentro do Módulo A e a ordem final já fica agrupada.
  assert.deepEqual(moveWithinModule(lessons, "c", -1), ["c", "a", "b", "d"]);
  // "b" é o único do Módulo B: não sai do módulo.
  assert.equal(moveWithinModule(lessons, "b", -1), null);
  assert.deepEqual(moveModule(lessons, "Módulo B", -1), ["b", "a", "c", "d"]);
  assert.equal(moveModule(lessons, "Módulo A", -1), null);
  // Posição na etapa: novo conteúdo do Módulo A vai para o início, depois de "a" ou para o fim
  // do próprio módulo; módulo novo vai para o fim da etapa.
  const novo = { ...base, id: "n", contentType: "video" as const, title: "Nova", position: 4 };
  const comNovo = [...lessons, { ...novo, moduleTitle: "Módulo A" }];
  assert.deepEqual(placeInModule(comNovo, "n", "start"), ["n", "a", "c", "b", "d"]);
  assert.deepEqual(placeInModule(comNovo, "n", { after: "a" }), ["a", "n", "c", "b", "d"]);
  assert.deepEqual(placeInModule(comNovo, "n", "end"), ["a", "c", "n", "b", "d"]);
  assert.deepEqual(placeInModule([...lessons, { ...novo, moduleTitle: "Módulo C" }], "n", "end"), [
    "a",
    "c",
    "b",
    "d",
    "n",
  ]);
  assert.equal(placeInModule(lessons, "x", "end"), null);
  assert.deepEqual(
    filterStageContents(lessons, {
      search: "",
      cohortId: "all",
      audience: "all",
      contentType: "all",
      sort: "position",
      module: "Módulo A",
    }).map((item) => item.id),
    ["a", "c"],
  );
});
