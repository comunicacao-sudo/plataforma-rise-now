import { useSyncExternalStore, type ImgHTMLAttributes } from "react";
import { RISE_THEME_EVENT, normalizeRiseTheme } from "@/lib/theme";
import { resolveJourneyThemeCovers, type JourneyThemeCover } from "@/lib/journey-sync";

function subscribeTheme(update: () => void) {
  window.addEventListener(RISE_THEME_EVENT, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(RISE_THEME_EVENT, update);
    window.removeEventListener("storage", update);
  };
}

/** Um único img: esconder a segunda imagem por CSS pode provocar outro download. */
export function JourneyCoverImage({
  item,
  ...props
}: { item: JourneyThemeCover } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src">) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => normalizeRiseTheme(document.documentElement.dataset["theme"]),
    () => "dark" as const,
  );
  const covers = resolveJourneyThemeCovers(item);
  const src = theme === "light" ? (covers.light ?? covers.dark) : (covers.dark ?? covers.light);
  return src ? <img {...props} src={src} decoding="async" /> : null;
}
