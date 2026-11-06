// @ts-nocheck
import { googleCalendarClient } from "./google-calendar.ts";

/** Outbox durável: nunca perde o evento Google ao remover um encontro do banco. */
export async function reconcileGoogleCancellations(
  admin: any,
  send = googleCalendarClient(admin).googleFetch,
) {
  const { data, error } = await admin
    .from("google_event_cancellations")
    .select("*")
    .is("completed_at", null)
    .order("created_at")
    .limit(20);
  if (error) throw new Error(error.message);
  let complete = true;
  for (const job of data ?? []) {
    try {
      const response = await send(
        job.google_user_id,
        `/calendar/v3/calendars/primary/events/${encodeURIComponent(job.google_event_id)}?sendUpdates=all`,
        { method: "DELETE", signal: AbortSignal.timeout(20_000) },
      );
      if (!response.ok && ![404, 410].includes(response.status))
        throw new Error(`Google: ${response.status}`);
      const saved = await admin
        .from("google_event_cancellations")
        .update({ completed_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
      if (saved.error) throw saved.error;
    } catch (error) {
      complete = false;
      const saved = await admin
        .from("google_event_cancellations")
        .update({ last_error: error instanceof Error ? error.message : "Falha no Google." })
        .eq("id", job.id);
      if (saved.error) console.error("google_cancellation_record_failed", job.id);
    }
  }
  return complete;
}
