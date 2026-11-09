// @ts-nocheck
export function reminderDeadline(scheduledAt: string, offsetMinutes: number, now = Date.now()) {
  const starts = Date.parse(scheduledAt);
  const offset = Math.max(0, Number(offsetMinutes) || 0);
  const due = starts - offset * 60_000;
  const latest = offset === 0 ? starts + 5 * 60_000 : Math.min(starts, due + 30 * 60_000);
  return new Date(Math.min(now + 24 * 3_600_000, latest)).toISOString();
}
/** Revalida o evento de origem na fila; indisponibilidade do banco bloqueia o envio. */
export async function notificationInvalidReason(admin: any, row: any, now = Date.now()) {
  if (row.expires_at && Date.parse(row.expires_at) <= now) return "O prazo deste aviso encerrou.";
  if (row.automation_id) {
    const result = await admin
      .from("whatsapp_automations")
      .select("enabled, trigger, offset_minutes")
      .is("deleted_at", null)
      .eq("id", row.automation_id)
      .maybeSingle();
    if (result.error) throw new Error("Não foi possível conferir a automação.");
    if (!result.data?.enabled) return "Automação desligada ou removida.";
  } else if (row.event_type === "automation") return "Automação removida.";
  if (row.reference_type === "meeting" || row.reference_type === "booking") {
    const booking = row.reference_type === "booking";
    const result = await admin
      .from(booking ? "booking_reservations" : "meetings")
      .select(booking ? "starts_at, status" : "scheduled_at, audience, deleted_at")
      .eq("id", row.reference_id)
      .maybeSingle();
    if (result.error) throw new Error("Não foi possível conferir o encontro.");
    if (
      !result.data ||
      (!booking && result.data.deleted_at) ||
      (booking && result.data.status !== "confirmed")
    )
      return "Encontro cancelado ou removido.";
    const date = booking ? result.data.starts_at : result.data.scheduled_at;
    if (row.source_scheduled_at && Date.parse(date) !== Date.parse(row.source_scheduled_at))
      return "O encontro foi remarcado.";
    if (row.chat_id && result.data.audience !== "all")
      return "Encontro restrito não pode ser enviado ao grupo geral.";
    // Avisos na hora têm até cinco minutos de tolerância; lembretes expiram antes do início.
    const tolerance = row.expires_at ? 0 : 5 * 60_000;
    if (!row.expires_at && Date.parse(date) + tolerance < now)
      return "O horário deste encontro já passou.";
  }
  return null;
}
