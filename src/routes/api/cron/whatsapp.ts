import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/cron/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = await authenticateCronRequest(request);
        if (authError) return authError;
        try {
          const { processMeetingReminders, processScheduledStageReleases } =
            await import("@/lib/whatsapp.server");
          const [meetingReminders, stageReleases] = await Promise.all([
            processMeetingReminders(),
            processScheduledStageReleases(),
          ]);
          return Response.json({ ok: true, meetingReminders, stageReleases });
        } catch (error) {
          console.error("[WhatsApp cron]", error);
          return Response.json(
            { ok: false, error: "Falha ao processar lembretes." },
            { status: 500 },
          );
        }
      },
    },
  },
});
