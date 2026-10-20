/* eslint-disable @typescript-eslint/no-explicit-any -- compatibility facade; Edge Function validates inputs */
import { createEdgeFunction } from "./edge-function-client";

export type RiseDirectory = {
  isAdmin: boolean;
  me: string;
  staff: Array<{
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
    staffType: string | null;
    specialtyId: string | null;
    specialty: string | null;
  }>;
  specialties: Array<{ id: string; name: string; category: string }>;
  cohorts: Array<{
    id: string;
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    [key: string]: unknown;
  }>;
  phases: Array<{
    id: string;
    month_number: number;
    title: string;
    pillar: string;
    lessons: Array<{ id: string; title: string; kind: string; position: number }>;
  }>;
  enrollments: Array<{
    id: string;
    status: string;
    progress: number;
    month: number;
    cohortId: string | null;
    mentorId: string | null;
    menteeId: string;
    name: string;
    email: string;
    profession: string;
  }>;
};

export const getDirectory = createEdgeFunction<undefined, RiseDirectory>("getDirectory");
export const createMember: any = createEdgeFunction("createMember");
export const createMentorSpecialty: any = createEdgeFunction("createMentorSpecialty");
export const updateEnrollment: any = createEdgeFunction("updateEnrollment");
export const resetMemberPassword: any = createEdgeFunction("resetMemberPassword");
