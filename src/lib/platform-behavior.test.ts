import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("onboarding content opens before progress registration can fail", () => {
  const source = readFileSync("src/components/rise-platform.tsx", "utf8");
  const openAt = source.indexOf("onOpenContent(highlightedStep.stepKey)");
  const progressAt = source.indexOf("void markHighlightedStepStarted()", openAt);

  assert.ok(openAt >= 0, "content navigation must exist");
  assert.ok(progressAt > openAt, "content must open before progress is registered");
  assert.match(source, /catch \(error\) \{\s+console\.error\("Não foi possível registrar/);
});

test("mentor directory exposes only the four professional mentor profiles", () => {
  const backend = readFileSync("supabase/functions/rise-backend/index.ts", "utf8");
  const frontend = readFileSync("src/components/rise-platform.tsx", "utf8");

  for (const email of [
    "camilaum@pamarisdigital.com",
    "gabriela@pamarisdigital.com",
    "ana@pamarisdigital.com",
    "camila@pamarisdigital.com",
  ]) {
    assert.match(backend, new RegExp(email.replace(".", "\\.")));
  }
  assert.match(backend, /profile\.contact_email \|\| profile\.email/);
  assert.match(backend, /phone: profile\.phone \?\? null/);
  assert.match(backend, /avatarUrl: profile\.avatar_url \?\? null/);
  assert.match(backend, /profile\.mentor_summary/);
  assert.match(backend, /String\(profile\.mentor_summary \?\? ""\)\.trim\(\) \|\| mentor\.summary/);
  assert.match(frontend, /\{ label: "Mentoras", view: "mentoras" \}/);
});

test("mentor profile owns the public summary shown in the directory", () => {
  const profile = readFileSync("src/components/rise-extras.tsx", "utf8");
  assert.match(profile, /O que abordamos/);
  assert.match(profile, /role === "mentee"[\s\S]*currentProfile\.mentor_summary/);
  assert.match(profile, /maxLength=\{600\}/);
});

test("Google Calendar OAuth uses the official production callback", () => {
  const backend = readFileSync("supabase/functions/rise-backend/index.ts", "utf8");
  const callback = readFileSync("src/routes/oauth/google/return.tsx", "utf8");
  assert.match(backend, /https:\/\/board\.mentoriarisenow\.com\.br/);
  assert.match(backend, /new URL\("\/oauth\/google\/return", appBase\)/);
  assert.match(callback, /riseGoogleOAuthFailed/);
  assert.match(callback, /failureMessage/);
});

test("agenda unifies Google events, collective meetings and named 1:1 booking", () => {
  const backend = readFileSync("supabase/functions/rise-backend/index.ts", "utf8");
  const calendar = readFileSync("src/components/rise-calendar.tsx", "utf8");
  const operations = readFileSync("src/components/rise-ops.tsx", "utf8");
  const platform = readFileSync("src/components/rise-platform.tsx", "utf8");
  const migration = readFileSync("drizzle/migrations/0038_calendar_booking.sql", "utf8");

  assert.match(backend, /calendar\.events\.freebusy/);
  assert.match(backend, /\/calendar\/v3\/freeBusy/);
  assert.match(backend, /action === "getCalendarOverview"/);
  assert.match(backend, /action === "bookOneToOne"/);
  assert.match(backend, /d\.audience === "cohorts"/);
  assert.match(calendar, /"month", "week", "day"/);
  assert.match(calendar, /A mentorada escolhe o horário, sem escolher a mentora/);
  assert.match(migration, /booking_reservations_mentor_no_overlap/);
  assert.match(migration, /booking_reservations_mentee_no_overlap/);
  assert.doesNotMatch(operations, /Materiais da trilha/);
  assert.doesNotMatch(platform, /MenteeAgendaMaterials/);
});
