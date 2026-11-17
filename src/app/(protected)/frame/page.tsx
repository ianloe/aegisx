import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { FrameClient } from "@/components/frame/FrameClient";

export const dynamic = "force-dynamic";

export default async function FramePage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const session = await requirePageSession();
  const role = session.role as RoleCode;
  const sp = await searchParams;

  const [assets, criteria, assessments, authorityRules, cadenceCfg] = await Promise.all([
    prisma.aIAsset.findMany({
      include: {
        owner: { select: { name: true } },
        overseer: { select: { name: true } },
        businessUnit: { select: { name: true } },
      },
      orderBy: { assetCode: "asc" },
    }),
    prisma.frameCriterion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.frameAssessment.findMany({
      include: {
        assessor: { select: { name: true } },
        scores: { include: { criterion: { select: { dimension: true, code: true, title: true } } } },
      },
      orderBy: { assessedAt: "desc" },
    }),
    prisma.authorityRule.findMany({
      orderBy: [{ version: "desc" }, { decisionType: "asc" }],
    }),
    prisma.governanceConfig.findUnique({ where: { key: "GOVERNANCE_CADENCE" } }),
  ]);

  const roleMaxAge =
    Number((cadenceCfg?.valueJson as Record<string, unknown> | undefined)?.roleReviewMaxAgeDays) || 180;

  return (
    <FrameClient
      assets={assets.map((a) => ({
        ...a,
        rolesLastReviewedAt: a.rolesLastReviewedAt ? a.rolesLastReviewedAt.toISOString() : null,
      }))}
      criteria={criteria.map((c) => ({
        ...c,
        rubricJson: c.rubricJson as Record<string, string>,
      }))}
      assessments={assessments.map((as) => ({
        ...as,
        assessedAt: as.assessedAt.toISOString(),
      }))}
      authorityRules={authorityRules.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }))}
      initialAssetId={sp.assetId}
      roleReviewMaxAgeDays={roleMaxAge}
      canAssess={hasPermission(role, "frame:assess")}
      canEditAuthority={hasPermission(role, "authority:write")}
    />
  );
}
