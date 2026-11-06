import assert from "node:assert/strict";
import test from "node:test";
import {
  deliverNotification,
  enqueueNotification,
} from "../../supabase/functions/_shared/whatsapp-gateway.ts";
import { checkedDb } from "../../supabase/functions/_shared/checked-db.ts";
import {
  notificationInvalidReason,
  reminderDeadline,
} from "../../supabase/functions/_shared/notification-validity.ts";
import { runAutomations } from "../../supabase/functions/rise-cron/automations.ts";
import { computeBookingSlots } from "../../supabase/functions/_shared/booking-slots.ts";
import { queueNoteSave } from "./note-save-queue";
import { reconcileGoogleCancellations } from "../../supabase/functions/_shared/google-cancellations.ts";

function memoryDb(initial: Record<string, unknown>) {
  let row = { ...initial };
  const db = {
    from() {
      let patch: Record<string, unknown> | undefined;
      const conditions: Record<string, unknown> = {};
      const execute = () => {
        if (Object.entries(conditions).some(([key, value]) => row[key] !== value))
          return { data: null, error: null };
        if (patch) row = { ...row, ...patch, updated_at: String(Number(row["updated_at"]) + 1) };
        return { data: { ...row }, error: null };
      };
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          conditions[key] = value;
          return chain;
        },
        update: (value: Record<string, unknown>) => {
          patch = value;
          return chain;
        },
        single: async () => execute(),
        maybeSingle: async () => execute(),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return chain;
    },
  };
  return { db, snapshot: () => ({ ...row }) };
}

test("aviso já registrado é ignorado sem interromper a automação com banco verificado", async () => {
  const rows = new Map<string, Record<string, unknown>>();
  const raw = {
    from() {
      let row: Record<string, unknown> = {};
      let ignore = false;
      const chain = {
        upsert(
          value: Record<string, unknown>,
          options: { onConflict: string; ignoreDuplicates: boolean },
        ) {
          row = value;
          ignore = options.ignoreDuplicates && options.onConflict === "idempotency_key";
          return chain;
        },
        select: () => chain,
        maybeSingle: async () => {
          const key = String(row["idempotency_key"]);
          if (rows.has(key))
            return ignore
              ? { data: null, error: null }
              : { data: null, error: { code: "23505", message: "Duplicado" } };
          rows.set(key, row);
          return { data: { ...row, id: "aviso" }, error: null };
        },
      };
      return chain;
    },
  };
  const db = checkedDb(raw);
  const input = {
    eventType: "automation",
    recipientId: null,
    recipientRole: "group" as const,
    phone: null,
    groupChatId: "123@g.us",
    referenceType: "weekly",
    referenceId: "semana",
    idempotencyKey: "cronograma-semanal",
    message: "Cronograma original",
    targetUrl: "https://example.invalid",
  };
  assert.ok(await enqueueNotification(db, input));
  assert.equal(await enqueueNotification(db, { ...input, message: "Tentativa repetida" }), null);
  assert.equal(rows.size, 1);
  assert.equal(rows.get(input.idempotencyKey)?.["message"], "Cronograma original");
});

test("execuções concorrentes reservam uma notificação uma única vez", async () => {
  const original = globalThis.fetch;
  Object.assign(globalThis, { Deno: { env: { get: () => "teste-local" } } });
  let calls = 0;
  let release = () => {};
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async () => {
    calls++;
    await barrier;
    return Response.json({ id: "simulado" });
  };
  const { db, snapshot } = memoryDb({
    id: "aviso",
    status: "pending",
    updated_at: "0",
    chat_id: "123@g.us",
    message: "Teste sem rede",
  });
  try {
    const first = deliverNotification(db, snapshot());
    for (let i = 0; i < 20 && calls === 0; i++)
      await new Promise((resolve) => setTimeout(resolve, 0));
    const second = deliverNotification(db, snapshot());
    release();
    const results = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.deepEqual(results.sort(), ["sent", "skipped"]);
    assert.equal(snapshot()["status"], "sent");
  } finally {
    release();
    globalThis.fetch = original;
  }
});

test("resposta incerta do gateway não resulta em repetição automática", async () => {
  const original = globalThis.fetch;
  Object.assign(globalThis, { Deno: { env: { get: () => "teste-local" } } });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Resposta perdida");
  };
  const { db, snapshot } = memoryDb({
    id: "aviso",
    status: "pending",
    updated_at: "0",
    chat_id: "123@g.us",
    message: "Teste",
  });
  try {
    assert.equal(await deliverNotification(db, snapshot()), "failed");
    assert.equal(await deliverNotification(db, snapshot()), "skipped");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("erro de consulta preserva o cursor da automação", async () => {
  let cursorAdvanced = false;
  const db = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gt: () => chain,
        update: () => {
          cursorAdvanced = true;
          return chain;
        },
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            table === "whatsapp_automations"
              ? {
                  data: [
                    {
                      id: "a",
                      trigger: "goal_created",
                      name: "Simulada",
                      enabled_at: "2026-11-05T10:00:00Z",
                      last_run_at: "2026-11-05T10:05:00Z",
                    },
                  ],
                  error: null,
                }
              : { data: null, error: { message: "Falha simulada do banco" } },
          ).then(resolve),
      };
      return chain;
    },
  };
  await assert.rejects(
    runAutomations(db, {}, new Date("2026-11-05T10:10:00Z")),
    /cursores preservados/,
  );
  assert.equal(cursorAdvanced, false);
});

function sourceDb(data: unknown, error: unknown = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data, error }),
  };
  return { from: () => chain };
}
test("fila bloqueia cancelamento, remarcação, expiração e encontro restrito no grupo", async () => {
  const now = Date.parse("2026-11-05T18:00:00Z");
  const base = { reference_type: "booking", reference_id: "r" };
  assert.match(
    (await notificationInvalidReason(sourceDb({ status: "cancelled" }), base, now))!,
    /cancelado/,
  );
  assert.match(
    (await notificationInvalidReason(
      sourceDb({ status: "confirmed", starts_at: "2026-11-06T18:00:00Z" }),
      { ...base, source_scheduled_at: "2026-11-05T19:00:00Z" },
      now,
    ))!,
    /remarcado/,
  );
  assert.match(
    (await notificationInvalidReason(sourceDb(null), { expires_at: "2026-11-05T17:00:00Z" }, now))!,
    /prazo/,
  );
  assert.match(
    (await notificationInvalidReason(
      sourceDb({ audience: "cohort", scheduled_at: "2026-11-05T19:00:00Z" }),
      { reference_type: "meeting", reference_id: "m", chat_id: "123@g.us" },
      now,
    ))!,
    /restrito/,
  );
  await assert.rejects(
    notificationInvalidReason(sourceDb(null, { message: "offline" }), base, now),
    /conferir/,
  );
});
test("link na hora respeita a tolerância definida, sem invalidar antes do vencimento", async () => {
  const row = {
    reference_type: "meeting",
    reference_id: "m",
    expires_at: "2026-11-05T18:05:00Z",
    source_scheduled_at: "2026-11-05T18:00:00Z",
  };
  assert.equal(
    await notificationInvalidReason(
      sourceDb({ audience: "all", scheduled_at: row.source_scheduled_at }),
      row,
      Date.parse("2026-11-05T18:02:00Z"),
    ),
    null,
  );
});

test("horários respeitam validade, antecedência, reservas e intervalo de preparação", () => {
  const offering = {
    duration_minutes: 60,
    buffer_minutes: 15,
    booking_notice_hours: 0,
    rules: [
      {
        active: true,
        weekday: 4,
        start_time: "09:00",
        end_time: "12:00",
        valid_from: "2026-11-01",
        valid_until: "2026-11-30",
        slot_interval_minutes: 60,
      },
    ],
  };
  const start = "2026-11-05T03:00:00Z",
    end = "2026-11-06T03:00:00Z";
  const slots = computeBookingSlots(offering, start, end, [], Date.parse(start));
  assert.equal(slots.length, 2);
  assert.equal(
    computeBookingSlots(
      offering,
      start,
      end,
      [{ startsAt: "2026-11-05T12:50:00Z", endsAt: "2026-11-05T16:00:00Z" }],
      Date.parse(start),
    ).length,
    0,
  );
  assert.equal(
    computeBookingSlots(
      { ...offering, booking_notice_hours: 48 },
      start,
      end,
      [],
      Date.parse(start),
    ).length,
    0,
  );
  assert.equal(
    computeBookingSlots(
      { ...offering, rules: [{ ...offering.rules[0], active: false }] },
      start,
      end,
      [],
      Date.parse(start),
    ).length,
    0,
  );
});

test("troca rápida de tela mantém a ordem de gravação e recupera a fila após erro", async () => {
  const order: string[] = [];
  let release = () => {};
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = queueNoteSave("caderno-teste", async () => {
    await barrier;
    order.push("primeira");
    throw new Error("offline");
  });
  const second = queueNoteSave("caderno-teste", async () => {
    order.push("segunda");
  });
  release();
  await assert.rejects(first, /offline/);
  await second;
  assert.deepEqual(order, ["primeira", "segunda"]);
});

test("cancelamento no Google fica recuperável após falha e conclui na tentativa seguinte", async () => {
  const job = {
    id: "job",
    google_user_id: "mentora",
    google_event_id: "evento",
    completed_at: null as string | null,
    last_error: null as string | null,
  };
  const db = {
    from() {
      let patch: Partial<typeof job> | null = null;
      const chain = {
        select: () => chain,
        is: () => chain,
        order: () => chain,
        eq: () => chain,
        limit: () => chain,
        update: (value: Partial<typeof job>) => {
          patch = value;
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) => {
          if (patch) Object.assign(job, patch);
          return Promise.resolve({ data: [job], error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
  assert.equal(
    await reconcileGoogleCancellations(db, async () => new Response(null, { status: 503 })),
    false,
  );
  assert.equal(job.completed_at, null);
  assert.match(job.last_error!, /503/);
  assert.equal(
    await reconcileGoogleCancellations(db, async () => new Response(null, { status: 204 })),
    true,
  );
  assert.ok(job.completed_at);
  assert.equal(job.last_error, null);
});

test("automação desligada bloqueia avisos já enfileirados", async () => {
  assert.match(
    (await notificationInvalidReason(sourceDb({ enabled: false }), { automation_id: "auto" }))!,
    /desligada/,
  );
});

test("lembretes de um dia não saem horas atrasados e o link na hora tem tolerância curta", () => {
  const meeting = "2026-11-06T18:00:00Z";
  const now = Date.parse("2026-11-05T18:00:00Z");
  assert.equal(reminderDeadline(meeting, 1440, now), "2026-11-05T18:30:00.000Z");
  assert.equal(
    reminderDeadline(meeting, 120, Date.parse("2026-11-06T16:00:00Z")),
    "2026-11-06T16:30:00.000Z",
  );
  assert.equal(
    reminderDeadline(meeting, 15, Date.parse("2026-11-06T17:45:00Z")),
    "2026-11-06T18:00:00.000Z",
  );
  assert.equal(reminderDeadline(meeting, 0, Date.parse(meeting)), "2026-11-06T18:05:00.000Z");
});
