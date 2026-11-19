import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { VendorsClient } from "@/components/vendors/VendorsClient";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const session = await requirePageSession();
  const canEdit = hasPermission(session.role as RoleCode, "assets:write");

  const assets = await prisma.aIAsset.findMany({
    where: { sourcingType: "VENDOR" },
    include: {
      businessUnit: { select: { name: true } },
      vendorAssessment: {
        include: { reviewer: { select: { name: true } } },
      },
    },
    orderBy: { assetCode: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Vendor &amp; Third-Party AI Due Diligence</h1>
        <p className="text-sm text-muted-foreground">
          Assess external AI providers for data residency, zero-data-retention guarantees, sub-processors, and exit
          portability.
        </p>
      </div>
      <VendorsClient
        initialAssets={assets.map((a) => ({
          ...a,
          vendorAssessment: a.vendorAssessment
            ? {
                ...a.vendorAssessment,
                contractRenewalDate: a.vendorAssessment.contractRenewalDate
                  ? a.vendorAssessment.contractRenewalDate.toISOString()
                  : null,
                lastReviewedAt: a.vendorAssessment.lastReviewedAt
                  ? a.vendorAssessment.lastReviewedAt.toISOString()
                  : null,
              }
            : null,
        }))}
        canEdit={canEdit}
      />
    </div>
  );
}
