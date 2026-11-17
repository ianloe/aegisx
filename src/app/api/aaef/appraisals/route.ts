import { NextResponse } from "next/server";
import { z } from "zod";
import { AaefDimension, AppraisalCycleType, AppraisalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import {
  assignPerformanceProfile,
  evaluateScheduleStatus,
  isHighSeverityBreach,
  ProfileDefinition,
  ProfileRuleConfig,
} from "@/lib/governance/aaef-engine";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") || undefined;

  // Refresh due/overdue statuses on non-completed appraisals
  const pending = await prisma.aaefAppraisal.findMany({
    where: { status: { not: "COMPLETED" } },
    select: { id: true, dueDate: true, completedAt: true, status: true },
  });
  for (const p of pending) {
    const nextStatus = evaluateScheduleStatus(p.dueDate, p.completedAt);
    if (nextStatus !== p.status) {
      await prisma.aaefAppraisal.update({ where: { id: p.id }, data: { status: nextStatus } });
    }
  }

  const appraisals = await prisma.aaefAppraisal.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      asset: { select: { id: true, assetCode: true, name: true, ownerId: true } },
      assessor: { select: { id: true, name: true } },
      signedOffBy: { select: { id: true, name: true } },
      assignedProfile: true,
      overrideProfile: true,
      dimensionScores: true,
      boundaryBreaches: true,
    },
    orderBy: [{ dueDate: "desc" }],
  });

  return NextResponse.json({ appraisals });
}

const createAppraisalSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("SCHEDULE"),
    assetId: z.string().min(1),
    cycleType: z.nativeEnum(AppraisalCycleType),
    dueDate: z.string().min(4),
  }),
  z.object({
    mode: z.literal("COMPLETE"),
    assetId: z.string().min(1),
    cycleType: z.nativeEnum(AppraisalCycleType),
    taskCompetence: z.number().min(0).max(4),
    judgementQuality: z.number().min(0).max(4),
    collaborationEffectiveness: z.number().min(0).max(4),
    boundaryPassed: z.boolean(),
    rationales: z.object({
      taskCompetence: z.string().min(2),
      judgementQuality: z.string().min(2),
      boundaryAdherence: z.string().min(2),
      collaborationEffectiveness: z.string().min(2),
      improvementTrajectory: z.string().optional(),
    }),
    notes: z.string().optional(),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireApiSession("aaef:appraise");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createAppraisalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AAEF appraisal payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.mode === "SCHEDULE") {
    const due = new Date(data.dueDate);
    const status = evaluateScheduleStatus(due, null);
    const scheduled = await prisma.$transaction(async (tx) => {
      const app = await tx.aaefAppraisal.create({
        data: {
          assetId: data.assetId,
          cycleType: data.cycleType,
          dueDate: due,
          status,
        },
      });
      await writeAuditLog(tx, {
        actorId: auth.session.id,
        actorEmail: auth.session.email,
        action: "SCHEDULE_AAEF_APPRAISAL",
        entityType: "AAEF_APPRAISAL",
        entityId: app.id,
        afterState: app,
      });
      return app;
    });
    return NextResponse.json({ appraisal: scheduled }, { status: 201 });
  }

  // COMPLETE mode: fetch previous completed appraisal and DB profiles
  const [prevAppraisal, dbProfiles, openBreaches, asset] = await Promise.all([
    prisma.aaefAppraisal.findFirst({
      where: { assetId: data.assetId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      include: { dimensionScores: true },
    }),
    prisma.performanceProfile.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.boundaryBreach.findMany({
      where: { assetId: data.assetId, status: "OPEN" },
    }),
    prisma.aIAsset.findUnique({ where: { id: data.assetId } }),
  ]);

  let previousAvgScore: number | null = null;
  if (prevAppraisal) {
    const core = prevAppraisal.dimensionScores.filter((d) =>
      ["TASK_COMPETENCE", "JUDGEMENT_QUALITY", "COLLABORATION_EFFECTIVENESS"].includes(d.dimension)
    );
    if (core.length > 0) {
      previousAvgScore = core.reduce((s, d) => s + d.score, 0) / core.length;
    }
  }

  const profiles: ProfileDefinition[] = dbProfiles.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    governanceConsequence: p.governanceConsequence,
    requiredAction: p.requiredAction,
    ruleConfigJson: p.ruleConfigJson as unknown as ProfileRuleConfig,
  }));

  const hasSevere = openBreaches.some((b) => isHighSeverityBreach(b.severity));
  const evaluation = assignPerformanceProfile(
    {
      taskCompetence: data.taskCompetence,
      judgementQuality: data.judgementQuality,
      collaborationEffectiveness: data.collaborationEffectiveness,
      boundaryPassed: data.boundaryPassed,
      openBreachCount: data.boundaryPassed ? openBreaches.length : Math.max(1, openBreaches.length),
      hasCriticalOrHighBreach: hasSevere,
      previousAvgScore,
    },
    profiles
  );

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const appraisal = await tx.aaefAppraisal.create({
      data: {
        assetId: data.assetId,
        cycleType: data.cycleType,
        dueDate: now,
        completedAt: now,
        assessorId: auth.session.id,
        status: AppraisalStatus.COMPLETED,
        computedTrajectory: evaluation.trajectory,
        assignedProfileId: evaluation.profile.id,
        assignmentReason: evaluation.reason,
        consequenceAction: evaluation.profile.governanceConsequence,
        notes: data.notes || null,
        dimensionScores: {
          create: [
            {
              dimension: AaefDimension.TASK_COMPETENCE,
              score: data.taskCompetence,
              rationale: data.rationales.taskCompetence,
            },
            {
              dimension: AaefDimension.JUDGEMENT_QUALITY,
              score: data.judgementQuality,
              rationale: data.rationales.judgementQuality,
            },
            {
              dimension: AaefDimension.BOUNDARY_ADHERENCE,
              score: data.boundaryPassed ? 4 : 0,
              boundaryPassed: data.boundaryPassed,
              rationale: data.rationales.boundaryAdherence,
            },
            {
              dimension: AaefDimension.COLLABORATION_EFFECTIVENESS,
              score: data.collaborationEffectiveness,
              rationale: data.rationales.collaborationEffectiveness,
            },
            {
              dimension: AaefDimension.IMPROVEMENT_TRAJECTORY,
              score: evaluation.trajectoryScore,
              rationale:
                data.rationales.improvementTrajectory ||
                `Computed ${evaluation.trajectory.toLowerCase()} trajectory vs previous cycle.`,
            },
          ],
        },
      },
      include: {
        assignedProfile: true,
        dimensionScores: true,
      },
    });

    // Generate required action if profile is not OPERATIONAL
    if (evaluation.profile.code !== "OPERATIONAL") {
      await tx.action.create({
        data: {
          title: `AAEF [${evaluation.profile.name}] Action: ${evaluation.profile.requiredAction}`,
          description: evaluation.reason,
          assetId: data.assetId,
          ownerId: asset?.ownerId || auth.session.id,
          dueDate: new Date(now.getTime() + 14 * 86400000),
          sourceType: "AAEF_APPRAISAL",
          sourceId: appraisal.id,
        },
      });
    }

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "COMPLETE_AAEF_APPRAISAL",
      entityType: "AAEF_APPRAISAL",
      entityId: appraisal.id,
      afterState: {
        assetId: data.assetId,
        profile: evaluation.profile.code,
        trajectory: evaluation.trajectory,
        reason: evaluation.reason,
      },
    });

    return appraisal;
  });

  return NextResponse.json({ appraisal: created, evaluation }, { status: 201 });
}

const signOffSchema = z.object({
  appraisalId: z.string().min(1),
  consequenceAction: z.string().min(2),
  overrideProfileId: z.string().nullable().optional(),
  overrideReason: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiSession("aaef:signoff");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = signOffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sign-off payload." }, { status: 400 });
  }

  const before = await prisma.aaefAppraisal.findUnique({ where: { id: parsed.data.appraisalId } });
  if (!before) {
    return NextResponse.json({ error: "Appraisal not found." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.aaefAppraisal.update({
      where: { id: parsed.data.appraisalId },
      data: {
        consequenceAction: parsed.data.consequenceAction,
        overrideProfileId: parsed.data.overrideProfileId || null,
        overrideReason: parsed.data.overrideReason || null,
        signedOffById: auth.session.id,
        signedOffAt: new Date(),
      },
      include: { assignedProfile: true, overrideProfile: true, signedOffBy: { select: { name: true } } },
    });

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "SIGNOFF_AAEF_APPRAISAL",
      entityType: "AAEF_APPRAISAL",
      entityId: app.id,
      beforeState: before,
      afterState: app,
    });
    return app;
  });

  return NextResponse.json({ appraisal: updated });
}
