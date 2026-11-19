import { redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { getSsoConfig } from "@/lib/auth/sso";
import { AdminClient } from "@/components/admin/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requirePageSession();
  const role = session.role as RoleCode;
  if (role !== "ADMIN" && role !== "GOVERNANCE_OFFICE") {
    redirect("/");
  }

  const [configs, criteria, profiles, users, roles, businessUnits, alertRules, telemetryKeys, assets] =
    await Promise.all([
      prisma.governanceConfig.findMany({ orderBy: { key: "asc" } }),
      prisma.frameCriterion.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.performanceProfile.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          role: { select: { id: true, code: true, name: true } },
          businessUnit: { select: { id: true, code: true, name: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.role.findMany({ orderBy: { name: "asc" } }),
      prisma.businessUnit.findMany({
        include: { _count: { select: { assets: true, users: true } } },
        orderBy: { name: "asc" },
      }),
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
        <h1 className="text-xl font-semibold tracking-tight">Administration &amp; Governance Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Edit scoring rubrics, AAEF profile rules, risk appetite thresholds, financial defaults, business units,
          alerts, telemetry integrations, and user roles without code changes.
        </p>
      </div>

      <AdminClient
        initialConfigs={configs.map((c) => ({ ...c, valueJson: c.valueJson as Record<string, unknown> }))}
        initialCriteria={criteria.map((c) => ({ ...c, rubricJson: c.rubricJson as Record<string, string> }))}
        initialProfiles={profiles.map((p) => ({
          ...p,
          ruleConfigJson: p.ruleConfigJson as Record<string, unknown>,
        }))}
        initialUsers={users}
        roles={roles}
        businessUnits={businessUnits}
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
