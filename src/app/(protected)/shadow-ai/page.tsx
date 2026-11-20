import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ShadowAiClient } from "@/components/shadow-ai/ShadowAiClient";

export const dynamic = "force-dynamic";

export default async function ShadowAiPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role, "assets:read")) redirect("/");

  const candidates = await prisma.shadowAiCandidate.findMany({
    include: {
      matchedAsset: {
        select: { id: true, assetCode: true, name: true, lifecycleStage: true },
      },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const canTriage =
    hasPermission(session.role, "aaef:signoff") || hasPermission(session.role, "admin:config");
  const canSimulate = hasPermission(session.role, "admin:config");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shadow AI Discovery &amp; Visibility</h1>
        <p className="text-sm text-muted-foreground">
          Capture unregistered AI services from SASE/SWG traffic, DNS resolver logs, and IdP OAuth grants, then promote or block them.
        </p>
      </div>
      <ShadowAiClient
        initialCandidates={candidates.map((c) => ({
          id: c.id,
          domain: c.domain,
          providerName: c.providerName,
          category: c.category,
          source: c.source,
          businessUnit: c.businessUnit,
          requestCount: c.requestCount,
          bytesUploaded: c.bytesUploaded,
          uniqueUsers: c.uniqueUsers,
          status: c.status,
          matchedAsset: c.matchedAsset,
          notes: c.notes,
          firstSeenAt: c.firstSeenAt.toISOString(),
          lastSeenAt: c.lastSeenAt.toISOString(),
        }))}
        canTriage={canTriage}
        canSimulate={canSimulate}
      />
    </div>
  );
}
