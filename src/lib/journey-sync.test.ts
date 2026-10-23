import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { journeyQueryKeys, journeyStepSignature, resolveJourneyThemeCovers } from "./journey-sync";
import type { JourneyDraftStep } from "./journey.functions";

function step(overrides: Partial<JourneyDraftStep> = {}): JourneyDraftStep {
  return {
    stableKey: "step-1",
    title: "Mapa de Esclarecimento",
    format: "recorded_class",
    impactLead: "Enxergar",
    impactHighlight: "com clareza",
    impactTail: "para avançar",
    description: "Descrição",
    responsibleName: "Camila Um",
    durationMinutes: 60,
    resourceType: "r2",
    resourceId: "lesson-1",
    resourceUrl: null,
    scheduledAt: null,
    releaseAt: null,
    completionRule: "player_ended",
    required: true,
    monthNumber: 1,
    coverPath: "covers/legacy.webp",
    coverUrl: null,
    coverPathLight: "covers/light.webp",
    coverUrlLight: null,
    coverPathDark: "covers/dark.webp",
    coverUrlDark: null,
    mediaPath: "r2:lesson.mp4",
    summary: "Resumo",
    topics: ["Clareza"],
    materials: [{ id: "m1", title: "Mapa", url: null, filePath: "materials/mapa.pdf" }],
    accessScope: "general",
    cohortId: null,
    menteeId: null,
    ...overrides,
  };
}

test("publication signature detects every persisted functional field", () => {
  const original = step();
  const variants: Partial<JourneyDraftStep>[] = [
    { responsibleName: "Outra mentora" },
    { durationMinutes: 90 },
    { resourceType: "external" },
    { resourceId: "lesson-2" },
    { resourceUrl: "https://example.com/aula" },
    { scheduledAt: "2026-11-01T12:00:00Z" },
    { releaseAt: "2026-11-01T10:00:00Z" },
    { completionRule: "mentor_confirmation" },
    { required: false },
    { coverPathLight: "covers/new-light.webp" },
    { coverPathDark: "covers/new-dark.webp" },
    { mediaPath: "r2:new.mp4" },
    { materials: [{ id: "m2", title: "Novo", url: null, filePath: null }] },
    { accessScope: "cohort", cohortId: "cohort-1" },
    { accessScope: "mentee", menteeId: "mentee-1" },
  ];

  for (const variant of variants) {
    assert.notEqual(journeyStepSignature(original), journeyStepSignature(step(variant)));
  }
});

test("publication signature ignores harmless surrounding whitespace", () => {
  assert.equal(
    journeyStepSignature(step()),
    journeyStepSignature(step({ title: "  Mapa de Esclarecimento  ", summary: " Resumo " })),
  );
});

test("theme covers remain independent and keep the legacy fallback", () => {
  assert.deepEqual(
    resolveJourneyThemeCovers({
      coverUrl: "legacy",
      coverUrlLight: "light",
      coverUrlDark: "dark",
    }),
    { light: "light", dark: "dark" },
  );
  assert.deepEqual(resolveJourneyThemeCovers({ coverUrl: "legacy" }), {
    light: "legacy",
    dark: "legacy",
  });
  assert.deepEqual(resolveJourneyThemeCovers({ coverUrlDark: "dark" }), {
    light: null,
    dark: "dark",
  });
});

test("journey invalidation covers every consumer of publications and covers", () => {
  const roots: string[] = journeyQueryKeys.map(([root]) => root);
  for (const required of [
    "journey-editor",
    "journey-content-structure",
    "journey-content-library",
    "journey-content",
    "next-journey-step",
    "trail",
  ]) {
    assert.ok(roots.includes(required), `${required} must be invalidated`);
  }
});

test("backend serves only the assigned or current published journey with scoped active content", () => {
  const source = readFileSync("supabase/functions/rise-backend/index.ts", "utf8");
  assert.match(source, /assigned\.get\(p\.id\) \?\? p\.current_published_version_id/);
  assert.match(source, /\.eq\("active", true\)/);
  assert.match(source, /s\.access_scope === "cohort" && s\.cohort_id === enrollment\.cohort_id/);
  assert.match(source, /s\.access_scope === "mentee" && s\.mentee_id === userId/);
  assert.match(source, /item\.availability === "coming_soon"/);
});

test("cover uploads use immutable unique paths instead of overwriting cached URLs", () => {
  const source = readFileSync("supabase/functions/rise-backend/index.ts", "utf8");
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /createSignedUploadUrl\(path, \{ upsert: false \}\)/);
  assert.match(source, /cover_path_light/);
  assert.match(source, /cover_path_dark/);
});
