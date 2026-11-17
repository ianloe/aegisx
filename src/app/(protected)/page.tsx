import { prisma } from "@/lib/prisma";
import { ExecutiveDashboardClient } from "@/components/dashboard/ExecutiveDashboardClient";
import { DEFAULT_RISK_APPETITE, RiskAppetiteThresholds } from "@/lib/governance/risk-scoring";
import { DEFAULT_FINANCIAL_CONFIG, FinancialConfig } from "@/lib/governance/roi-engine";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const [assets, businessUnits, appetiteCfg, finCfg] = await Promise.all([
    prisma.aIAsset.findMany({
      include: {
        businessUnit: { select: { id: true, code: true, name: true } },
        frameAssessments: {
          orderBy: { assessedAt: "desc" },
          take: 1,
          select: { overallScore: true, assessedAt: true },
        },
        aaefAppraisals: {
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
          include: {
            assignedProfile: { select: { code: true, name: true } },
            overrideProfile: { select: { code: true, name: true } },
          },
        },
        risks: {
          select: {
            id: true,
            riskCode: true,
            title: true,
            inherentLikelihood: true,
            inherentImpact: true,
            residualLikelihood: true,
            residualImpact: true,
            financialExposure: true,
            reviewDate: true,
            status: true,
          },
        },
        incidents: {
          orderBy: { occurredAt: "desc" },
          take: 5,
          select: {
            id: true,
            incidentCode: true,
            title: true,
            severity: true,
            isNearMiss: true,
            occurredAt: true,
            status: true,
          },
        },
        costItems: { select: { amount: true, currency: true, quarter: true } },
        benefitItems: {
          select: {
            plannedAmount: true,
            actualAmount: true,
            currency: true,
            quarter: true,
            confidence: true,
          },
        },
        actions: {
          include: { owner: { select: { name: true } } },
        },
      },
      orderBy: { assetCode: "asc" },
    }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.governanceConfig.findUnique({ where: { key: "RISK_APPETITE" } }),
    prisma.governanceConfig.findUnique({ where: { key: "FINANCIAL_DEFAULTS" } }),
  ]);

  const appetite: RiskAppetiteThresholds = {
    ...DEFAULT_RISK_APPETITE,
    ...((appetiteCfg?.valueJson as unknown as Partial<RiskAppetiteThresholds>) ?? {}),
  };
  const financialConfig: FinancialConfig = {
    ...DEFAULT_FINANCIAL_CONFIG,
    ...((finCfg?.valueJson as unknown as Partial<FinancialConfig>) ?? {}),
  };

  return (
    <ExecutiveDashboardClient
      assets={assets.map((a) => ({
        ...a,
        frameAssessments: a.frameAssessments.map((f) => ({
          ...f,
          assessedAt: f.assessedAt.toISOString(),
        })),
        risks: a.risks.map((r) => ({ ...r, reviewDate: r.reviewDate.toISOString() })),
        incidents: a.incidents.map((inc) => ({ ...inc, occurredAt: inc.occurredAt.toISOString() })),
        actions: a.actions.map((act) => ({ ...act, dueDate: act.dueDate.toISOString() })),
      }))}
      businessUnits={businessUnits}
      appetite={appetite}
      financialConfig={financialConfig}
    />
  );
}
