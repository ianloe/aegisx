import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatEnumLabel } from "@/lib/utils";
import { AssetGatePanel } from "@/components/assets/AssetGatePanel";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageSession();
  const role = session.role as RoleCode;

  const asset = await prisma.aIAsset.findUnique({
    where: { id },
    include: {
      businessUnit: true,
      owner: { select: { name: true, email: true } },
      overseer: { select: { name: true, email: true } },
      frameAssessments: {
        orderBy: { assessedAt: "desc" },
        take: 1,
        include: { scores: { include: { criterion: true } } },
      },
      authorityRules: { where: { isActive: true }, orderBy: { decisionType: "asc" } },
      aaefAppraisals: {
        orderBy: { dueDate: "desc" },
        include: { assignedProfile: true, overrideProfile: true },
      },
      boundaryBreaches: { orderBy: { occurredAt: "desc" }, take: 5 },
      risks: { orderBy: { riskCode: "asc" } },
      incidents: { orderBy: { occurredAt: "desc" }, take: 5 },
      costItems: true,
      benefitItems: true,
      actions: { orderBy: { dueDate: "asc" } },
      stageGateRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: { select: { name: true } },
          reviewedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!asset) notFound();

  const evidence = await prisma.evidence.findMany({
    where: { entityType: "ASSET", entityId: asset.id },
    orderBy: { createdAt: "desc" },
  });

  const latestFrame = asset.frameAssessments[0];
  const latestCompletedAppraisal = asset.aaefAppraisals.find((a) => a.status === "COMPLETED");
  const activeProfile = latestCompletedAppraisal?.overrideProfile || latestCompletedAppraisal?.assignedProfile;

  const totalCost = asset.costItems.reduce((sum, c) => sum + c.amount, 0);
  const measuredBenefit = asset.benefitItems
    .filter((b) => b.confidence === "MEASURED")
    .reduce((sum, b) => sum + b.actualAmount, 0);
  const estimatedOrAssumedBenefit = asset.benefitItems
    .filter((b) => b.confidence !== "MEASURED")
    .reduce((sum, b) => sum + (b.actualAmount > 0 ? b.actualAmount : b.plannedAmount), 0);

  const missingRoles = !asset.ownerId || !asset.overseerId || !asset.escalationPath;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/assets" className="text-xs text-muted-foreground hover:underline">
              AI Asset Register
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="font-mono text-xs">{asset.assetCode}</span>
            {asset.isAgent && <Badge variant="info">AI Agent</Badge>}
            <Badge variant={asset.lifecycleStage === "PRODUCTION" ? "success" : "secondary"}>
              {formatEnumLabel(asset.lifecycleStage)}
            </Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight mt-1">{asset.name}</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">{asset.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/frame?assetId=${asset.id}`}>
            <Button type="button" variant="outline" size="sm">
              Open FRAME Assessment
            </Button>
          </Link>
          {asset.isAgent && (
            <Link href={`/aaef?assetId=${asset.id}`}>
              <Button type="button" size="sm">
                Open AAEF Appraisals
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Metadata Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Business Unit</div>
            <div className="text-xs font-medium mt-0.5">{asset.businessUnit.name}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Country / Jurisdictions</div>
            <div className="text-xs font-medium mt-0.5">{asset.jurisdictions.join(", ")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Autonomy Level</div>
            <div className="text-xs font-medium mt-0.5">{formatEnumLabel(asset.autonomyLevel)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Data Sensitivity</div>
            <div className="text-xs font-medium mt-0.5">{formatEnumLabel(asset.dataSensitivity)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Sourcing</div>
            <div className="text-xs font-medium mt-0.5">
              {asset.sourcingType === "VENDOR" ? `Vendor (${asset.vendorName || "Unnamed"})` : "In-house"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground">Roles Status</div>
            <div className="mt-0.5">
              {missingRoles ? (
                <Badge variant="danger">Incomplete Roles</Badge>
              ) : (
                <Badge variant="success">Assigned</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FRAME Envelope wrapping AAEF */}
      <Card className="border-2 border-primary/25">
        <CardHeader className="bg-surface-muted/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                FRAME Governance Envelope
              </div>
              <CardTitle className="mt-0.5">
                {latestFrame
                  ? `Latest Overall Maturity: ${latestFrame.overallScore.toFixed(2)} / 4.00 (${formatDate(latestFrame.assessedAt)})`
                  : "No FRAME assessment recorded yet"}
              </CardTitle>
            </div>
            <div className="text-xs text-muted-foreground">
              Owner: <strong>{asset.owner?.name || "Unassigned"}</strong> · Overseer:{" "}
              <strong>{asset.overseer?.name || "Unassigned"}</strong>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded border border-border p-3">
              <div className="font-semibold mb-1">Active Authority Rules ({asset.authorityRules.length})</div>
              {asset.authorityRules.length === 0 ? (
                <p className="text-muted-foreground">No authority decision-rights rules defined.</p>
              ) : (
                <ul className="space-y-1">
                  {asset.authorityRules.slice(0, 3).map((r) => (
                    <li key={r.id}>
                      <Badge variant="outline" className="mr-1.5">
                        {formatEnumLabel(r.decisionType)}
                      </Badge>
                      <span>{r.scopeDescription}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded border border-border p-3">
              <div className="font-semibold mb-1">Escalation Path</div>
              <p className="text-muted-foreground">{asset.escalationPath || "Not documented (flag for action)."}</p>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Roles last reviewed: {formatDate(asset.rolesLastReviewedAt)}
              </div>
            </div>

            <div className="rounded border border-border p-3">
              <div className="font-semibold mb-1">ROI Snapshot (SGD)</div>
              <div className="tabular-nums">Total Cost: {formatCurrency(totalCost, "SGD")}</div>
              <div className="tabular-nums text-emerald-700 dark:text-emerald-400">
                Measured Benefit: {formatCurrency(measuredBenefit, "SGD")}
              </div>
              <div className="tabular-nums text-amber-700 dark:text-amber-400">
                Estimated / Assumed: {formatCurrency(estimatedOrAssumedBenefit, "SGD")}
              </div>
            </div>
          </div>

          {asset.isAgent && (
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    AAEF Agent Evaluation (Inside FRAME Envelope)
                  </div>
                  <div className="text-sm font-semibold mt-0.5">
                    Current Performance Profile:{" "}
                    {activeProfile ? (
                      <Badge
                        variant={
                          activeProfile.code === "OPERATIONAL"
                            ? "success"
                            : activeProfile.code === "DEVELOPING"
                            ? "info"
                            : activeProfile.code === "RESTRICTED"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {activeProfile.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Awaiting First Appraisal</Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Trajectory:{" "}
                  <strong>
                    {latestCompletedAppraisal?.computedTrajectory
                      ? formatEnumLabel(latestCompletedAppraisal.computedTrajectory)
                      : "Pending"}
                  </strong>{" "}
                  · Boundary Breaches: <strong>{asset.boundaryBreaches.length}</strong>
                </div>
              </div>
              {latestCompletedAppraisal?.assignmentReason && (
                <p className="text-xs text-muted-foreground">
                  <strong>Rationale:</strong> {latestCompletedAppraisal.assignmentReason}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Risks, Incidents, Actions & Evidence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Linked Risks ({asset.risks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {asset.risks.length === 0 ? (
              <p className="text-muted-foreground">No risks logged against this asset.</p>
            ) : (
              asset.risks.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-border last:border-0 pb-1.5">
                  <div>
                    <span className="font-mono font-medium mr-1.5">{r.riskCode}</span>
                    <span>{r.title}</span>
                  </div>
                  <Badge variant={r.residualLikelihood * r.residualImpact > 12 ? "danger" : "outline"}>
                    {r.residualLikelihood * r.residualImpact}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Incidents ({asset.incidents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {asset.incidents.length === 0 ? (
              <p className="text-muted-foreground">No incidents recorded.</p>
            ) : (
              asset.incidents.map((inc) => (
                <div key={inc.id} className="flex items-center justify-between border-b border-border last:border-0 pb-1.5">
                  <span className="truncate pr-2">{inc.title}</span>
                  <Badge variant={inc.severity === "HIGH" || inc.severity === "CRITICAL" ? "danger" : "warning"}>
                    {formatEnumLabel(inc.severity)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence &amp; Actions ({evidence.length} / {asset.actions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {evidence.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="truncate">{ev.title}</span>
                <Badge variant="info">{ev.type}</Badge>
              </div>
            ))}
            {asset.actions.map((act) => (
              <div key={act.id} className="flex items-center justify-between border-b border-border last:border-0 pb-1.5">
                <span className="truncate pr-2">{act.title}</span>
                <Badge variant={act.status === "DONE" ? "success" : "warning"}>
                  {formatEnumLabel(act.status)}
                </Badge>
              </div>
            ))}
            {evidence.length === 0 && asset.actions.length === 0 && (
              <p className="text-muted-foreground">No evidence or open actions attached.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AssetGatePanel
        assetId={asset.id}
        currentLifecycleStage={asset.lifecycleStage}
        currentAutonomyLevel={asset.autonomyLevel}
        initialRequests={asset.stageGateRequests.map((g) => ({
          ...g,
          createdAt: g.createdAt.toISOString(),
          readinessSnapshotJson: g.readinessSnapshotJson as { checks?: Array<{ label: string; passed: boolean; detail?: string }> },
        }))}
        canRequest={hasPermission(role, "assets:write")}
        canApprove={hasPermission(role, "aaef:signoff")}
      />
    </div>
  );
}
