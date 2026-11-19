import { NextResponse } from "next/server";
import { z } from "zod";
import { AutonomyLevel, LifecycleStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { evaluateStageGateReadiness } from "@/lib/governance/stage-gates";
import { dispatchAlert } from "@/lib/governance/alerts";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") || undefined;

  const requests = await prisma.stageGateRequest.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      asset: { select: { id: true, assetCode: true, name: true, lifecycleStage: true, autonomyLevel: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

const createGateSchema = z.object({
  assetId: z.string().min(1),
  targetLifecycleStage: z.nativeEnum(LifecycleStage),
  targetAutonomyLevel: z.nativeEnum(AutonomyLevel),
  justification: z.string().min(4),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("assets:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid stage-gate request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const [asset, riskAppetiteCfg, cadenceCfg] = await Promise.all([
    prisma.aIAsset.findUnique({
      where: { id: parsed.data.assetId },
      include: {
        authorityRules: true,
        frameAssessments: {
          include: { scores: { include: { criterion: true } } },
          orderBy: { assessedAt: "desc" },
          take: 1,
        },
        risks: { where: { status: { not: "CLOSED" } } },
        aaefAppraisals: {
          include: { assignedProfile: true },
          orderBy: { dueDate: "desc" },
          take: 1,
        },
        boundaryBreaches: { where: { status: { not: "CLOSED" } } },
      },
    }),
    prisma.governanceConfig.findUnique({ where: { key: "RISK_APPETITE" } }),
    prisma.governanceConfig.findUnique({ where: { key: "GOVERNANCE_CADENCE" } }),
  ]);

  if (!asset) {
    return NextResponse.json({ error: "AI asset not found." }, { status: 404 });
  }

  const maxAcceptable = Number(
    (riskAppetiteCfg?.valueJson as Record<string, unknown> | undefined)?.maxAcceptableResidualScore ?? 12,
  );
  const maxAgeDays = Number(
    (cadenceCfg?.valueJson as Record<string, unknown> | undefined)?.roleReviewMaxAgeDays ?? 180,
  );
  const rolesLapsed =
    !asset.rolesLastReviewedAt ||
    (Date.now() - asset.rolesLastReviewedAt.getTime()) / (1000 * 60 * 60 * 24) > maxAgeDays;

  const latestFrame = asset.frameAssessments[0];
  const latestFrameAvg =
    latestFrame && latestFrame.scores.length > 0
      ? Number(
          (
            latestFrame.scores.reduce((acc, s) => acc + s.score, 0) / latestFrame.scores.length
          ).toFixed(2),
        )
      : null;

  const highRiskBreachCount = asset.risks.filter(
    (r) => r.residualLikelihood * r.residualImpact > maxAcceptable,
  ).length;

  const readiness = evaluateStageGateReadiness({
    targetLifecycleStage: parsed.data.targetLifecycleStage,
    targetAutonomyLevel: parsed.data.targetAutonomyLevel,
    isAgent: asset.isAgent,
    hasOwner: Boolean(asset.ownerId),
    hasOverseer: Boolean(asset.overseerId),
    rolesLapsed,
    authorityRuleCount: asset.authorityRules.length,
    latestFrameAvg,
    highRiskBreachCount,
    latestAaefProfileCode: asset.aaefAppraisals[0]?.assignedProfile?.code ?? null,
    openBreachCount: asset.boundaryBreaches.length,
  });

  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.stageGateRequest.create({
      data: {
        assetId: asset.id,
        requestedById: auth.session.id,
        currentLifecycleStage: asset.lifecycleStage,
        targetLifecycleStage: parsed.data.targetLifecycleStage,
        currentAutonomyLevel: asset.autonomyLevel,
        targetAutonomyLevel: parsed.data.targetAutonomyLevel,
        readinessPassed: readiness.passed,
        readinessSnapshotJson: { checks: readiness.checks } as unknown as Prisma.InputJsonValue,
        justification: parsed.data.justification,
      },
      include: {
        asset: { select: { id: true, assetCode: true, name: true, lifecycleStage: true, autonomyLevel: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "REQUEST_STAGE_GATE",
      entityType: "STAGE_GATE_REQUEST",
      entityId: req.id,
      afterState: {
        assetCode: asset.assetCode,
        targetLifecycleStage: req.targetLifecycleStage,
        targetAutonomyLevel: req.targetAutonomyLevel,
        readinessPassed: req.readinessPassed,
      },
    });

    await dispatchAlert(tx, {
      eventType: "STAGE_GATE_PENDING",
      title: `Stage-Gate Request: ${asset.assetCode}`,
      message: `${asset.name} requested promotion to ${req.targetLifecycleStage} (${req.targetAutonomyLevel}). Readiness: ${req.readinessPassed ? "Passed" : "Gaps Detected"}.`,
      severity: req.readinessPassed ? "INFO" : "WARNING",
      entityType: "STAGE_GATE_REQUEST",
      entityId: req.id,
    });

    return req;
  });

  return NextResponse.json({ request: created, readiness }, { status: 201 });
}

const reviewGateSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionNotes: z.string().min(2),
});

export async function PATCH(request: Request) {
  const auth = await requireApiSession("aaef:signoff");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = reviewGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid stage-gate decision.", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.stageGateRequest.findUnique({
    where: { id: parsed.data.id },
    include: { asset: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Stage-gate request not found." }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "This stage-gate request has already been decided." }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const req = await tx.stageGateRequest.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.decision,
        decisionNotes: parsed.data.decisionNotes,
        reviewedById: auth.session.id,
        reviewedAt: new Date(),
      },
      include: {
        asset: { select: { id: true, assetCode: true, name: true, lifecycleStage: true, autonomyLevel: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (parsed.data.decision === "APPROVED") {
      await tx.aIAsset.update({
        where: { id: existing.assetId },
        data: {
          lifecycleStage: existing.targetLifecycleStage,
          autonomyLevel: existing.targetAutonomyLevel,
        },
      });
    }

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: parsed.data.decision === "APPROVED" ? "APPROVE_STAGE_GATE" : "REJECT_STAGE_GATE",
      entityType: "STAGE_GATE_REQUEST",
      entityId: req.id,
      beforeState: {
        status: existing.status,
        lifecycleStage: existing.asset.lifecycleStage,
        autonomyLevel: existing.asset.autonomyLevel,
      },
      afterState: {
        status: req.status,
        lifecycleStage: parsed.data.decision === "APPROVED" ? existing.targetLifecycleStage : existing.asset.lifecycleStage,
        autonomyLevel: parsed.data.decision === "APPROVED" ? existing.targetAutonomyLevel : existing.asset.autonomyLevel,
        decisionNotes: req.decisionNotes,
      },
    });

    return req;
  });

  return NextResponse.json({ request: updated });
}
