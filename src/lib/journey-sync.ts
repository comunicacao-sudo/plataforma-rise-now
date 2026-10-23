import type { QueryClient } from "@tanstack/react-query";

import type { JourneyDraftStep } from "@/lib/journey.functions";

export const JOURNEY_SYNC_INTERVAL_MS = 15_000;

export const liveJourneyQueryOptions = {
  staleTime: 0,
  refetchInterval: JOURNEY_SYNC_INTERVAL_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;

export const journeyQueryKeys = [
  ["journey-editor"],
  ["journey-content-structure"],
  ["stage-contents"],
  ["journey-content-library"],
  ["journey-content"],
  ["next-journey-step"],
  ["trail"],
  ["agenda-materials"],
] as const;

export async function invalidateJourneyData(queryClient: QueryClient) {
  await Promise.all(
    journeyQueryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey: [...queryKey], refetchType: "active" }),
    ),
  );
}

function cleanText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNullableText(value: string | null | undefined) {
  const clean = cleanText(value);
  return clean || null;
}

export function journeyStepSignature(step: JourneyDraftStep) {
  return JSON.stringify({
    stableKey: step.stableKey,
    title: cleanText(step.title),
    format: step.format,
    impactLead: cleanText(step.impactLead),
    impactHighlight: cleanText(step.impactHighlight),
    impactTail: cleanText(step.impactTail),
    description: cleanText(step.description),
    responsibleName: cleanNullableText(step.responsibleName),
    durationMinutes: step.durationMinutes ?? null,
    resourceType: cleanNullableText(step.resourceType),
    resourceId: cleanNullableText(step.resourceId),
    resourceUrl: cleanNullableText(step.resourceUrl),
    scheduledAt: step.scheduledAt ?? null,
    releaseAt: step.releaseAt ?? null,
    completionRule: step.completionRule,
    required: step.required,
    monthNumber: step.monthNumber,
    coverPath: step.coverPath ?? null,
    coverPathLight: step.coverPathLight ?? null,
    coverPathDark: step.coverPathDark ?? null,
    mediaPath: step.mediaPath ?? null,
    summary: cleanText(step.summary),
    topics: step.topics.map(cleanText).filter(Boolean),
    materials: step.materials.map((material) => ({
      id: material.id,
      title: cleanText(material.title),
      url: cleanNullableText(material.url),
      filePath: material.filePath ?? null,
    })),
    accessScope: step.accessScope,
    cohortId: step.cohortId ?? null,
    menteeId: step.menteeId ?? null,
  });
}

export type JourneyThemeCover = {
  coverUrl?: string | null;
  coverUrlLight?: string | null;
  coverUrlDark?: string | null;
};

export function resolveJourneyThemeCovers(item: JourneyThemeCover) {
  return {
    light: item.coverUrlLight ?? (!item.coverUrlDark ? (item.coverUrl ?? null) : null),
    dark: item.coverUrlDark ?? (!item.coverUrlLight ? (item.coverUrl ?? null) : null),
  };
}
