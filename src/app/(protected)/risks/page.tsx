import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { RiskClient } from "@/components/risks/RiskClient";
import { DEFAULT_RISK_APPETITE, RiskAppetiteThresholds } from "@/lib/governance/risk-scoring";

export const dynamic = "force-dynamic";

export default async function RisksPage() {
  const session = await requirePageSession();
  const role = session.role as RoleCode;

  const [risks, controls, frameworks, incidents, assets, users, appetiteCfg] = await Promise.all([
    prisma.risk.findMany({
      include: {
        asset: {
          select: {
            id: true,
            assetCode: true,
            name: true,
            businessUnit: { select: { id: true, name: true } },
          },
        },
        owner: { select: { id: true, name: true } },
        controls: { include: { control: { select: { id: true, controlCode: true, title: true } } } },
      },
      orderBy: { riskCode: "asc" },
    }),
    prisma.control.findMany({
      include: {
        owner: { select: { name: true } },
        mappings: {
          include: {
            requirement: {
              include: { framework: { select: { id: true, code: true, name: true } } },
            },
          },
        },
      },
      orderBy: { controlCode: "asc" },
    }),
    prisma.framework.findMany({
      include: { requirements: { orderBy: { code: "asc" } } },
      orderBy: { code: "asc" },
    }),
    prisma.incident.findMany({
      include: {
        asset: { select: { id: true, assetCode: true, name: true } },
        risk: { select: { id: true, riskCode: true, title: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.aIAsset.findMany({
      select: { id: true, assetCode: true, name: true },
      orderBy: { assetCode: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.governanceConfig.findUnique({ where: { key: "RISK_APPETITE" } }),
  ]);

  const appetite: RiskAppetiteThresholds = {
    ...DEFAULT_RISK_APPETITE,
    ...((appetiteCfg?.valueJson as unknown as Partial<RiskAppetiteThresholds>) ?? {}),
  };

  return (
    <RiskClient
      risks={risks.map((r) => ({ ...r, reviewDate: r.reviewDate.toISOString() }))}
      controls={controls.map((c) => ({
        ...c,
        lastTestedAt: c.lastTestedAt ? c.lastTestedAt.toISOString() : null,
      }))}
      frameworks={frameworks}
      incidents={incidents.map((inc) => ({ ...inc, occurredAt: inc.occurredAt.toISOString() }))}
      assets={assets}
      users={users}
      appetite={appetite}
      canWriteRisks={hasPermission(role, "risks:write")}
      canTestControls={hasPermission(role, "controls:test")}
      canWriteIncidents={hasPermission(role, "incidents:write")}
    />
  );
}
