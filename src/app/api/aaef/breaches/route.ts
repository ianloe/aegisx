import { NextResponse } from "next/server";
import { z } from "zod";
import { Severity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import {
  assignPerformanceProfile,
  isHighSeverityBreach,
  ProfileDefinition,
  ProfileRuleConfig,
} from "@/lib/governance/aaef-engine";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") || undefined;

  const breaches = await prisma.boundaryBreach.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      asset: { select: { id: true, assetCode: true, name: true } },
      authorityRule: { select: { id: true, decisionType: true, scopeDescription: true } },
      reportedBy: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  return NextResponse.json({ breaches });
}

const createBreachSchema = z.object({
  assetId: z.string().min(1),
  authorityRuleId: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  severity: z.nativeEnum(Severity),
  description: z.string().min(4),
  remediation: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("aaef:appraise");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createBreachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid boundary breach input.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const [latestAppraisal, dbProfiles, existingOpenBreaches, asset] = await Promise.all([
    prisma.aaefAppraisal.findFirst({
      where: { assetId: data.assetId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      include: { dimensionScores: true, assignedProfile: true },
    }),
    prisma.performanceProfile.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.boundaryBreach.count({ where: { assetId: data.assetId, status: "OPEN" } }),
    prisma.aIAsset.findUnique({ where: { id: data.assetId } }),
  ]);

  const profiles: ProfileDefinition[] = dbProfiles.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    governanceConsequence: p.governanceConsequence,
    requiredAction: p.requiredAction,
    ruleConfigJson: p.ruleConfigJson as unknown as ProfileRuleConfig,
  }));

  const result = await prisma.$transaction(async (tx) => {
    const breach = await tx.boundaryBreach.create({
      data: {
        assetId: data.assetId,
        appraisalId: latestAppraisal?.id ?? null,
        authorityRuleId: data.authorityRuleId || null,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
        severity: data.severity,
        description: data.description.trim(),
        remediation: data.remediation?.trim() || null,
        status: "OPEN",
        reportedById: auth.session.id,
      },
    });

    let profileChange: {
      previousProfile: string | null;
      newProfile: string;
      reason: string;
      consequence: string;
    } | null = null;

    if (latestAppraisal) {
      const scoreMap = Object.fromEntries(
        latestAppraisal.dimensionScores.map((s) => [s.dimension, s.score])
      );
      const evaluation = assignPerformanceProfile(
        {
          taskCompetence: scoreMap["TASK_COMPETENCE"] ?? 2.5,
          judgementQuality: scoreMap["JUDGEMENT_QUALITY"] ?? 2.5,
          collaborationEffectiveness: scoreMap["COLLABORATION_EFFECTIVENESS"] ?? 2.5,
          boundaryPassed: false,
          openBreachCount: existingOpenBreaches + 1,
          hasCriticalOrHighBreach: isHighSeverityBreach(data.severity),
        },
        profiles
      );

      await tx.aaefDimensionScore.updateMany({
        where: { appraisalId: latestAppraisal.id, dimension: "BOUNDARY_ADHERENCE" },
        data: {
          score: 0,
          boundaryPassed: false,
          rationale: `Boundary breach logged (${data.severity}): ${data.description}`,
        },
      });

      await tx.aaefAppraisal.update({
        where: { id: latestAppraisal.id },
        data: {
          assignedProfileId: evaluation.profile.id,
          assignmentReason: `${evaluation.reason} Triggered by boundary breach: ${data.description}`,
          consequenceAction: evaluation.profile.governanceConsequence,
          signedOffById: null,
          signedOffAt: null,
        },
      });

      profileChange = {
        previousProfile: latestAppraisal.assignedProfile?.name ?? null,
        newProfile: evaluation.profile.name,
        reason: `${evaluation.reason} Triggered by boundary breach: ${data.description}`,
        consequence: evaluation.profile.governanceConsequence,
      };
    }

    await tx.action.create({
      data: {
        title: `Remediate Boundary Breach on ${asset?.assetCode || "Agent"}`,
        description: `${data.description} (${data.severity})`,
        assetId: data.assetId,
        ownerId: asset?.ownerId || auth.session.id,
        dueDate: new Date(Date.now() + 7 * 86400000),
        sourceType: "BOUNDARY_BREACH",
        sourceId: breach.id,
      },
    });

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "LOG_BOUNDARY_BREACH",
      entityType: "BOUNDARY_BREACH",
      entityId: breach.id,
      afterState: { breach, profileChange },
    });

    return { breach, profileChange };
  });

  return NextResponse.json(result, { status: 201 });
}
