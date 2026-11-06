import assert from "node:assert/strict";
import test from "node:test";
import { retainJourneyCoverUrls } from "./journey-asset-cache";
import type { JourneyContentLibrary, JourneyContentItem } from "./content.functions";

const now = Date.parse("2026-11-06T10:00:00Z");
const signed = (expires: number, path = "cover.webp", seed = "a") =>
  `https://example.invalid/storage/${path}?token=e30.${Buffer.from(JSON.stringify({ exp: expires, seed })).toString("base64url")}.signature`;
const item = (url: string): JourneyContentItem =>
  ({
    stepKey: "passo",
    coverUrl: url,
    coverUrlLight: url,
    coverUrlDark: url,
    completed: false,
    availability: "available",
  }) as JourneyContentItem;
const library = (
  items: JourneyContentItem[],
  enrollmentId = "matricula",
): JourneyContentLibrary => ({ items, enrollmentId, currentMonth: 1 });

test("atualizar progresso não troca o endereço válido da mesma capa", () => {
  const oldUrl = signed(now / 1000 + 3600);
  const newUrl = signed(now / 1000 + 3615, "cover.webp", "novo");
  const result = retainJourneyCoverUrls(
    library([item(oldUrl)]),
    library([{ ...item(newUrl), completed: true }]),
    now,
  )!;
  assert.equal(result.items[0]!.coverUrl, oldUrl);
  assert.equal(result.items[0]!.completed, true);
});
test("capa alterada ou endereço prestes a vencer recebe a URL nova", () => {
  const fresh = signed(now / 1000 + 3600, "nova.webp");
  assert.equal(
    retainJourneyCoverUrls(library([item(signed(now / 1000 + 3600))]), library([item(fresh)]), now)!
      .items[0]!.coverUrl,
    fresh,
  );
  const renewed = signed(now / 1000 + 3600);
  assert.equal(
    retainJourneyCoverUrls(library([item(signed(now / 1000 + 60))]), library([item(renewed)]), now)!
      .items[0]!.coverUrl,
    renewed,
  );
});
test("cache de capas não mantém conteúdo removido nem mistura matrículas", () => {
  const old = library([item(signed(now / 1000 + 3600))]);
  assert.deepEqual(retainJourneyCoverUrls(old, library([]), now)!.items, []);
  assert.equal(retainJourneyCoverUrls(old, null, now), null);
  const other = library([item("outra-capa")], "outra-matricula");
  assert.equal(retainJourneyCoverUrls(old, other, now), other);
});
test("token de capa inválido falha para a URL nova, sem interromper a biblioteca", () => {
  const fresh = signed(now / 1000 + 3600);
  assert.equal(
    retainJourneyCoverUrls(
      library([item("https://example.invalid/storage/cover.webp?token=invalido")]),
      library([item(fresh)]),
      now,
    )!.items[0]!.coverUrl,
    fresh,
  );
});
