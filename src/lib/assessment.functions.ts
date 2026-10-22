/* eslint-disable @typescript-eslint/no-explicit-any -- compatibility facade; Edge Function validates inputs */
import { createEdgeFunction } from "./edge-function-client";

export const getMyAssessmentState: any = createEdgeFunction("getMyAssessmentState");
export const startAssessment: any = createEdgeFunction("startAssessment");
export const saveAssessmentAnswer: any = createEdgeFunction("saveAssessmentAnswer");
export const completeAssessment: any = createEdgeFunction("completeAssessment");
export const generateAssessmentInterpretation: any = createEdgeFunction(
  "generateAssessmentInterpretation",
);
export const getMyAssessmentProfile: any = createEdgeFunction("getMyAssessmentProfile");
export const getMentorAssessmentProfile: any = createEdgeFunction("getMentorAssessmentProfile");
export const releaseAssessmentReport: any = createEdgeFunction("releaseAssessmentReport");
export const saveAssessmentDevelopmentPlan: any = createEdgeFunction(
  "saveAssessmentDevelopmentPlan",
);
