import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RuntimeGateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { dispatchAlert } from "@/lib/governance/alerts";
import { convertCurrency } from "@/lib/governance/budget-and-gate";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getCurrentQuarter(date = new Date()): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

async function isAuthorizedGet(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    const keyHash = hashToken(rawToken);
    const keyRecord = await prisma.telemetryApiKey.findUnique({ where: { keyHash } });
    if (keyRecord && keyRecord.isActive) {
      await prisma.telemetryApiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      });
      return true;
    }
    return false;
  }

  const session = await getSession();
  return Boolean(session && hasPermission(session.role, "assets:read"));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorizedGet(request))) {
    return NextResponse.json({ error: "Valid Bearer token or session required." }, { status: 401 });
  }

  const { id: code } = await context.params;
  const asset = await prisma.aIAsset.findFirst({
    where: { OR: [{ assetCode: code }, { id: code }] },
    include: {
      aaefAppraisals: {
        orderBy: { dueDate: "desc" },
        take: 1,
        include: { assignedProfile: { select: { code: true, name: true } } },
      },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: `Asset "${code}" not found.` }, { status: 404 });
  }

  const quarter = getCurrentQuarter();
  const costs = await prisma.costItem.findMany({
    where: { assetId: asset.id, quarter },
    select: { amount: true, currency: true },
  });
  const quarterlySpend = costs.reduce(
    (sum, c) => sum + convertCurrency(c.amount, c.currency, asset.quarterlyBudgetCurrency),
    0,
  );
  const budgetUtilizationPct =
    asset.quarterlyBudgetAmount && asset.quarterlyBudgetAmount > 0
      ? Number(((quarterlySpend / asset.quarterlyBudgetAmount) * 100).toFixed(1))
      : null;

  return NextResponse.json({
    assetCode: asset.assetCode,
    name: asset.name,
    gateStatus: asset.runtimeGateStatus,
    reason: asset.runtimeGateReason,
    lifecycleStage: asset.lifecycleStage,
    autonomyLevel: asset.autonomyLevel,
    latestAaefProfile: asset.aaefAppraisals[0]?.assignedProfile ?? null,
    quarter,
    quarterlyBudgetAmount: asset.quarterlyBudgetAmount,
    quarterlyBudgetCurrency: asset.quarterlyBudgetCurrency,
    quarterlySpend: Number(quarterlySpend.toFixed(2)),
    budgetUtilizationPct,
  });
}

const patchGateSchema = z.object({
  gateStatus: z.nativeEnum(RuntimeGateStatus),
  reason: z.string().min(2).max(500),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (
    !session ||
    (!hasPermission(session.role, "aaef:signoff") && !hasPermission(session.role, "admin:config"))
  ) {
    return NextResponse.json({ error: "Governance Office or Administrator access required." }, { status: 403 });
  }

  const { id: code } = await context.params;
  const body = await request.json();
  const parsed = patchGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid gate update payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.aIAsset.findFirst({
    where: { OR: [{ assetCode: code }, { id: code }] },
  });
  if (!existing) {
    return NextResponse.json({ error: `Asset "${code}" not found.` }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const asset = await tx.aIAsset.update({
      where: { id: existing.id },
      data: {
        runtimeGateStatus: parsed.data.gateStatus,
        runtimeGateReason: parsed.data.reason,
      },
    });

    await writeAuditLog(tx, {
      actorId: session.id,
      actorEmail: session.email,
      action: "RUNTIME_GATE_UPDATED",
      entityType: "AI_ASSET",
      entityId: asset.id,
      beforeState: { runtimeGateStatus: existing.runtimeGateStatus, runtimeGateReason: existing.runtimeGateReason },
      afterState: { runtimeGateStatus: asset.runtimeGateStatus, runtimeGateReason: asset.runtimeGateReason },
    });

    if (parsed.data.gateStatus !== RuntimeGateStatus.ALLOW) {
      await dispatchAlert(tx, {
        eventType: "AAEF_PROFILE_DOWNGRADE",
        title: `Runtime Gate ${parsed.data.gateStatus}: ${asset.assetCode}`,
        message: `Runtime circuit-breaker set to ${parsed.data.gateStatus} by ${session.name}. Reason: ${parsed.data.reason}`,
        severity: parsed.data.gateStatus === RuntimeGateStatus.SUSPENDED ? "CRITICAL" : "WARNING",
        entityType: "AI_ASSET",
        entityId: asset.id,
      });
    }

    return asset;
  });

  return NextResponse.json({
    assetCode: updated.assetCode,
    gateStatus: updated.runtimeGateStatus,
    reason: updated.runtimeGateReason,
  });
}
