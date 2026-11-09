export type AccessCandidate = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  cohortId?: string | null;
  archivedAt?: string | null;
};
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]/g, "");
export function duplicatePhone(value: string | null | undefined) {
  let digits = (value ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    digits = digits.slice(2);
  return /^([1-9]\d)([2-9]\d{7}|9\d{8})$/.test(digits) ? digits : "";
}
function similar(a: string, b: string) {
  if (a === b || Math.min(a.length, b.length) < 10 || Math.abs(a.length - b.length) > 2)
    return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(
        row[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    if (Math.min(...row) > 2) return false;
    previous = row;
  }
  return previous[b.length]! <= 2;
}
/** Apenas sinaliza; nenhuma conta é unida, revogada ou excluída automaticamente. */
export function possibleAccessDuplicates(input: AccessCandidate[]) {
  const users = [...new Map(input.filter((x) => !x.archivedAt).map((x) => [x.id, x])).values()];
  const result = new Map<string, Array<{ otherId: string; reason: string }>>();
  const names = new Map<string, AccessCandidate[]>(),
    phones = new Map<string, AccessCandidate[]>(),
    emails = new Map<string, AccessCandidate[]>(),
    cohorts = new Map<string, AccessCandidate[]>();
  const add = (map: Map<string, AccessCandidate[]>, key: string, user: AccessCandidate) => {
    if (key) map.set(key, [...(map.get(key) ?? []), user]);
  };
  const pair = (a: AccessCandidate, b: AccessCandidate, reason: string) => {
    for (const [user, other] of [
      [a, b],
      [b, a],
    ] as const) {
      const old = result.get(user.id) ?? [];
      if (!old.some((x) => x.otherId === other.id && x.reason === reason))
        result.set(user.id, [...old, { otherId: other.id, reason }]);
    }
  };
  for (const user of users) {
    const name = normalized(user.name);
    if (name.length >= 6 && user.name.trim().split(/\s+/).length >= 2) add(names, name, user);
    add(phones, duplicatePhone(user.phone), user);
    add(emails, user.email.trim().toLowerCase(), user);
    if (user.cohortId) add(cohorts, user.cohortId, user);
  }
  for (const [map, reason] of [
    [names, "Mesmo nome completo"],
    [phones, "Mesmo WhatsApp ou telefone"],
    [emails, "Mesmo e-mail"],
  ] as const)
    for (const group of map.values())
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++) pair(group[i]!, group[j]!, reason);
  for (const group of cohorts.values())
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!,
          b = group[j]!;
        if (
          normalized(a.name.trim().split(/\s+/)[0] ?? "") ===
            normalized(b.name.trim().split(/\s+/)[0] ?? "") &&
          similar(normalized(a.name), normalized(b.name))
        )
          pair(a, b, "Nomes muito parecidos na mesma turma");
      }
  return result;
}
