import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const [assetCount, agentCount, assessmentCount, appraisalCount, riskCount, incidentCount, openActions, recentAudit] =
    await Promise.all([
      prisma.aIAsset.count(),
      prisma.aIAsset.count({ where: { isAgent: true } }),
      prisma.frameAssessment.count(),
      prisma.aaefAppraisal.count({ where: { status: "COMPLETED" } }),
      prisma.risk.count({ where: { status: { not: "CLOSED" } } }),
      prisma.incident.count({ where: { status: { not: "CLOSED" } } }),
      prisma.action.count({ where: { status: { not: "DONE" } } }),
      prisma.auditLogEntry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const kpis = [
    { label: "AI Assets Registered", value: assetCount, sub: `${agentCount} flagged as agents`, href: "/assets" },
    { label: "FRAME Assessments", value: assessmentCount, sub: "Governance envelope profiles", href: "/frame" },
    { label: "AAEF Appraisals", value: appraisalCount, sub: "Completed agent cycles", href: "/aaef" },
    { label: "Active Risks", value: riskCount, sub: `${incidentCount} open/active incidents`, href: "/risks" },
    { label: "Open Actions", value: openActions, sub: "Tracked to owner & due date", href: "/evidence" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Executive Governance Overview</h1>
          <p className="text-sm text-muted-foreground">
            Single evidence-based view of enterprise AI performance, risk posture, and governance compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">FRAME Envelope</Badge>
          <span className="text-xs text-muted-foreground">governs</span>
          <Badge variant="default">AAEF Agent Appraisal</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="block group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardContent className="p-4 space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{kpi.label}</div>
                <div className="text-2xl font-semibold tabular-nums">{kpi.value}</div>
                <div className="text-[11px] text-muted-foreground">{kpi.sub}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Framework Architecture: FRAME &amp; AAEF</CardTitle>
            <CardDescription>How enterprise governance wraps individual agent evaluation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border border-border bg-surface-muted/50 p-3 space-y-1">
              <div className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                Outer Envelope: FRAME (All AI Assets)
              </div>
              <p className="text-xs text-foreground">
                Defines <strong>Focus</strong>, <strong>Roles</strong>, <strong>Authority</strong> (autonomous,
                human-confirmed, out of scope), <strong>Metrics</strong> (activity vs outcome), and{" "}
                <strong>Evaluation</strong> for every AI asset.
              </p>
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1">
              <div className="font-medium text-xs uppercase tracking-wider text-primary">
                Inner Evaluation: AAEF (AI Agents)
              </div>
              <p className="text-xs text-foreground">
                Appraises AI agents on 30-day, 90-day, and ongoing cycles across Task Competence, Judgement Quality,
                binary Boundary Adherence, Collaboration Effectiveness, and Improvement Trajectory, assigning{" "}
                <strong>Operational</strong>, <strong>Developing</strong>, <strong>Restricted</strong>, or{" "}
                <strong>Under Review</strong> profiles.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Trail</CardTitle>
            <CardDescription>Immutable log of governance mutations</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAudit.length === 0 ? (
              <p className="text-xs text-muted-foreground">No audit entries recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {recentAudit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 text-xs border-b border-border last:border-0 pb-2 last:pb-0"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{entry.action}</span>{" "}
                      <span className="text-muted-foreground">
                        on {entry.entityType} ({entry.entityId.slice(0, 10)})
                      </span>
                      <div className="text-[11px] text-muted-foreground truncate">{entry.actorEmail}</div>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
