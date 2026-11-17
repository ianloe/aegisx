import { NextResponse } from "next/server";
import { z } from "zod";
import { MetricClassification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { computeFrameSummary } from "@/lib/governance/frame-scoring";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") || undefined;

  const assessments = await prisma.frameAssessment.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      asset: { select: { id: true, assetCode: true, name: true } },
      assessor: { select: { id: true, name: true } },
      scores: { include: { criterion: true } },
    },
    orderBy: { assessedAt: "desc" },
  });

  return NextResponse.json({ assessments });
}

const createAssessmentSchema = z.object({
  assetId: z.string().min(1),
  notes: z.string().optional(),
  scores: z
    .array(
      z.object({
        criterionId: z.string().min(1),
        score: z.number().int().min(0).max(4),
        rationale: z.string().min(2),
        metricClassification: z.nativeEnum(MetricClassification).default("NONE"),
        evidenceNote: z.string().optional(),
      })
    )
    .min(1),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("frame:assess");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid FRAME assessment payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const criteria = await prisma.frameCriterion.findMany({
    where: { id: { in: parsed.data.scores.map((s) => s.criterionId) } },
  });
  const criterionMap = new Map(criteria.map((c) => [c.id, c]));

  const summary = computeFrameSummary(
    parsed.data.scores.map((s) => ({
      dimension: criterionMap.get(s.criterionId)?.dimension ?? "FOCUS",
      score: s.score,
      metricClassification: s.metricClassification,
    }))
  );

  const created = await prisma.$transaction(async (tx) => {
    const assessment = await tx.frameAssessment.create({
      data: {
        assetId: parsed.data.assetId,
        assessorId: auth.session.id,
        overallScore: summary.overallScore,
        notes: parsed.data.notes || null,
        scores: {
          create: parsed.data.scores.map((s) => ({
            criterionId: s.criterionId,
            score: s.score,
            rationale: s.rationale,
            metricClassification: s.metricClassification,
            evidenceNote: s.evidenceNote || null,
          })),
        },
      },
      include: {
        scores: { include: { criterion: true } },
        assessor: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_FRAME_ASSESSMENT",
      entityType: "FRAME_ASSESSMENT",
      entityId: assessment.id,
      afterState: {
        assetId: parsed.data.assetId,
        overallScore: summary.overallScore,
        dimensions: summary.dimensions,
        activityOnlyWarning: summary.activityOnlyWarning,
      },
    });

    return assessment;
  });

  return NextResponse.json({ assessment: created, summary }, { status: 201 });
}
