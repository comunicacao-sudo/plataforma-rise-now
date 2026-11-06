import type { JourneyContentItem } from "./content.functions";

/** Mantém o vídeo em reprodução ao atualizar dados, sem reaproveitar permissões vencidas. */
export function retainPlaybackUrl(
  before: JourneyContentItem | undefined,
  after: JourneyContentItem,
  now = Date.now(),
): JourneyContentItem {
  if (
    !before?.mediaUrl ||
    !after.mediaUrl ||
    before.stepKey !== after.stepKey ||
    before.videoContentId !== after.videoContentId ||
    before.videoRevision !== after.videoRevision ||
    before.resourceType !== after.resourceType ||
    after.availability !== "available"
  )
    return after;
  if (before.mediaUrl === after.mediaUrl) return after;
  try {
    const oldUrl = new URL(before.mediaUrl),
      newUrl = new URL(after.mediaUrl);
    const parameter = oldUrl.searchParams.has("ticket") ? "ticket" : "token";
    const oldToken = oldUrl.searchParams.get(parameter),
      newToken = newUrl.searchParams.get(parameter);
    if (!oldToken || !newToken) return after;
    oldUrl.searchParams.delete(parameter);
    newUrl.searchParams.delete(parameter);
    if (oldUrl.href !== newUrl.href) return after;
    const parse = (token: string, index: number) =>
      JSON.parse(atob(token.split(".")[index]!.replaceAll("-", "+").replaceAll("_", "/")));
    if (parameter === "ticket") {
      const a = parse(oldToken, 0),
        b = parse(newToken, 0);
      if (
        a.userId !== b.userId ||
        a.sessionId !== b.sessionId ||
        a.contentId !== b.contentId ||
        a.revision !== b.revision ||
        !(a.expiresAt > now + 120000)
      )
        return after;
    } else if (!(parse(oldToken, 1).exp * 1000 > now + 120000)) return after;
    return { ...after, mediaUrl: before.mediaUrl };
  } catch {
    return after;
  }
}
