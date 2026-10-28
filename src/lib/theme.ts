export const RISE_THEME_STORAGE_KEY = "rise-theme-preference";
export const RISE_THEME_EVENT = "rise-theme-change";

export type RiseTheme = "dark" | "light";

export function normalizeRiseTheme(value: unknown): RiseTheme {
  return value === "light" ? "light" : "dark";
}

export function readLocalRiseTheme(): RiseTheme {
  if (typeof window === "undefined") return "dark";
  try {
    return normalizeRiseTheme(window.localStorage.getItem(RISE_THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function applyRiseTheme(theme: RiseTheme, persistLocally = true) {
  if (typeof document === "undefined") return;
  const resolved = normalizeRiseTheme(theme);
  document.documentElement.dataset["theme"] = resolved;
  document.documentElement.style.colorScheme = resolved;
  if (persistLocally) {
    try {
      window.localStorage.setItem(RISE_THEME_STORAGE_KEY, resolved);
    } catch {
      // The theme still applies when storage is unavailable (private/restricted browser mode).
    }
  }
  window.dispatchEvent(new CustomEvent<RiseTheme>(RISE_THEME_EVENT, { detail: resolved }));
}
