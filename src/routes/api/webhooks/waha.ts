import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/waha")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const whatsapp = await import("@/lib/whatsapp.server");
        if (!whatsapp.verifyWahaWebhookSignature(rawBody, request.headers.get("x-webhook-hmac"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const payload = JSON.parse(rawBody) as {
            event?: string;
            session?: string;
            payload?: { id?: string; ack?: number; ackName?: string };
          };
          await whatsapp.applyWahaAcknowledgement(payload);
          return Response.json({ ok: true });
        } catch (error) {
          console.error("[WAHA webhook]", error);
          return Response.json({ ok: false, error: "Invalid webhook payload" }, { status: 400 });
        }
      },
    },
  },
});
