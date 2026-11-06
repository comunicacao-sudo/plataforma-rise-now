import type { JourneyContentLibrary } from "./content.functions";

/** Reaproveita apenas URLs de capas ainda válidas; progresso e permissões vêm da resposta nova. */
export function retainJourneyCoverUrls(
  previous: JourneyContentLibrary | null | undefined,
  next: JourneyContentLibrary | null,
  now = Date.now(),
) {
  if (!previous || !next || previous.enrollmentId !== next.enrollmentId) return next;
  const old = new Map(previous.items.map((item) => [item.stepKey, item]));
  const keep = (before: string | null, after: string | null) => {
    if (!before || !after || before === after) return after;
    try {
      const a = new URL(before),
        b = new URL(after);
      const token = a.searchParams.get("token");
      if (!token) return after;
      a.searchParams.delete("token");
      b.searchParams.delete("token");
      if (a.toString() !== b.toString()) return after;
      const payload = JSON.parse(
        atob(token.split(".")[1]!.replaceAll("-", "+").replaceAll("_", "/")),
      ) as { exp?: number };
      return typeof payload.exp === "number" && payload.exp * 1000 > now + 120_000 ? before : after;
    } catch {
      return after;
    }
  };
  return {
    ...next,
    items: next.items.map((item) => {
      const prior = old.get(item.stepKey);
      return prior
        ? {
            ...item,
            coverUrl: keep(prior.coverUrl, item.coverUrl),
            coverUrlLight: keep(prior.coverUrlLight, item.coverUrlLight),
            coverUrlDark: keep(prior.coverUrlDark, item.coverUrlDark),
          }
        : item;
    }),
  };
}
