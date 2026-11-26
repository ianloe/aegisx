import { AlertChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateSafeOutboundUrl } from "@/lib/security/url-guard";

export interface DispatchAlertInput {
  eventType: string;
  title: string;
  message: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  entityType?: string;
  entityId?: string;
}

export async function dispatchAlert(
  client: Prisma.TransactionClient | typeof prisma,
  input: DispatchAlertInput,
) {
  const rule = await client.alertRule.findUnique({ where: { eventType: input.eventType } });
  if (rule && !rule.isEnabled) {
    return null;
  }

  const channel: AlertChannel = rule?.channel ?? "IN_APP";
  let delivered = true;

  if (channel === "WEBHOOK" && rule?.webhookUrl) {
    const check = await validateSafeOutboundUrl(rule.webhookUrl, {
      allowPrivateNetwork: process.env.ALLOW_LOCAL_WEBHOOKS === "true",
    });
    if (!check.valid) {
      delivered = false;
    } else {
      try {
        const res = await fetch(rule.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            text: `[Aegis ${input.severity ?? "INFO"}] ${input.title}: ${input.message}`,
            title: input.title,
            message: input.message,
            severity: input.severity ?? "INFO",
            eventType: input.eventType,
            entityType: input.entityType,
            entityId: input.entityId,
            timestamp: new Date().toISOString(),
          }),
        });
        delivered = res.ok;
      } catch {
        delivered = false;
      }
    }
  } else if (channel === "TELEGRAM" && rule?.webhookUrl && rule?.telegramChatId) {
    try {
      const botToken = rule.webhookUrl.trim();
      const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          chat_id: rule.telegramChatId.trim(),
          text: `[Aegis ${input.severity ?? "INFO"}] ${input.title}\n\n${input.message}`,
        }),
      });
      delivered = res.ok;
    } catch {
      delivered = false;
    }
  }

  return client.alertDelivery.create({
    data: {
      eventType: input.eventType,
      title: input.title,
      message: input.message,
      severity: input.severity ?? "INFO",
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      channel,
      delivered,
    },
  });
}
