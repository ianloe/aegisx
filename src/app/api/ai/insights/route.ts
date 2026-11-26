import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { generateAiCompletion } from "@/lib/ai/provider-client";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const bodySchema = z.object({
  scope: z.enum(["EXECUTIVE_DASHBOARD", "SHADOW_AI", "ASSURANCE_AND_RISK"]),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "assets:read")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const rate = checkRateLimit(`ai-insights:${session.id}`, 10, 5 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `AI insights rate limit reached. Try again in ${rate.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid insight scope" }, { status: 400 });
  }

  const { scope } = parsed.data;
  const systemPrompt =
    "You are Aegis AI Governance Advisor. Use British English, be concise and factual, never use em dashes, and format output in 3 short sections: Key Findings, Top Risks, and Recommended Actions (bullet points). Base every point strictly on the supplied telemetry and governance metrics.";

  let userPrompt = "";

  if (scope === "EXECUTIVE_DASHBOARD") {
    const [assets, openBreaches, openRisks, shadowOpen, costSum, benefitSum] = await Promise.all([
      prisma.aIAsset.findMany({
        select: {
          assetCode: true,
          name: true,
          lifecycleStage: true,
          autonomyLevel: true,
          runtimeGateStatus: true,
          frameAssessments: { orderBy: { assessedAt: "desc" }, take: 1, select: { overallScore: true } },
          aaefAppraisals: {
            orderBy: { dueDate: "desc" },
            take: 1,
            select: { assignedProfile: { select: { code: true } } },
          },
        },
      }),
      prisma.boundaryBreach.count({ where: { status: "OPEN" } }),
      prisma.risk.findMany({
        where: { status: { not: "CLOSED" } },
        select: { residualLikelihood: true, residualImpact: true },
      }),
      prisma.shadowAiCandidate.count({ where: { status: { in: ["DETECTED", "UNDER_REVIEW"] } } }),
      prisma.costItem.aggregate({ _sum: { amount: true } }),
      prisma.benefitItem.groupBy({ by: ["confidence"], _sum: { actualAmount: true } }),
    ]);

    const highRisks = openRisks.filter((r) => r.residualLikelihood * r.residualImpact >= 12).length;
    const frameScores = assets
      .map((a) => a.frameAssessments[0]?.overallScore)
      .filter((s): s is number => typeof s === "number");
    const avgFrame = frameScores.length
      ? (frameScores.reduce((a, b) => a + b, 0) / frameScores.length).toFixed(2)
      : "N/A";
    const suspendedOrRestricted = assets.filter((a) => a.runtimeGateStatus !== "ALLOW").length;

    const snapshot = {
      totalAssets: assets.length,
      productionAssets: assets.filter((a) => a.lifecycleStage === "PRODUCTION").length,
      autonomousAssets: assets.filter((a) => a.autonomyLevel === "AUTONOMOUS").length,
      avgFrameMaturityOutOf4: avgFrame,
      openBoundaryBreaches: openBreaches,
      highResidualRisks: highRisks,
      openShadowAiCandidates: shadowOpen,
      suspendedOrRestrictedGates: suspendedOrRestricted,
      totalRecordedCosts: costSum._sum.amount ?? 0,
      benefitsByConfidence: benefitSum.map((b) => ({
        confidence: b.confidence,
        totalActual: b._sum.actualAmount ?? 0,
      })),
      flaggedAssets: assets
        .filter(
          (a) =>
            a.runtimeGateStatus !== "ALLOW" ||
            a.aaefAppraisals[0]?.assignedProfile?.code === "UNDER_REVIEW" ||
            a.aaefAppraisals[0]?.assignedProfile?.code === "RESTRICTED",
        )
        .map((a) => ({
          assetCode: a.assetCode,
          gate: a.runtimeGateStatus,
          aaefProfile: a.aaefAppraisals[0]?.assignedProfile?.code ?? "UNAPPRAISED",
        })),
    };

    userPrompt = `Generate an Executive & Board AI Governance Briefing from this live Aegis portfolio snapshot:\n${JSON.stringify(snapshot, null, 2)}`;
  } else if (scope === "SHADOW_AI") {
    const candidates = await prisma.shadowAiCandidate.findMany({
      orderBy: { requestCount: "desc" },
      take: 25,
      select: {
        domain: true,
        providerName: true,
        category: true,
        source: true,
        businessUnit: true,
        requestCount: true,
        bytesUploaded: true,
        uniqueUsers: true,
        status: true,
      },
    });
    userPrompt = `Analyse these Shadow AI detections from SASE, DNS, and IdP feeds and recommend which to onboard vs block:\n${JSON.stringify(
      candidates.map((c) => ({
        ...c,
        uploadedMb: Number((c.bytesUploaded / (1024 * 1024)).toFixed(2)),
      })),
      null,
      2,
    )}`;
  } else {
    const [evals, exceptions, protocolViolations, overdueTimers] = await Promise.all([
      prisma.evalScorecard.findMany({ take: 20, orderBy: { evaluatedAt: "desc" } }),
      prisma.policyException.findMany({ where: { status: "ACTIVE" } }),
      prisma.protocolCallEvent.findMany({ where: { status: "UNAPPROVED" }, take: 20 }),
      prisma.incident.findMany({
        where: { notificationDueAt: { not: null }, reportedToRegulatorAt: null },
        select: { incidentCode: true, regulatoryFramework: true, notificationDueAt: true },
      }),
    ]);
    userPrompt = `Summarise Assurance, Eval, MCP/A2A violations, Policy Exceptions, and Regulatory Incident Timers:\n${JSON.stringify(
      {
        failedEvals: evals.filter((e) => !e.passed).length,
        totalEvals: evals.length,
        activePolicyExceptions: exceptions.length,
        unapprovedMcpOrA2aCalls: protocolViolations.length,
        pendingRegulatoryFilings: overdueTimers,
      },
      null,
      2,
    )}`;
  }

  try {
    const completion = await generateAiCompletion({ systemPrompt, userPrompt });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "AI_INSIGHT_GENERATED",
      entityType: "AI_INSIGHT",
      entityId: scope,
      afterState: { scope, provider: completion.provider, model: completion.model },
    });

    return NextResponse.json({
      scope,
      provider: completion.provider,
      model: completion.model,
      insight: completion.text,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate AI insights." },
      { status: 400 },
    );
  }
}
