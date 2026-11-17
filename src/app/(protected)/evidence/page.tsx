import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { EvidenceActionsClient } from "@/components/evidence/EvidenceActionsClient";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const session = await requirePageSession();
  const role = session.role as RoleCode;

  const [actions, evidenceItems, assets, users] = await Promise.all([
    prisma.action.findMany({
      include: {
        asset: { select: { id: true, assetCode: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.evidence.findMany({
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
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
  ]);

  return (
    <EvidenceActionsClient
      actions={actions.map((a) => ({ ...a, dueDate: a.dueDate.toISOString() }))}
      evidenceItems={evidenceItems.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))}
      assets={assets}
      users={users}
      canWriteActions={hasPermission(role, "actions:write")}
      canWriteEvidence={hasPermission(role, "evidence:write")}
    />
  );
}
