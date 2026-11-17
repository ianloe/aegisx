import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { AaefClient } from "@/components/aaef/AaefClient";
import { evaluateScheduleStatus, ProfileRuleConfig } from "@/lib/governance/aaef-engine";

export const dynamic = "force-dynamic";

export default async function AaefPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const session = await requirePageSession();
  const role = session.role as RoleCode;
  const sp = await searchParams;

  // Refresh due/overdue statuses automatically
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

  const [agents, profiles, appraisals, breaches] = await Promise.all([
    prisma.aIAsset.findMany({
      where: { isAgent: true },
      include: {
        businessUnit: { select: { name: true } },
        owner: { select: { name: true } },
        authorityRules: { where: { isActive: true }, select: { id: true, decisionType: true, scopeDescription: true } },
      },
      orderBy: { assetCode: "asc" },
    }),
    prisma.performanceProfile.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.aaefAppraisal.findMany({
      include: {
        asset: { select: { id: true, assetCode: true, name: true } },
        assessor: { select: { name: true } },
        signedOffBy: { select: { name: true } },
        assignedProfile: true,
        overrideProfile: true,
        dimensionScores: true,
      },
      orderBy: { dueDate: "desc" },
    }),
    prisma.boundaryBreach.findMany({
      include: {
        asset: { select: { assetCode: true, name: true } },
        authorityRule: { select: { decisionType: true, scopeDescription: true } },
        reportedBy: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  return (
    <AaefClient
      agents={agents}
      profiles={profiles.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        governanceConsequence: p.governanceConsequence,
        requiredAction: p.requiredAction,
        ruleConfigJson: p.ruleConfigJson as unknown as ProfileRuleConfig,
      }))}
      appraisals={appraisals.map((a) => ({
        ...a,
        dueDate: a.dueDate.toISOString(),
        completedAt: a.completedAt ? a.completedAt.toISOString() : null,
        signedOffAt: a.signedOffAt ? a.signedOffAt.toISOString() : null,
      }))}
      breaches={breaches.map((b) => ({
        ...b,
        occurredAt: b.occurredAt.toISOString(),
      }))}
      initialAssetId={sp.assetId}
      canAppraise={hasPermission(role, "aaef:appraise")}
      canSignOff={hasPermission(role, "aaef:signoff")}
    />
  );
}
