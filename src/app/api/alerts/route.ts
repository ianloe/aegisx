import { NextResponse } from "next/server";
import { z } from "zod";
import { AlertChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { dispatchAlert } from "@/lib/governance/alerts";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const [rules, deliveries, unreadCount] = await Promise.all([
    prisma.alertRule.findMany({ orderBy: { eventType: "asc" } }),
    prisma.alertDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.alertDelivery.count({ where: { isRead: false } }),
  ]);

  return NextResponse.json({ rules, deliveries, unreadCount });
}

const patchAlertSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE_RULE"),
    id: z.string().min(1),
    isEnabled: z.boolean(),
    channel: z.nativeEnum(AlertChannel),
    webhookUrl: z.string().nullable().optional(),
    telegramChatId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("MARK_READ"),
    deliveryId: z.string().optional(),
    markAllRead: z.boolean().optional(),
  }),
]);

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = patchAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert update payload." }, { status: 400 });
  }

  if (parsed.data.action === "MARK_READ") {
    const auth = await requireApiSession("assets:read");
    if (auth.error) return auth.error;

    if (parsed.data.markAllRead) {
      await prisma.alertDelivery.updateMany({ where: { isRead: false }, data: { isRead: true } });
    } else if (parsed.data.deliveryId) {
      await prisma.alertDelivery.update({ where: { id: parsed.data.deliveryId }, data: { isRead: true } });
    }
    return NextResponse.json({ ok: true });
  }

  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const ruleData = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.alertRule.findUnique({ where: { id: ruleData.id } });
    if (!before) return null;
    const rule = await tx.alertRule.update({
      where: { id: ruleData.id },
      data: {
        isEnabled: ruleData.isEnabled,
        channel: ruleData.channel,
        webhookUrl: ruleData.webhookUrl || null,
        telegramChatId: ruleData.telegramChatId || null,
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPDATE_ALERT_RULE",
      entityType: "ALERT_RULE",
      entityId: rule.id,
      beforeState: before,
      afterState: rule,
    });
    return rule;
  });

  if (!updated) {
    return NextResponse.json({ error: "Alert rule not found." }, { status: 404 });
  }
  return NextResponse.json({ rule: updated });
}

export async function POST() {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const now = new Date();
  const [overdueActions, overdueAppraisals, openRisks, appetiteCfg] = await Promise.all([
    prisma.action.count({ where: { status: { not: "DONE" }, dueDate: { lt: now } } }),
    prisma.aaefAppraisal.count({ where: { dueDate: { lt: now }, status: { not: "COMPLETED" } } }),
    prisma.risk.findMany({ where: { status: { not: "CLOSED" } } }),
    prisma.governanceConfig.findUnique({ where: { key: "RISK_APPETITE" } }),
  ]);

  const maxAcceptable = Number(
    (appetiteCfg?.valueJson as Record<string, unknown> | undefined)?.maxAcceptableResidualScore ?? 12,
  );
  const appetiteBreaches = openRisks.filter((r) => r.residualLikelihood * r.residualImpact > maxAcceptable).length;

  const delivery = await dispatchAlert(prisma, {
    eventType: "ACTION_OVERDUE",
    title: "Aegis Governance Digest",
    message: `Portfolio scan: ${appetiteBreaches} risk appetite breach(es), ${overdueActions} overdue action(s), ${overdueAppraisals} overdue AAEF appraisal(s).`,
    severity: appetiteBreaches > 0 || overdueActions > 0 ? "WARNING" : "INFO",
    entityType: "PORTFOLIO",
    entityId: "DIGEST",
  });

  return NextResponse.json({
    digest: { appetiteBreaches, overdueActions, overdueAppraisals },
    delivery,
  });
}
