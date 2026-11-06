type Busy = { startsAt: string; endsAt: string };
export function computeBookingSlots(
  offering: any,
  startsAt: string,
  endsAt: string,
  busy: Busy[],
  now = Date.now(),
) {
  const windowStart = new Date(startsAt),
    windowEnd = new Date(endsAt);
  if (
    !Number.isFinite(+windowStart) ||
    !Number.isFinite(+windowEnd) ||
    windowEnd <= windowStart ||
    +windowEnd - +windowStart > 45 * 86400000
  )
    throw new Error("Período de consulta inválido.");
  const duration = Number(offering.duration_minutes);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Duração inválida.");
  const notice = now + Number(offering.booking_notice_hours ?? 24) * 3600000;
  const result: Busy[] = [];
  const cursor = new Date(
    Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), windowStart.getUTCDate()),
  );
  for (; cursor <= windowEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    for (const rule of offering.rules ?? []) {
      if (
        !rule.active ||
        Number(rule.weekday) !== cursor.getUTCDay() ||
        day < rule.valid_from ||
        (rule.valid_until && day > rule.valid_until)
      )
        continue;
      const step = Math.max(
        Number(rule.slot_interval_minutes) || duration,
        duration + Number(offering.buffer_minutes ?? 0),
      );
      const endDay = Date.parse(`${day}T${String(rule.end_time).slice(0, 5)}:00-03:00`);
      for (
        let start = Date.parse(`${day}T${String(rule.start_time).slice(0, 5)}:00-03:00`);
        start + duration * 60000 <= endDay;
        start += step * 60000
      ) {
        const end = start + duration * 60000;
        if (start < +windowStart || end > +windowEnd || start < notice) continue;
        // Inclui o intervalo de preparação depois do encontro na checagem de conflitos.
        const bufferedEnd = end + Number(offering.buffer_minutes ?? 0) * 60000;
        if (
          !busy.some(
            (item) => start < Date.parse(item.endsAt) && bufferedEnd > Date.parse(item.startsAt),
          )
        )
          result.push({
            startsAt: new Date(start).toISOString(),
            endsAt: new Date(end).toISOString(),
          });
      }
    }
  }
  return result;
}
