import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { RoiClient } from "@/components/roi/RoiClient";
import { DEFAULT_FINANCIAL_CONFIG, FinancialConfig } from "@/lib/governance/roi-engine";

export const dynamic = "force-dynamic";

export default async function RoiPage() {
  const session = await requirePageSession();
  const role = session.role as RoleCode;

  const [assets, valueModels, finCfg] = await Promise.all([
    prisma.aIAsset.findMany({
      include: {
        businessUnit: { select: { name: true } },
        costItems: { orderBy: { quarter: "asc" } },
        benefitItems: { orderBy: { quarter: "asc" } },
        risks: {
          select: {
            id: true,
            riskCode: true,
            title: true,
            residualLikelihood: true,
            residualImpact: true,
            financialExposure: true,
            status: true,
          },
        },
      },
      orderBy: { assetCode: "asc" },
    }),
    prisma.valueModel.findMany({ orderBy: { code: "asc" } }),
    prisma.governanceConfig.findUnique({ where: { key: "FINANCIAL_DEFAULTS" } }),
  ]);

  const financialConfig: FinancialConfig = {
    ...DEFAULT_FINANCIAL_CONFIG,
    ...((finCfg?.valueJson as unknown as Partial<FinancialConfig>) ?? {}),
  };

  return (
    <RoiClient
      assets={assets}
      valueModels={valueModels}
      financialConfig={financialConfig}
      canWrite={hasPermission(role, "roi:write")}
    />
  );
}
