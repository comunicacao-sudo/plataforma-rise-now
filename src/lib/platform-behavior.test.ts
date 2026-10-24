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
