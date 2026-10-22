/* eslint-disable @typescript-eslint/no-explicit-any -- compatibility facade; Edge Function validates inputs */
import { createEdgeFunction } from "./edge-function-client";

export const journeyFormats = [
  "questionnaire",
  "form",
  "recorded_class",
  "collective_recording",
  "cohort_onboarding",
  "live_group",
  "individual_1_1",
] as const;

export const completionRules = [
  "final_submission",
  "player_ended",
  "mentor_confirmation",
  "verified_external",
] as const;

export type JourneyDraftStep = {
  stableKey: string;
  title: string;
  format: (typeof journeyFormats)[number];
  impactLead: string;
  impactHighlight: string;
  impactTail: string;
  description: string;
  responsibleName: string | null;
  durationMinutes: number | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceUrl: string | null;
  scheduledAt: string | null;
  releaseAt: string | null;
  completionRule: (typeof completionRules)[number];
  required: boolean;
  monthNumber: number;
  coverPath: string | null;
  coverUrl?: string | null;
  coverPathLight: string | null;
  coverUrlLight?: string | null;
  coverPathDark: string | null;
  coverUrlDark?: string | null;
  mediaPath: string | null;
  summary: string;
  topics: string[];
  materials: Array<{ id: string; title: string; url: string | null; filePath: string | null }>;
  accessScope: "general" | "cohort" | "mentee";
  cohortId: string | null;
  menteeId: string | null;
};

export type NextJourneyStep = {
  state: "ready" | "blocked" | "waiting_resource" | "complete" | "no_enrollment" | "error";
  enrollmentId?: string;
  pillarId?: string;
  pillarName?: string;
  stepKey?: string;
  title?: string;
  format?: (typeof journeyFormats)[number];
  impactLead?: string;
  impactHighlight?: string;
  impactTail?: string;
  description?: string;
  responsibleName?: string | null;
  durationMinutes?: number | null;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceUrl?: string | null;
  scheduledAt?: string | null;
  releaseAt?: string | null;
  progressStatus?: "not_started" | "in_progress" | "awaiting_confirmation" | "completed";
  actionLabel?: string | null;
};

export type JourneyEditor = {
  isAdmin: boolean;
  pillars: Array<{ id: string; name: string; mentorName: string }>;
  selected: {
    id: string;
    name: string;
    mentorName: string;
    publishedVersionId: string | null;
  } | null;
  revision: number;
  updatedAt?: string;
  steps: JourneyDraftStep[];
  affectedActive: number;
  publishedStepKeys: string[];
  confirmations: Array<{
    enrollmentId: string;
    stepKey: string;
    status: "in_progress" | "awaiting_confirmation";
    updatedAt: string;
    menteeName: string;
    stepTitle: string;
  }>;
};

export const getJourneyEditor = createEdgeFunction<
  { pillarId?: string } | undefined,
  JourneyEditor
>("getJourneyEditor");
export const saveJourneyDraft: any = createEdgeFunction("saveJourneyDraft");
export const publishJourneyDraft: any = createEdgeFunction("publishJourneyDraft");
export const getNextJourneyStep = createEdgeFunction<undefined, NextJourneyStep>(
  "getNextJourneyStep",
);
export const startJourneyStep: any = createEdgeFunction("startJourneyStep");
export const confirmJourneyStep: any = createEdgeFunction("confirmJourneyStep");
