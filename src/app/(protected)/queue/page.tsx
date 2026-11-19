import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { QueueClient } from "@/components/queue/QueueClient";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const session = await requirePageSession();
  const role = session.role as RoleCode;
  const canApproveGates = hasPermission(role, "aaef:signoff");
  const now = new Date();

  const [gates, actions, pendingSignoffs, risks, myAssets, cadenceCfg] = await Promise.all([
    prisma.stageGateRequest.findMany({
      where: {
        status: "PENDING",
        ...(canApproveGates ? {} : { requestedById: session.id }),
      },
      include: {
        asset: { select: { id: true, assetCode: true, name: true, lifecycleStage: true, autonomyLevel: true } },
        requestedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.action.findMany({
      where: {
        status: { not: "DONE" },
        ...(role === "ADMIN" || role === "GOVERNANCE_OFFICE" ? {} : { ownerId: session.id }),
      },
      include: { asset: { select: { id: true, assetCode: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 25,
    }),
    canApproveGates
      ? prisma.aaefAppraisal.findMany({
          where: { signedOffAt: null, assignedProfileId: { not: null } },
          include: {
            asset: { select: { id: true, assetCode: true, name: true } },
            assignedProfile: { select: { name: true } },
          },
          orderBy: { dueDate: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    prisma.risk.findMany({
      where: {
        status: { not: "CLOSED" },
        reviewDate: { lt: now },
        ...(role === "ADMIN" || role === "GOVERNANCE_OFFICE" ? {} : { ownerId: session.id }),
      },
      include: { asset: { select: { id: true, assetCode: true, name: true } } },
      orderBy: { reviewDate: "asc" },
      take: 20,
    }),
    prisma.aIAsset.findMany({
      where:
        role === "ADMIN" || role === "GOVERNANCE_OFFICE"
          ? {}
          : { OR: [{ ownerId: session.id }, { overseerId: session.id }] },
      select: { id: true, assetCode: true, name: true, rolesLastReviewedAt: true },
      orderBy: { assetCode: "asc" },
    }),
    prisma.governanceConfig.findUnique({ where: { key: "GOVERNANCE_CADENCE" } }),
  ]);

  const maxAgeDays = Number(
    (cadenceCfg?.valueJson as Record<string, unknown> | undefined)?.roleReviewMaxAgeDays ?? 180,
  );
  const lapsedAssets = myAssets.filter(
    (a) =>
      !a.rolesLastReviewedAt ||
      (now.getTime() - a.rolesLastReviewedAt.getTime()) / (1000 * 60 * 60 * 24) > maxAgeDays,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Governance Queue</h1>
        <p className="text-sm text-muted-foreground">
          Personalised inbox of pending stage-gate approvals, assigned actions, AAEF sign-offs, and overdue reviews.
        </p>
      </div>

      <QueueClient
        initialGates={gates.map((g) => ({
          ...g,
          createdAt: g.createdAt.toISOString(),
          readinessSnapshotJson: g.readinessSnapshotJson as { checks?: Array<{ label: string; passed: boolean; detail?: string }> },
        }))}
        initialActions={actions.map((a) => ({
          ...a,
          dueDate: a.dueDate.toISOString(),
        }))}
        pendingSignoffs={pendingSignoffs.map((s) => ({
          id: s.id,
          cycleType: s.cycleType,
          appraisalDate: (s.completedAt ?? s.dueDate).toISOString(),
          asset: s.asset,
          assignedProfile: s.assignedProfile ?? { name: "Pending" },
        }))}
        overdueRisks={risks.map((r) => ({
          id: r.id,
          riskCode: r.riskCode,
          title: r.title,
          reviewDate: r.reviewDate.toISOString(),
          residualScore: r.residualLikelihood * r.residualImpact,
          asset: r.asset,
        }))}
        lapsedAssets={lapsedAssets.map((a) => ({
          ...a,
          rolesLastReviewedAt: a.rolesLastReviewedAt ? a.rolesLastReviewedAt.toISOString() : null,
        }))}
        canApproveGates={canApproveGates}
      />
    </div>
  );
}
