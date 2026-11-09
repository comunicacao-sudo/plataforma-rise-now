import type { StageContentItem } from "./content.functions";

export type ContentTypeFilter = "all" | StageContentItem["contentType"];
export type AudienceFilter = "all" | StageContentItem["accessScope"];
export type ContentSort = "position" | "title" | "type";

export type ContentAdminFilters = {
  search: string;
  cohortId: string;
  audience: AudienceFilter;
  contentType: ContentTypeFilter;
  sort: ContentSort;
  /** "all", "" (sem módulo) ou o nome do módulo. */
  module?: string;
};

export type ContentCounts = {
  total: number;
  video: number;
  material: number;
  questionnaire: number;
};

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function summarizeStageContent(items: StageContentItem[]): ContentCounts {
  return items.reduce<ContentCounts>(
    (counts, item) => ({
      ...counts,
      total: counts.total + 1,
      [item.contentType]: counts[item.contentType] + 1,
    }),
    { total: 0, video: 0, material: 0, questionnaire: 0 },
  );
}

export function filterStageContents(items: StageContentItem[], filters: ContentAdminFilters) {
  const term = normalized(filters.search);
  const filtered = items.filter((item) => {
    if (filters.contentType !== "all" && item.contentType !== filters.contentType) return false;
    if (
      filters.module !== undefined &&
      filters.module !== "all" &&
      moduleOf(item) !== filters.module
    )
      return false;
    if (filters.audience !== "all" && item.accessScope !== filters.audience) return false;
    if (
      filters.cohortId !== "all" &&
      item.accessScope !== "general" &&
      item.cohortId !== filters.cohortId
    )
      return false;
    if (!term) return true;
    return normalized(`${item.title} ${item.description}`).includes(term);
  });

  return filtered.sort((left, right) => {
    if (filters.sort === "title") return left.title.localeCompare(right.title, "pt-BR");
    if (filters.sort === "type") {
      return (
        left.contentType.localeCompare(right.contentType, "pt-BR") ||
        left.title.localeCompare(right.title, "pt-BR")
      );
    }
    return left.position - right.position || left.title.localeCompare(right.title, "pt-BR");
  });
}

export function stageMatchesFilters(
  title: string,
  items: StageContentItem[],
  filters: Pick<ContentAdminFilters, "search" | "cohortId" | "audience">,
) {
  const scopeMatches = items.filter((item) => {
    if (filters.audience !== "all" && item.accessScope !== filters.audience) return false;
    if (
      filters.cohortId !== "all" &&
      item.accessScope !== "general" &&
      item.cohortId !== filters.cohortId
    )
      return false;
    return true;
  });
  const hasScopeFilter = filters.audience !== "all" || filters.cohortId !== "all";
  if (hasScopeFilter && scopeMatches.length === 0) return false;

  const term = normalized(filters.search);
  if (!term) return true;
  if (normalized(title).includes(term)) return true;
  return scopeMatches.some((item) =>
    normalized(`${item.title} ${item.description}`).includes(term),
  );
}

/** Nome do módulo do conteúdo ("" = sem módulo). */
export function moduleOf(item: Pick<StageContentItem, "moduleTitle">) {
  return (item.moduleTitle ?? "").replace(/\s+/g, " ").trim();
}

export type ContentModuleGroup = { title: string; items: StageContentItem[] };

/**
 * Agrupa por módulo mantendo a ordem da jornada: cada módulo aparece na posição
 * do seu primeiro conteúdo; dentro dele, a ordem definida pela equipe.
 */
export function groupByModule(items: StageContentItem[]): ContentModuleGroup[] {
  const ordered = [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const groups = new Map<string, StageContentItem[]>();
  for (const item of ordered) {
    const key = moduleOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([title, groupItems]) => ({ title, items: groupItems }));
}

/** Nomes de módulos existentes, na ordem em que aparecem. */
export function moduleNames(items: StageContentItem[]) {
  return groupByModule(items)
    .map((group) => group.title)
    .filter(Boolean);
}

/** Nova ordem (ids) ao mover um conteúdo dentro do próprio módulo. Null = não mexe. */
export function moveWithinModule(items: StageContentItem[], id: string, direction: number) {
  const groups = groupByModule(items);
  const group = groups.find((entry) => entry.items.some((item) => item.id === id));
  if (!group) return null;
  const index = group.items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (target < 0 || target >= group.items.length) return null;
  const moved = [...group.items];
  [moved[index], moved[target]] = [moved[target]!, moved[index]!];
  group.items = moved;
  return groups.flatMap((entry) => entry.items.map((item) => item.id));
}

/** Nova ordem (ids) ao mover um módulo inteiro para cima ou para baixo. */
export function moveModule(items: StageContentItem[], title: string, direction: number) {
  const groups = groupByModule(items);
  const index = groups.findIndex((group) => group.title === title);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= groups.length) return null;
  [groups[index], groups[target]] = [groups[target]!, groups[index]!];
  return groups.flatMap((entry) => entry.items.map((item) => item.id));
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    total: items.length,
  };
}
