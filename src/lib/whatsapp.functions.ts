import type {
  AutomationAudience,
  AutomationTrigger,
} from "../../supabase/functions/_shared/whatsapp-automations.ts";
import type { WhatsAppTemplateKey } from "../../supabase/functions/_shared/whatsapp-templates.ts";

import { createEdgeFunction } from "./edge-function-client";

/** Gateway de WhatsApp Pamaris: credenciais ficam só nos secrets das Edge Functions. */

export type WhatsAppSettings = {
  accountCreated: boolean;
  meetingReminder: boolean;
  meetingReminderMentor: boolean;
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
    automation: string | null;
    recipientRole: string;
    phone: string | null;
    status: "pending" | "processing" | "sent" | "failed" | "delivered" | "read";
    error: string | null;
    at: string;
  }>;
};

type ActionResult = { ok: boolean; error?: string };

export type WhatsAppContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  audience: string;
  authorized: boolean;
  recordedAt: string | null;
  recordedBy: string | null;
};

export const listWhatsAppContacts = createEdgeFunction<undefined, { contacts: WhatsAppContact[] }>(
  "listWhatsAppContacts",
);
export const saveWhatsAppContact = createEdgeFunction<
  { userId: string; phone: string; authorized: boolean },
  ActionResult
>("saveWhatsAppContact");

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
export type WhatsAppAutomation = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  audience: AutomationAudience;
  offsetMinutes: number;
  weekday: number | null;
  sendTime: string | null;
  template: string;
  enabled: boolean;
  lastRunAt: string | null;
  isDefault: boolean;
};

export type WhatsAppAutomationDraft = Omit<WhatsAppAutomation, "id" | "lastRunAt" | "isDefault"> & {
  id?: string;
};

export const listWhatsAppAutomations = createEdgeFunction<
  undefined,
  {
    available: boolean;
    error?: string;
    automations: WhatsAppAutomation[];
    group: { id: string; name: string } | null;
  }
>("listWhatsAppAutomations");
export const saveWhatsAppAutomation = createEdgeFunction<
  WhatsAppAutomationDraft,
  ActionResult & { id?: string }
>("saveWhatsAppAutomation");
export const toggleWhatsAppAutomation = createEdgeFunction<
  { id: string; enabled: boolean },
  ActionResult
>("toggleWhatsAppAutomation");
export const deleteWhatsAppAutomation = createEdgeFunction<{ id: string }, ActionResult>(
  "deleteWhatsAppAutomation",
);
export const listWhatsAppGroups = createEdgeFunction<
  undefined,
  ActionResult & { groups?: Array<{ id: string; name: string }> }
>("listWhatsAppGroups");
export const saveWhatsAppGroup = createEdgeFunction<{ chatId: string }, ActionResult>(
  "saveWhatsAppGroup",
);
export const testWhatsAppAutomation = createEdgeFunction<
  WhatsAppAutomationDraft & { phone: string },
  ActionResult
>("testWhatsAppAutomation");

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
