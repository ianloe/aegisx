import { redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { getSsoConfig } from "@/lib/auth/sso";
import { IntegrationsClient } from "@/components/integrations/IntegrationsClient";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await requirePageSession();
  const role = session.role as RoleCode;
  if (role !== "ADMIN" && role !== "GOVERNANCE_OFFICE") {
    redirect("/");
  }

  const [alertRules, telemetryKeys, assets] = await Promise.all([
    prisma.alertRule.findMany({ orderBy: { eventType: "asc" } }),
    prisma.telemetryApiKey.findMany({
      select: { id: true, name: true, keyPrefix: true, isActive: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aIAsset.findMany({
      select: { id: true, assetCode: true, name: true },
      orderBy: { assetCode: "asc" },
    }),
  ]);

  const ssoConfig = getSsoConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">API &amp; Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Manage Telemetry Ingestion API keys, automated Slack/Teams webhooks, Governance Digests, and Enterprise SSO
          configuration.
        </p>
      </div>

      <IntegrationsClient
        initialAlertRules={alertRules}
        initialTelemetryKeys={telemetryKeys.map((k) => ({
          ...k,
          lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
          createdAt: k.createdAt.toISOString(),
        }))}
        assets={assets}
        ssoConfig={ssoConfig}
        canEdit={hasPermission(role, "admin:config")}
      />
    </div>
  );
}
