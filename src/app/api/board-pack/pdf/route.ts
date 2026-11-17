import { NextResponse } from "next/server";
import { AutonomyLevel, LifecycleStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { calculateGenericRoi, DEFAULT_FINANCIAL_CONFIG, FinancialConfig } from "@/lib/governance/roi-engine";
import { DEFAULT_RISK_APPETITE, evaluateRiskPosture, RiskAppetiteThresholds } from "@/lib/governance/risk-scoring";
import { generateBoardPackPdfBuffer } from "@/lib/pdf/board-pack-pdf";
import { formatDate } from "@/lib/utils";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const businessUnitId = searchParams.get("businessUnitId") || undefined;
  const country = searchParams.get("country") || undefined;
  const lifecycleStage = (searchParams.get("lifecycleStage") as LifecycleStage) || undefined;
  const autonomyLevel = (searchParams.get("autonomyLevel") as AutonomyLevel) || undefined;
  const vendorName = searchParams.get("vendorName") || undefined;

  const [org, assets, appetiteCfg, finCfg] = await Promise.all([
    prisma.organisation.findFirst(),
    prisma.aIAsset.findMany({
      where: {
        ...(businessUnitId ? { businessUnitId } : {}),
        ...(country ? { country } : {}),
        ...(lifecycleStage ? { lifecycleStage } : {}),
        ...(autonomyLevel ? { autonomyLevel } : {}),
        ...(vendorName ? { vendorName } : {}),
      },
      include: {
        frameAssessments: { orderBy: { assessedAt: "desc" }, take: 1 },
        aaefAppraisals: {
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
          include: { assignedProfile: true, overrideProfile: true },
        },
        risks: true,
        incidents: { orderBy: { occurredAt: "desc" } },
        costItems: true,
        benefitItems: true,
        actions: true,
      },
    }),
    prisma.governanceConfig.findUnique({ where: { key: "RISK_APPETITE" } }),
    prisma.governanceConfig.findUnique({ where: { key: "FINANCIAL_DEFAULTS" } }),
  ]);

  const appetite: RiskAppetiteThresholds = {
    ...DEFAULT_RISK_APPETITE,
    ...((appetiteCfg?.valueJson as unknown as Partial<RiskAppetiteThresholds>) ?? {}),
  };
  const finConfig: FinancialConfig = {
    ...DEFAULT_FINANCIAL_CONFIG,
    ...((finCfg?.valueJson as unknown as Partial<FinancialConfig>) ?? {}),
  };

  const lifecycleCounts: Record<string, number> = { IDEA: 0, PILOT: 0, PRODUCTION: 0, RETIRED: 0 };
  const autonomyCounts: Record<string, number> = {
    ASSISTIVE: 0,
    HUMAN_IN_THE_LOOP: 0,
    HUMAN_ON_THE_LOOP: 0,
    AUTONOMOUS: 0,
  };
  const aaefDistribution: Record<string, number> = {
    OPERATIONAL: 0,
    DEVELOPING: 0,
    RESTRICTED: 0,
    UNDER_REVIEW: 0,
  };

  let frameSum = 0;
  let frameCount = 0;

  for (const a of assets) {
    lifecycleCounts[a.lifecycleStage] = (lifecycleCounts[a.lifecycleStage] ?? 0) + 1;
    autonomyCounts[a.autonomyLevel] = (autonomyCounts[a.autonomyLevel] ?? 0) + 1;

    if (a.frameAssessments[0]) {
      frameSum += a.frameAssessments[0].overallScore;
      frameCount++;
    }
    if (a.isAgent && a.aaefAppraisals[0]) {
      const prof = a.aaefAppraisals[0].overrideProfile || a.aaefAppraisals[0].assignedProfile;
      if (prof) {
        aaefDistribution[prof.code] = (aaefDistribution[prof.code] ?? 0) + 1;
      }
    }
  }

  const allCosts = assets.flatMap((a) => a.costItems);
  const allBenefits = assets.flatMap((a) => a.benefitItems);
  const allRisks = assets.flatMap((a) => a.risks.map((r) => ({ ...r, assetCode: a.assetCode })));
  const allIncidents = assets.flatMap((a) => a.incidents.map((inc) => ({ ...inc, assetCode: a.assetCode })));
  const allActions = assets.flatMap((a) => a.actions);

  const roi = calculateGenericRoi(allCosts, allBenefits, allRisks, "SGD", finConfig);

  const evaluatedRisks = allRisks
    .map((r) => ({
      code: r.riskCode,
      title: r.title,
      assetCode: r.assetCode,
      posture: evaluateRiskPosture(r, appetite),
    }))
    .sort((a, b) => b.posture.residualScore - a.posture.residualScore);

  const filterParts: string[] = [];
  if (country) filterParts.push(`Country=${country}`);
  if (lifecycleStage) filterParts.push(`Stage=${lifecycleStage}`);
  if (autonomyLevel) filterParts.push(`Autonomy=${autonomyLevel}`);
  if (vendorName) filterParts.push(`Vendor=${vendorName}`);

  const pdfBuffer = generateBoardPackPdfBuffer({
    generatedDate: formatDate(new Date()),
    organisationName: org?.name || "Meridian Enterprise Group",
    filterSummary: filterParts.length > 0 ? filterParts.join(", ") : "All Business Units & Assets",
    totalAssets: assets.length,
    agentAssets: assets.filter((a) => a.isAgent).length,
    lifecycleCounts,
    autonomyCounts,
    averageFrameScore: frameCount > 0 ? frameSum / frameCount : 0,
    aaefDistribution,
    totalCostSgd: roi.totalCost,
    measuredBenefitSgd: roi.measuredBenefit,
    assumedOrEstimatedSgd: roi.estimatedBenefit + roi.assumedBenefit,
    netBenefitSgd: roi.netBenefit,
    roiPercent: roi.roiPercent,
    valueAtRiskSgd: roi.valueAtRisk,
    riskAdjustedRoiPercent: roi.riskAdjustedRoiPercent,
    appetiteBreachCount: evaluatedRisks.filter((r) => r.posture.appetiteBreached).length,
    overdueActionsCount: allActions.filter(
      (act) => act.status !== "DONE" && new Date(act.dueDate).getTime() < Date.now()
    ).length,
    topRisks: evaluatedRisks.map((r) => ({
      code: r.code,
      title: r.title,
      assetCode: r.assetCode,
      residualScore: r.posture.residualScore,
      breached: r.posture.appetiteBreached,
    })),
    recentIncidents: allIncidents
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .map((inc) => ({
        code: inc.incidentCode,
        title: inc.title,
        assetCode: inc.assetCode,
        severity: inc.severity,
        date: formatDate(inc.occurredAt),
      })),
  });

  await writeAuditLog(prisma, {
    actorId: auth.session.id,
    actorEmail: auth.session.email,
    action: "EXPORT_BOARD_PACK_PDF",
    entityType: "BOARD_PACK",
    entityId: new Date().toISOString().slice(0, 10),
    afterState: { assetCount: assets.length, filters: filterParts },
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ai-governance-board-pack-A4-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
