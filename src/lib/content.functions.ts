/* eslint-disable @typescript-eslint/no-explicit-any -- compatibility facade; Edge Function validates inputs */
import { createEdgeFunction } from "./edge-function-client";

export const videoFormats = [
  "recorded_class",
  "collective_recording",
  "cohort_onboarding",
  "individual_1_1",
] as const;

export type JourneyMaterial = {
  id: string;
  title: string;
  url: string | null;
  filePath: string | null;
  fileUrl: string | null;
};

export type JourneyContentItem = {
  stepKey: string;
  title: string;
  resourceType: string | null;
  format:
    | "questionnaire"
    | "form"
    | "recorded_class"
    | "collective_recording"
    | "cohort_onboarding"
    | "live_group"
    | "individual_1_1";
  description: string;
  summary: string;
  responsibleName: string | null;
  durationMinutes: number | null;
  monthNumber: number;
  pillarName: string;
  position: number;
  coverUrl: string | null;
  coverUrlLight: string | null;
  coverUrlDark: string | null;
  mediaUrl: string | null;
  questionnaireUrl: string | null;
  scheduledAt: string | null;
  releaseAt: string | null;
  topics: string[];
  materials: JourneyMaterial[];
  accessScope: "general" | "cohort" | "mentee";
  availability: "available" | "coming_soon" | "missing_resource";
  completed: boolean;
  currentSeconds: number;
  durationSeconds: number | null;
};

export type JourneyContentLibrary = {
  enrollmentId: string;
  currentMonth: number;
  items: JourneyContentItem[];
};

export const getJourneyContentLibrary = createEdgeFunction<undefined, JourneyContentLibrary | null>(
  "getJourneyContentLibrary",
);
export const getJourneyContent = createEdgeFunction<
  { stepKey: string },
  { item: JourneyContentItem; enrollmentId: string; previous: string | null; next: string | null }
>("getJourneyContent");
export const getJourneyStudyState = createEdgeFunction<
  { stepKey: string },
  {
    note: string;
    markers: Array<{
      id: string;
      timestamp_seconds: number;
      reflection: string;
      created_at: string;
    }>;
    currentSeconds: number;
    durationSeconds: number | null;
    completed: boolean;
  }
>("getJourneyStudyState");
export const saveJourneyContentNote: any = createEdgeFunction("saveJourneyContentNote");
export const addJourneyContentMarker: any = createEdgeFunction("addJourneyContentMarker");
export const saveJourneyContentProgress: any = createEdgeFunction("saveJourneyContentProgress");
export const createJourneyUpload: any = createEdgeFunction("createJourneyUpload");

export const createR2MultipartUpload: any = createEdgeFunction("createR2MultipartUpload");
export const getR2UploadPartUrls: any = createEdgeFunction("getR2UploadPartUrls");
export const completeR2MultipartUpload: any = createEdgeFunction("completeR2MultipartUpload");
export const abortR2MultipartUpload: any = createEdgeFunction("abortR2MultipartUpload");
