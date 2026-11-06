import assert from "node:assert/strict";
import test from "node:test";
import type { JourneyContentItem } from "./content.functions";
import { retainPlaybackUrl } from "./playback-cache";
const now = Date.parse("2026-11-06T12:00:00Z");
const ticket = (expiresAt: number, sessionId = "session-1") =>
  "https://example.invalid/rise-media?ticket=" +
  Buffer.from(
    JSON.stringify({ userId: "user-1", sessionId, contentId: "video-1", revision: 1, expiresAt }),
  ).toString("base64url") +
  ".signature";
const item = (mediaUrl: string | null, changes: Partial<JourneyContentItem> = {}) =>
  ({
    stepKey: "step-1",
    videoContentId: "video-1",
    videoRevision: 1,
    resourceType: "external",
    mediaUrl,
    availability: "available",
    currentSeconds: 0,
    ...changes,
  }) as JourneyContentItem;
test("atualizar o progresso não reinicia um vídeo cujo acesso continua válido", () => {
  const before = item(ticket(now + 3600000));
  const after = item(ticket(now + 3610000), { currentSeconds: 90 });
  const kept = retainPlaybackUrl(before, after, now);
  assert.equal(kept.mediaUrl, before.mediaUrl);
  assert.equal(kept.currentSeconds, 90);
});
test("troca de aula ou gravação sempre recebe a nova fonte", () => {
  const before = item(ticket(now + 3600000));
  for (const changes of [
    { videoContentId: "video-2" },
    { videoRevision: 2 },
    { stepKey: "step-2" },
  ]) {
    const after = item(ticket(now + 3610000), changes);
    assert.equal(retainPlaybackUrl(before, after, now), after);
  }
});
test("sessão renovada, expiração e revogação de acesso descartam a URL anterior", () => {
  const before = item(ticket(now + 3600000));
  for (const after of [
    item(ticket(now + 3610000, "session-2")),
    item(null),
    item(ticket(now + 3610000), { availability: "coming_soon" }),
  ])
    assert.equal(retainPlaybackUrl(before, after, now), after);
  const after = item(ticket(now + 3610000));
  assert.equal(retainPlaybackUrl(item(ticket(now + 1000)), after, now), after);
});
test("fonte ou ticket inválido não interrompe a atualização", () => {
  const after = item(ticket(now + 3610000));
  assert.equal(retainPlaybackUrl(item("invalid"), after, now), after);
  assert.equal(retainPlaybackUrl(item("https://other.invalid/video.mp4"), after, now), after);
});
