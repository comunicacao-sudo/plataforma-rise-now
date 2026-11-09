// @ts-nocheck
/**
 * Cliente do gateway de WhatsApp Pamaris (zap.pamaris.com.br).
 *
 * Contrato:
 *   GET  /api/sessions/{id}                     -> { status, phone, pushName, lastError, ... }
 *   POST /api/sessions/{id}/start
 *   GET  /api/sessions/{id}/qr                  -> { qrCode: "data:image/png;base64,..." }
 *   POST /api/sessions/{id}/messages/send-text  { chatId, text }
 * A chave vai sempre no cabeçalho X-API-Key, nunca na URL.
 *
 * Credenciais vivem apenas nos secrets das Edge Functions:
 *   WHATSAPP_GATEWAY_URL, WHATSAPP_GATEWAY_API_KEY, WHATSAPP_GATEWAY_SESSION_ID
 */

import { authorizedWhatsAppPhone } from "./whatsapp-consent.ts";
import { notificationInvalidReason, reminderDeadline } from "./notification-validity.ts";
import {
  isWithinWindow,
  nextWindowOpening,
  sendWindowFromSettings,
  type SendWindow,
} from "./send-window.ts";

export const WHATSAPP_ENGINE = "pamaris_gateway";

/** Pausa entre mensagens consecutivas para reduzir risco de bloqueio do número. */
export const WHATSAPP_SEND_INTERVAL_MS = 3_500;

/** Notificações pendentes mais antigas que isso deixam de ser reenviadas. */
export const WHATSAPP_PENDING_MAX_AGE_MS = 24 * 3_600_000;

const env = (name: string) => Deno.env.get(name)?.trim() || null;

export function gatewayConfig() {
  return {
    baseUrl: env("WHATSAPP_GATEWAY_URL")?.replace(/\/+$/, "") ?? null,
    apiKey: env("WHATSAPP_GATEWAY_API_KEY"),
    sessionId: env("WHATSAPP_GATEWAY_SESSION_ID"),
    appBase: env("APP_BASE_URL") ?? "https://board.mentoriarisenow.com.br",
  };
}

export function gatewayConfigured() {
  const cfg = gatewayConfig();
  return !!cfg.baseUrl && !!cfg.apiKey && !!cfg.sessionId;
}

const httpErrors: Record<number, string> = {
  401: "Chave do gateway de WhatsApp inválida.",
  403: "A chave do gateway não tem permissão para esta operação.",
  404: "Sessão de WhatsApp não encontrada no gateway.",
  429: "Limite de envios do gateway atingido. Tente novamente em instantes.",
};

async function gateway(path: string, init: RequestInit = {}) {
  const cfg = gatewayConfig();
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.sessionId)
    throw new Error("Gateway de WhatsApp ainda não configurado.");
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", cfg.apiKey);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(
    `${cfg.baseUrl}/api/sessions/${encodeURIComponent(cfg.sessionId)}${path}`,
    { ...init, headers, signal: init.signal ?? AbortSignal.timeout(20_000) },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body?.error === "string" ? body.error : body?.message;
    throw Object.assign(
      new Error(
        httpErrors[response.status] ??
          `Gateway de WhatsApp respondeu ${response.status}${detail ? `: ${detail}` : "."}`,
      ),
      { gatewayStatus: response.status },
    );
  }
  return body;
}

export type GatewaySession = {
  status: string;
  phone: string | null;
  name: string | null;
  lastError: string | null;
};

export async function getGatewaySession(): Promise<GatewaySession> {
  const body = await gateway("");
  return {
    status: String(body?.status ?? "unknown").toLowerCase(),
    phone: body?.phone ?? null,
    name: body?.pushName ?? null,
    lastError: body?.lastError ?? null,
  };
}

export async function isGatewayReady() {
  if (!gatewayConfigured()) return false;
  try {
    return (await getGatewaySession()).status === "ready";
  } catch {
    return false;
  }
}

export async function startGatewaySession() {
  await gateway("/start", { method: "POST" });
}

export async function getGatewayQrCode(): Promise<string | null> {
  const body = await gateway("/qr");
  return typeof body?.qrCode === "string" && body.qrCode.startsWith("data:image/")
    ? body.qrCode
    : null;
}

/** Converte telefone brasileiro em chatId (só dígitos + @c.us). Retorna null se inválido. */
export function toChatId(raw: string | null | undefined) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55[1-9]\d[2-9]\d{7,8}$/.test(digits)) return null;
  return { digits, chatId: `${digits}@c.us` };
}

export async function sendGatewayText(chatId: string, text: string) {
  const body = await gateway("/messages/send-text", {
    method: "POST",
    body: JSON.stringify({ chatId, text }),
  });
  return (body?.id ?? body?.messageId ?? body?.key?.id ?? body?.message?.id ?? null) as
    string | null;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Envia uma linha de whatsapp_notifications já registrada como "pending".
 * Reserva a linha mudando seu estado. Resultado incerto não é reenviado automaticamente.
 */
/**
 * Confere se a linha ainda pode sair agora (estado, horário guardado, validade do evento
 * e autorização do número). Retorna a linha atualizada, ou null se não deve ser enviada.
 */
async function checkDeliverable(admin: any, row: any) {
  const current = await admin.from("whatsapp_notifications").select("*").eq("id", row.id).single();
  if (current.error) throw new Error("Não foi possível carregar o aviso.");
  row = { ...row, ...current.data };
  if (row.status && row.status !== "pending") return null;
  // Aviso guardado para o próximo horário comercial: ainda não é hora.
  if (row.send_after && Date.parse(row.send_after) > Date.now()) return null;
  const invalid = await notificationInvalidReason(admin, row);
  if (invalid) {
    const result = await admin
      .from("whatsapp_notifications")
      .update({ status: "failed", error_message: invalid })
      .eq("id", row.id)
      .eq("status", "pending");
    if (result.error) throw new Error(result.error.message);
    return null;
  }
  if (!isGroupChatId(row.chat_id)) {
    // Consulta novamente antes de cada envio: revogações também bloqueiam a fila antiga.
    const phone = toChatId(row.phone)?.digits ?? null;
    if (!(await authorizedWhatsAppPhone(admin, row.recipient_user_id, phone))) {
      await admin
        .from("whatsapp_notifications")
        .update({
          status: "failed",
          error_message: "Envio bloqueado: WhatsApp sem autorização para este número.",
        })
        .eq("id", row.id)
        .eq("status", "pending");
      return null;
    }
  }
  return row;
}

/**
 * Envia vários avisos da mesma pessoa em UMA mensagem de resumo (usa digest_line).
 * Evita que a mentora receba uma sequência de mensagens na abertura do horário comercial.
 */
export async function deliverDigest(admin: any, rows: any[]) {
  const ready = [];
  for (const row of rows) {
    const checked = await checkDeliverable(admin, row);
    if (checked?.digest_line) ready.push(checked);
  }
  if (ready.length < 2) {
    const outcomes = [];
    for (const row of ready) outcomes.push(await deliverNotification(admin, row));
    return outcomes.includes("sent") ? ("sent" as const) : ("skipped" as const);
  }
  const claimed = [];
  for (const row of ready) {
    const result = await admin
      .from("whatsapp_notifications")
      .update({ status: "processing", error_message: "Enviando resumo…" })
      .eq("id", row.id)
      .eq("status", "pending")
      .eq("updated_at", row.updated_at)
      .select("id")
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (result.data) claimed.push(row);
  }
  if (!claimed.length) return "skipped" as const;
  const chatId = toChatId(claimed[0].phone)?.chatId;
  const ids = claimed.map((row) => row.id);
  if (!chatId) {
    await admin
      .from("whatsapp_notifications")
      .update({ status: "failed", error_message: "Telefone inválido." })
      .in("id", ids)
      .eq("status", "processing");
    return "failed" as const;
  }
  const { data: person } = await admin
    .from("profiles")
    .select("display_name, full_name")
    .eq("id", claimed[0].recipient_user_id)
    .maybeSingle();
  const firstName = String(person?.display_name || person?.full_name || "")
    .trim()
    .split(/\s+/)[0];
  const appBase = gatewayConfig().appBase;
  const message = [
    "📬 *RISE NOW | RESUMO DE ATUALIZAÇÕES*",
    "",
    firstName ? `Olá, ${firstName}! Desde o último aviso:` : "Olá! Desde o último aviso:",
    "",
    ...claimed.map((row) => `• ${row.digest_line}`),
    "",
    "Acompanhe tudo na plataforma:",
    appBase,
  ].join("\n");
  try {
    const providerId = await sendGatewayText(chatId, message);
    const saved = await admin
      .from("whatsapp_notifications")
      .update({
        status: "sent",
        provider_message_id: providerId,
        sent_at: new Date().toISOString(),
        error_message: `Enviado em resumo com ${claimed.length} avisos.`,
      })
      .in("id", ids)
      .eq("status", "processing");
    if (saved.error)
      throw new Error(
        "Resumo possivelmente enviado, mas não foi possível registrar a confirmação. Confira antes de reenviar.",
      );
    return "sent" as const;
  } catch (error) {
    const retryable = error?.gatewayStatus === 429;
    await admin
      .from("whatsapp_notifications")
      .update({
        status: retryable ? "pending" : "failed",
        error_message: retryable
          ? error.message
          : `Resumo sem confirmação; confira o WhatsApp antes de reenviar. ${error instanceof Error ? error.message : "Falha no envio."}`,
      })
      .in("id", ids)
      .eq("status", "processing");
    return "failed" as const;
  }
}

export async function deliverNotification(admin: any, row: any) {
  const checked = await checkDeliverable(admin, row);
  if (!checked) return "skipped" as const;
  row = checked;
  const claimed = await admin
    .from("whatsapp_notifications")
    .update({ status: "processing", error_message: "Enviando…" })
    .eq("id", row.id)
    .eq("status", "pending")
    .eq("updated_at", row.updated_at)
    .select("id")
    .maybeSingle();
  if (claimed.error) throw new Error(claimed.error.message);
  if (!claimed.data) return "skipped" as const;

  // Grupos guardam o chatId (…@g.us); pessoas, o telefone.
  const chatId = isGroupChatId(row.chat_id) ? row.chat_id : toChatId(row.phone)?.chatId;
  if (!chatId) {
    const saved = await admin
      .from("whatsapp_notifications")
      .update({ status: "failed", error_message: "Telefone inválido." })
      .eq("id", row.id)
      .eq("status", "processing");
    if (saved.error) throw new Error(saved.error.message);
    return "failed" as const;
  }
  try {
    const providerId = await sendGatewayText(chatId, row.message);
    const saved = await admin
      .from("whatsapp_notifications")
      .update({
        status: "sent",
        provider_message_id: providerId,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", row.id)
      .eq("status", "processing");
    if (saved.error)
      throw new Error(
        "Envio possivelmente concluído, mas não foi possível registrar a confirmação. Confira antes de reenviar.",
      );
    return "sent" as const;
  } catch (error) {
    // 429 confirma rejeição por limite. Timeout/perda de resposta podem ter enviado:
    // nesses casos exige conferência, sem duplicação automática.
    const retryable = error?.gatewayStatus === 429;
    const saved = await admin
      .from("whatsapp_notifications")
      .update({
        status: retryable ? "pending" : "failed",
        error_message: retryable
          ? error.message
          : `Envio sem confirmação; confira o WhatsApp antes de reenviar. ${error instanceof Error ? error.message : "Falha no envio."}`,
      })
      .eq("id", row.id)
      .eq("status", "processing");
    if (saved.error) throw new Error(saved.error.message);
    return "failed" as const;
  }
}

export const isGroupChatId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9-]+@g\.us$/.test(value);

export async function listGatewayGroups(): Promise<Array<{ id: string; name: string }>> {
  const body = await gateway("/groups");
  const list = Array.isArray(body) ? body : (body?.groups ?? body?.data ?? []);
  return list
    .map((group: any) => ({
      id: String(group?.id?._serialized ?? group?.id ?? ""),
      name: String(group?.name ?? group?.subject ?? "Grupo sem nome"),
    }))
    .filter((group: { id: string }) => isGroupChatId(group.id));
}

export type NotificationInput = {
  eventType: string;
  recipientId: string | null;
  recipientRole: "mentee" | "mentor" | "admin" | "group";
  phone: string | null | undefined;
  /** Para envio em grupo: o chatId do grupo (…@g.us). */
  groupChatId?: string | null;
  automationId?: string | null;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  message: string;
  targetUrl: string;
  /** Lembrete com hora marcada: fora do horário comercial não é enviado (nem guardado). */
  timeSensitive?: boolean;
  /** Prazo explícito do aviso (substitui o prazo calculado pela antecedência). */
  expiresAt?: string | null;
  /** Linha curta para quando vários avisos da mesma pessoa saem juntos em um resumo. */
  digestLine?: string | null;
  /** Janela de envio já carregada (evita reconsultar as configurações). */
  sendWindow?: SendWindow;
};

/**
 * Registra a notificação como pendente (idempotente). Retorna a linha criada,
 * ou null se o telefone for inválido ou já houver registro com a mesma chave.
 */
export async function enqueueNotification(admin: any, input: NotificationInput) {
  const group = isGroupChatId(input.groupChatId) ? input.groupChatId : null;
  const target = group ? null : toChatId(input.phone);
  if (!group && !target) return null;
  if (!group && !(await authorizedWhatsAppPhone(admin, input.recipientId, target!.digits)))
    return null;
  let sourceScheduledAt: string | null = null;
  let expiresAt = new Date(Date.now() + WHATSAPP_PENDING_MAX_AGE_MS).toISOString();
  if (["booking", "meeting"].includes(input.referenceType)) {
    const booking = input.referenceType === "booking";
    const source = await admin
      .from(booking ? "booking_reservations" : "meetings")
      .select(booking ? "starts_at, status" : "scheduled_at, audience, deleted_at")
      .eq("id", input.referenceId)
      .maybeSingle();
    if (source.error) throw new Error(source.error.message);
    if (
      !source.data ||
      (!booking && source.data.deleted_at) ||
      (booking && source.data.status !== "confirmed")
    )
      return null;
    if (group && source.data.audience !== "all") return null;
    sourceScheduledAt = booking ? source.data.starts_at : source.data.scheduled_at;
    let deadline = Date.parse(sourceScheduledAt);
    if (input.automationId) {
      const automation = await admin
        .from("whatsapp_automations")
        .select("trigger, offset_minutes")
        .is("deleted_at", null)
        .eq("id", input.automationId)
        .single();
      if (automation.error) throw new Error(automation.error.message);
      if (["group_meeting_before", "booking_before"].includes(automation.data.trigger))
        deadline = input.expiresAt
          ? Math.min(deadline + 5 * 60_000, Date.parse(input.expiresAt))
          : Date.parse(reminderDeadline(sourceScheduledAt, automation.data.offset_minutes));
    } else if (["meeting_reminder", "meeting_reminder_mentor"].includes(input.eventType))
      deadline = Math.min(deadline, Date.now() + 30 * 60_000);
    expiresAt = new Date(Math.min(Date.parse(expiresAt), deadline)).toISOString();
    if (Date.parse(expiresAt) <= Date.now()) return null;
  }

  // Horário comercial (público CLT): fora da janela, o aviso espera a próxima abertura;
  // lembretes com hora marcada simplesmente não saem, para não chegarem fora de hora.
  const now = new Date();
  const window = input.sendWindow ?? sendWindowFromSettings(await whatsappSettings(admin));
  let sendAfter: string | null = null;
  if (!isWithinWindow(now, window)) {
    if (input.timeSensitive) return null;
    const opening = nextWindowOpening(now, window);
    sendAfter = opening.toISOString();
    const heldDeadline = opening.getTime() + WHATSAPP_PENDING_MAX_AGE_MS;
    if (sourceScheduledAt) {
      // Aviso ligado a um encontro: se a abertura for depois do prazo, não vale guardar.
      if (opening.getTime() >= Date.parse(expiresAt)) return null;
    } else {
      expiresAt = new Date(Math.max(Date.parse(expiresAt), heldDeadline)).toISOString();
    }
  }

  const { data, error } = await admin
    .from("whatsapp_notifications")
    .upsert(
      {
        event_type: input.eventType,
        recipient_user_id: input.recipientId,
        recipient_role: input.recipientRole,
        phone: target?.digits ?? null,
        chat_id: group,
        automation_id: input.automationId ?? null,
        message: input.message,
        target_url: input.targetUrl,
        reference_type: input.referenceType,
        reference_id: input.referenceId,
        idempotency_key: input.idempotencyKey,
        status: "pending",
        source_scheduled_at: sourceScheduledAt,
        expires_at: expiresAt,
        send_after: sendAfter,
        digest_line: input.digestLine ? String(input.digestLine).slice(0, 300) : null,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    )
    .select("id, phone, chat_id, message, updated_at, send_after")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function whatsappSettings(admin: any) {
  const { data } = await admin
    .from("whatsapp_settings")
    .select("*")
    .eq("id", "primary")
    .maybeSingle();
  return data;
}
