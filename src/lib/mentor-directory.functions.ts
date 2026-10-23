import { createEdgeFunction } from "./edge-function-client";

export type MentorDirectoryEntry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  pillar: "Reflexão" | "Identidade" | "Segurança" | "Evolução";
  summary: string;
};

export type MentorDirectory = {
  mentors: MentorDirectoryEntry[];
};

/** Returns only the intentionally public professional fields of the four RISE mentors. */
export const getMentorDirectory = createEdgeFunction<undefined, MentorDirectory>(
  "getMentorDirectory",
);
