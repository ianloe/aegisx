import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { AssetRegisterClient } from "@/components/assets/AssetRegisterClient";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const session = await requirePageSession();
  const canWrite = hasPermission(session.role as RoleCode, "assets:write");

  const [assets, businessUnits, users] = await Promise.all([
    prisma.aIAsset.findMany({
      include: {
        businessUnit: { select: { id: true, code: true, name: true, country: true } },
        owner: { select: { id: true, name: true, email: true } },
        overseer: { select: { id: true, name: true, email: true } },
        frameAssessments: { orderBy: { assessedAt: "desc" }, take: 1, select: { overallScore: true } },
        aaefAppraisals: {
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
          include: { assignedProfile: { select: { code: true, name: true } } },
        },
        _count: { select: { risks: true, incidents: true } },
      },
      orderBy: { assetCode: "asc" },
    }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AssetRegisterClient
      initialAssets={assets}
      businessUnits={businessUnits}
      users={users}
      canWrite={canWrite}
    />
  );
}
