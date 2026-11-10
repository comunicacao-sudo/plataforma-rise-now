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
  videoTitle?: string | null;
  videos?: Array<{
    id: string;
    title: string;
    module?: string | null;
    durationMinutes: number | null;
    completed: boolean;
  }>;
  videoCompleted?: boolean;
  videoContentId?: string | null;
  videoRevision?: number | null;
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
  questionnaireId: string | null;
  questionnaire: { questions: StageQuestion[] } | null;
  questionnaires?: Array<{
    id: string;
    title: string;
    description: string;
    questions: StageQuestion[];
  }>;
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
  { stepKey: string; contentId?: string },
  {
    item: JourneyContentItem;
    enrollmentId: string;
    previous: string | null;
    next: string | null;
    nextTitle?: string | null;
  }
>("getJourneyContent");
export const getJourneyStudyState = createEdgeFunction<
  { stepKey: string; contentId?: string },
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

export type StageQuestion = {
  id: string;
  prompt: string;
  type: "short_text" | "long_text" | "single_choice";
  required: boolean;
  options: string[];
};

export type StageContentItem = {
  id: string;
  pillarId: string;
  stepKey: string;
  contentType: "video" | "material" | "questionnaire";
  title: string;
  description: string;
  durationMinutes: number | null;
  durationSeconds?: number | null;
  sourceRevision?: number;
  engagement?: { eligible: number; started: number; completed: number };
  mediaPath: string | null;
  filePath: string | null;
  externalUrl: string | null;
  questionnaire: { questions: StageQuestion[] };
  accessScope: "general" | "cohort" | "mentee";
  cohortId: string | null;
  menteeId: string | null;
  position: number;
  active: boolean;
  /** Módulo dentro da etapa (null = sem módulo). */
  moduleTitle?: string | null;
  /** Principais temas da aula gravada. */
  topics?: string[];
  /** Material de apoio ligado a uma aula específica (null = todas as aulas da etapa). */
  lessonId?: string | null;
};

export type AgendaMaterial = {
  id: string;
  title: string;
  description: string;
  fileUrl: string | null;
  externalUrl: string | null;
  stepTitle: string;
  pillarName: string;
  monthNumber: number;
};

export const getStageContents = createEdgeFunction<
  { pillarId: string },
  { items: StageContentItem[] }
>("getStageContents");

export type MentorContentOverview = {
  pillars: Array<{
    id: string;
    name: string;
    steps: Array<{
      stableKey: string;
      title: string;
      format: string;
      monthNumber: number;
      scheduledAt: string | null;
      releaseAt: string | null;
      position: number;
      items: StageContentItem[];
    }>;
  }>;
};
export const getMentorContentOverview = createEdgeFunction<undefined, MentorContentOverview>(
  "getMentorContentOverview",
);

export const saveStageContent: any = createEdgeFunction("saveStageContent");
export const inspectStageVideo = createEdgeFunction<
  { sourceUrl: string },
  { durationSeconds: number | null }
>("inspectStageVideo");
export const getStageVideoPlayback = createEdgeFunction<
  { contentId: string },
  { r2: boolean; contentId: string; url: string | null; revision: number }
>("getStageVideoPlayback");
export const getProtectedDrivePlayback = createEdgeFunction<{ sourceUrl: string }, { url: string }>(
  "getProtectedDrivePlayback",
);
export const updateStageVideoMetadata = createEdgeFunction<
  { contentId: string; revision: number; durationSeconds: number },
  { ok: boolean }
>("updateStageVideoMetadata");
export type StageVideoViewer = {
  content_id: string;
  enrollment_id: string;
  user_id: string;
  display_name: string;
  current_seconds: number;
  max_seconds: number;
  duration_seconds: number | null;
  completed: boolean;
  first_viewed_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
};
export const getStageVideoEngagement = createEdgeFunction<
  { contentId: string },
  { viewers: StageVideoViewer[] }
>("getStageVideoEngagement");
export const deleteStageContent: any = createEdgeFunction("deleteStageContent");

export const getMyAgendaMaterials = createEdgeFunction<undefined, { items: AgendaMaterial[] }>(
  "getMyAgendaMaterials",
);

export const getStageQuestionnaireResponse = createEdgeFunction<
  { contentId: string },
  { answers: Record<string, string>; submitted: boolean } | null
>("getStageQuestionnaireResponse");

export const submitStageQuestionnaire: any = createEdgeFunction("submitStageQuestionnaire");

export const orderStageContents = createEdgeFunction<
  { pillarId: string; stepKey: string; expectedIds: string[]; ids: string[] },
  { ok: boolean }
>("orderStageContents");

export const renameStageModule = createEdgeFunction<
  { pillarId: string; stepKey: string; from: string; to: string },
  { ok: boolean; updated: number }
>("renameStageModule");

export const assignStageModule = createEdgeFunction<
  { pillarId: string; stepKey: string; ids: string[]; moduleTitle: string },
  { ok: boolean; updated: number }
>("assignStageModule");
