export type AppRole = "mentee" | "admin";

/** Mentoras and legacy mentor roles always receive the unified administrative area. */
export function resolveAppRole(roles: readonly string[]): AppRole | null {
  const assigned = new Set(roles);
  if (assigned.has("admin") || assigned.has("mentor")) return "admin";
  if (assigned.has("mentee")) return "mentee";
  return null;
}
