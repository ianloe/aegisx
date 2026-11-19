import { AlertChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    try {
      const res = await fetch(rule.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
