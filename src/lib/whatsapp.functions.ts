import type { WhatsAppTemplateKey } from "../../supabase/functions/_shared/whatsapp-templates.ts";

import { createEdgeFunction } from "./edge-function-client";

/** Gateway de WhatsApp Pamaris: credenciais ficam só nos secrets das Edge Functions. */

export type WhatsAppSettings = {
  accountCreated: boolean;
  meetingReminder: boolean;
  stageReleased: boolean;
  stageCompletedMentee: boolean;
  stageCompletedMentor: boolean;
  meetingReminderHours: number;
};

export type WhatsAppSessionStatus =
  | "unconfigured"
  | "unreachable"
  | "starting"
  | "initializing"
  | "qr_ready"
  | "ready"
  | "failed"
  | (string & {});

export type WhatsAppAdminState = {
  configured: boolean;
  session: {
    status: WhatsAppSessionStatus;
    phone: string | null;
    name: string | null;
    lastError: string | null;
  };
  qrCode: string | null;
  settings: WhatsAppSettings;
  /** false enquanto a migration 0042 não for aplicada no banco. */
  templatesAvailable: boolean;
  templates: Record<WhatsAppTemplateKey, string>;
  customizedTemplates: WhatsAppTemplateKey[];
  history: Array<{
    id: string;
    eventType: string;
    recipientRole: string;
    phone: string | null;
    status: "pending" | "sent" | "failed" | "delivered" | "read";
    error: string | null;
    at: string;
  }>;
};

type ActionResult = { ok: boolean; error?: string };

export const getWhatsAppAdminState = createEdgeFunction<undefined, WhatsAppAdminState>(
  "getWhatsAppAdminState",
);
export const saveWhatsAppSettings = createEdgeFunction<WhatsAppSettings, ActionResult>(
  "saveWhatsAppSettings",
);
export const saveWhatsAppTemplates = createEdgeFunction<
  { templates: Partial<Record<WhatsAppTemplateKey, string>> },
  ActionResult
>("saveWhatsAppTemplates");
export const startWhatsAppSession = createEdgeFunction<undefined, ActionResult>(
  "startWhatsAppSession",
);
export const getWhatsAppQrCode = createEdgeFunction<undefined, ActionResult & { qrCode?: string }>(
  "getWhatsAppQrCode",
);
export const sendWhatsAppTest = createEdgeFunction<
  { phone: string; message: string },
  ActionResult
>("sendWhatsAppTest");
