import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { convertCurrency } from "@/lib/governance/budget-and-gate";
import { AssuranceClient } from "@/components/assurance/AssuranceClient";

export const dynamic = "force-dynamic";

function getCurrentQuarter(date = new Date()): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

export default async function AssurancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role, "assets:read")) redirect("/");

  const quarter = getCurrentQuarter();

  const [assets, exceptions, attestations, incidents, businessUnits] = await Promise.all([
    prisma.aIAsset.findMany({
      include: {
        businessUnit: { select: { name: true } },
        bomComponents: { orderBy: { createdAt: "desc" } },
        dataSources: { orderBy: { createdAt: "desc" } },
        evalScorecards: { orderBy: { evaluatedAt: "desc" } },
        costItems: { where: { quarter }, select: { amount: true, currency: true } },
      },
      orderBy: { assetCode: "asc" },
    }),
    prisma.policyException.findMany({
      include: { asset: { select: { id: true, assetCode: true, name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.policyAttestation.findMany({
      orderBy: { attestedAt: "desc" },
    }),
    prisma.incident.findMany({
      include: { asset: { select: { assetCode: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 30,
    }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  const canWrite = hasPermission(session.role, "assets:write") || hasPermission(session.role, "admin:config");
  const canSignOff = hasPermission(session.role, "aaef:signoff") || hasPermission(session.role, "admin:config");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assurance, AI-BOM &amp; Runtime Controls</h1>
        <p className="text-sm text-muted-foreground">
          Manage agent kill-switches, AI Bill of Materials (AI-BOM), RAG data lineage, red-team evals, policy exceptions, AUP attestations, regulatory timers, and FinOps budget caps.
        </p>
      </div>
      <AssuranceClient
        quarter={quarter}
        canWrite={canWrite}
        canSignOff={canSignOff}
        businessUnits={businessUnits.map((b) => b.name)}
        initialAssets={assets.map((a) => {
          const quarterlySpend = a.costItems.reduce(
            (sum, c) => sum + convertCurrency(c.amount, c.currency, a.quarterlyBudgetCurrency),
            0,
          );
          return {
            id: a.id,
            assetCode: a.assetCode,
            name: a.name,
            businessUnit: a.businessUnit.name,
            runtimeGateStatus: a.runtimeGateStatus,
            runtimeGateReason: a.runtimeGateReason,
            quarterlyBudgetAmount: a.quarterlyBudgetAmount,
            quarterlyBudgetCurrency: a.quarterlyBudgetCurrency,
            quarterlySpend: Number(quarterlySpend.toFixed(2)),
            bomComponents: a.bomComponents.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
            dataSources: a.dataSources.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
            evalScorecards: a.evalScorecards.map((e) => ({ ...e, evaluatedAt: e.evaluatedAt.toISOString() })),
          };
        })}
        initialExceptions={exceptions.map((ex) => ({
          ...ex,
          expiresAt: ex.expiresAt.toISOString(),
        }))}
        initialAttestations={attestations.map((att) => ({
          ...att,
          attestedAt: att.attestedAt.toISOString(),
        }))}
        initialIncidents={incidents.map((inc) => ({
          id: inc.id,
          incidentCode: inc.incidentCode,
          title: inc.title,
          severity: inc.severity,
          assetCode: inc.asset.assetCode,
          regulatoryFramework: inc.regulatoryFramework,
          notificationDueAt: inc.notificationDueAt ? inc.notificationDueAt.toISOString() : null,
          reportedToRegulatorAt: inc.reportedToRegulatorAt ? inc.reportedToRegulatorAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
