/* eslint-disable @typescript-eslint/no-explicit-any -- Migration 0017 is not part of the generated remote types yet. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const [{ data: admin }, { data: mentor }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "mentor" }),
  ]);
  if (!admin && !mentor) throw new Error("Acesso restrito à administração RISE NOW.");
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}

const settingsSchema = z.object({
  accountCreated: z.boolean(),
  meetingReminder: z.boolean(),
  stageReleased: z.boolean(),
  stageCompletedMentee: z.boolean(),
  stageCompletedMentor: z.boolean(),
  meetingReminderHours: z.number().int().min(1).max(168),
});

export const getWhatsAppAdminState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const whatsapp = await import("@/lib/whatsapp.server");
    const [settings, session] = await Promise.all([
      whatsapp.getWhatsAppSettings(),
      whatsapp.getWhatsAppSessionState(),
    ]);
    const runtime = whatsapp.getWhatsAppRuntimeConfig();
    const qrCode = session.status === "SCAN_QR_CODE" ? await whatsapp.getWhatsAppQrDataUrl() : null;
    return { configured: runtime.configured, settings, session, qrCode };
  });

export const saveWhatsAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await (supabaseAdmin as any)
        .from("whatsapp_settings")
        .update({
          enabled_account_created: data.accountCreated,
          enabled_meeting_reminder: data.meetingReminder,
          enabled_stage_released: data.stageReleased,
          enabled_stage_completed_mentee: data.stageCompletedMentee,
          enabled_stage_completed_mentor: data.stageCompletedMentor,
          meeting_reminder_hours: data.meetingReminderHours,
          updated_by: context.userId,
        })
        .eq("id", "primary");
      if (error) throw new Error(error.message);
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: message(error) };
    }
  });

export const startWhatsAppSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    try {
      const { startWhatsAppSessionOnWaha } = await import("@/lib/whatsapp.server");
      await startWhatsAppSessionOnWaha();
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: message(error) };
    }
  });

export const restartWhatsAppSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    try {
      const { restartWhatsAppSessionOnWaha } = await import("@/lib/whatsapp.server");
      await restartWhatsAppSessionOnWaha();
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: message(error) };
    }
  });

export const disconnectWhatsAppSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    try {
      const { disconnectWhatsAppSessionOnWaha } = await import("@/lib/whatsapp.server");
      await disconnectWhatsAppSessionOnWaha();
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: message(error) };
    }
  });

export const getWhatsAppQrCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    try {
      const { getWhatsAppQrDataUrl } = await import("@/lib/whatsapp.server");
      const qrCode = await getWhatsAppQrDataUrl();
      return qrCode
        ? { ok: true as const, qrCode }
        : { ok: false as const, error: "O QR Code ainda não está disponível." };
    } catch (error) {
      return { ok: false as const, error: message(error) };
    }
  });

export const sendWhatsAppTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        phone: z.string().trim().min(10).max(40),
        message: z.string().trim().min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    try {
      const { sendWhatsAppTestMessage } = await import("@/lib/whatsapp.server");
      await sendWhatsAppTestMessage(data.phone, data.message);
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: message(error) };
    }
  });
