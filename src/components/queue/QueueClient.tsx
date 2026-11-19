"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEnumLabel } from "@/lib/utils";

interface GateCheck {
  key?: string;
  label: string;
  passed: boolean;
  detail?: string;
}

interface GateItem {
  id: string;
  status: string;
  targetLifecycleStage: string;
  targetAutonomyLevel: string;
  readinessPassed: boolean;
  readinessSnapshotJson: { checks?: GateCheck[] };
  justification: string | null;
  createdAt: string;
  asset: { id: string; assetCode: string; name: string; lifecycleStage: string; autonomyLevel: string };
  requestedBy: { name: string; email: string };
}

interface ActionItem {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  sourceType: string;
  asset: { id: string; assetCode: string; name: string } | null;
}

interface AppraisalSignoffItem {
  id: string;
  cycleType: string;
  appraisalDate: string;
  asset: { id: string; assetCode: string; name: string };
  assignedProfile: { name: string };
}

interface RiskReviewItem {
  id: string;
  riskCode: string;
  title: string;
  reviewDate: string;
  residualScore: number;
  asset: { id: string; assetCode: string; name: string };
}

interface LapsedAssetItem {
  id: string;
  assetCode: string;
  name: string;
  rolesLastReviewedAt: string | null;
}

export function QueueClient({
  initialGates,
  initialActions,
  pendingSignoffs,
  overdueRisks,
  lapsedAssets,
  canApproveGates,
}: {
  initialGates: GateItem[];
  initialActions: ActionItem[];
  pendingSignoffs: AppraisalSignoffItem[];
  overdueRisks: RiskReviewItem[];
  lapsedAssets: LapsedAssetItem[];
  canApproveGates: boolean;
}) {
  const [gates, setGates] = useState(initialGates);
  const [actions, setActions] = useState(initialActions);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decideGate(id: string, decision: "APPROVED" | "REJECTED") {
    setMsg(null);
    setErr(null);
    const notes = decisionNotes[id]?.trim() || (decision === "APPROVED" ? "Approved by Governance Office." : "Returned for remediation.");
    const res = await fetch("/api/gates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, decisionNotes: notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Failed to record gate decision.");
      return;
    }
    setGates((prev) => prev.filter((g) => g.id !== id));
    setMsg(`Stage-gate request ${decision.toLowerCase()} and logged.`);
  }

  async function markActionDone(id: string) {
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "DONE" }),
    });
    if (res.ok) {
      setActions((prev) => prev.filter((a) => a.id !== id));
      setMsg("Action marked as Done.");
    } else {
      const data = await res.json();
      setErr(data.error || "Failed to update action.");
    }
  }

  const now = Date.now();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Pending Stage-Gates</div>
            <div className="text-2xl font-semibold mt-1">{gates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">My Open Actions</div>
            <div className="text-2xl font-semibold mt-1">{actions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">AAEF Sign-Offs Due</div>
            <div className="text-2xl font-semibold mt-1">{pendingSignoffs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Overdue Risk Reviews</div>
            <div className="text-2xl font-semibold mt-1 text-amber-600">{overdueRisks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Lapsed Role Reviews</div>
            <div className="text-2xl font-semibold mt-1 text-amber-600">{lapsedAssets.length}</div>
          </CardContent>
        </Card>
      </div>

      {msg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
          {err}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pending Lifecycle Stage-Gate Approvals ({gates.length})</CardTitle>
          <CardDescription>
            Promotion requests to Pilot, Production, or Autonomous execution with automated FRAME &amp; AAEF readiness checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {gates.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending stage-gate approvals.</p>
          ) : (
            gates.map((g) => (
              <div key={g.id} className="rounded-md border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/assets/${g.asset.id}`} className="text-sm font-semibold hover:underline">
                      {g.asset.assetCode}: {g.asset.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Requested by {g.requestedBy.name} · {formatEnumLabel(g.asset.lifecycleStage)} →{" "}
                      <strong>{formatEnumLabel(g.targetLifecycleStage)}</strong> ({formatEnumLabel(g.targetAutonomyLevel)})
                    </p>
                  </div>
                  <Badge variant={g.readinessPassed ? "success" : "warning"}>
                    {g.readinessPassed ? "All Readiness Checks Passed" : "Readiness Gaps Detected"}
                  </Badge>
                </div>

                {g.justification && <p className="text-xs text-foreground">{g.justification}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(g.readinessSnapshotJson?.checks || []).map((c, idx) => (
                    <div key={idx} className="rounded border border-border bg-surface-muted/40 p-2 text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium">{c.label}</span>
                        <Badge variant={c.passed ? "success" : "danger"}>{c.passed ? "Pass" : "Fail"}</Badge>
                      </div>
                      {c.detail && <p className="text-[11px] text-muted-foreground mt-1">{c.detail}</p>}
                    </div>
                  ))}
                </div>

                {canApproveGates && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                    <Input
                      placeholder="Decision notes / conditions..."
                      value={decisionNotes[g.id] || ""}
                      onChange={(e) => setDecisionNotes({ ...decisionNotes, [g.id]: e.target.value })}
                      className="max-w-md h-8 text-xs"
                    />
                    <Button type="button" size="sm" onClick={() => decideGate(g.id, "APPROVED")}>
                      Approve Promotion
                    </Button>
                    <Button type="button" size="sm" variant="danger" onClick={() => decideGate(g.id, "REJECTED")}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Open Actions ({actions.length})</CardTitle>
            <CardDescription>Assigned remediation and governance tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open actions assigned to you.</p>
            ) : (
              actions.map((a) => {
                const overdue = new Date(a.dueDate).getTime() < now;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded border border-border p-2.5 text-xs">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.asset ? `${a.asset.assetCode} · ` : ""}Due {new Date(a.dueDate).toLocaleDateString()}
                        {overdue && <span className="text-red-600 font-medium ml-1">(Overdue)</span>}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => markActionDone(a.id)}>
                      Mark Done
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending AAEF Sign-Offs ({pendingSignoffs.length})</CardTitle>
            <CardDescription>Agent appraisals awaiting Governance Office sign-off</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingSignoffs.length === 0 ? (
              <p className="text-xs text-muted-foreground">All AAEF appraisals have been signed off.</p>
            ) : (
              pendingSignoffs.map((s) => (
                <Link
                  key={s.id}
                  href="/aaef"
                  className="flex items-center justify-between rounded border border-border p-2.5 text-xs hover:bg-surface-muted/40"
                >
                  <div>
                    <div className="font-medium">
                      {s.asset.assetCode}: {s.asset.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatEnumLabel(s.cycleType)} · {new Date(s.appraisalDate).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="warning">{s.assignedProfile.name}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Overdue Risk Reviews ({overdueRisks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueRisks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No overdue risk reviews.</p>
            ) : (
              overdueRisks.map((r) => (
                <Link
                  key={r.id}
                  href="/risks"
                  className="flex items-center justify-between rounded border border-border p-2.5 text-xs hover:bg-surface-muted/40"
                >
                  <div>
                    <div className="font-medium">
                      {r.riskCode}: {r.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.asset.assetCode} · Review due {new Date(r.reviewDate).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="danger">Residual {r.residualScore}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets with Lapsed Role Reviews ({lapsedAssets.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lapsedAssets.length === 0 ? (
              <p className="text-xs text-muted-foreground">All your assigned assets have current role reviews.</p>
            ) : (
              lapsedAssets.map((a) => (
                <Link
                  key={a.id}
                  href={`/assets/${a.id}`}
                  className="flex items-center justify-between rounded border border-border p-2.5 text-xs hover:bg-surface-muted/40"
                >
                  <span className="font-medium">
                    {a.assetCode}: {a.name}
                  </span>
                  <Badge variant="warning">
                    {a.rolesLastReviewedAt
                      ? `Last reviewed ${new Date(a.rolesLastReviewedAt).toLocaleDateString()}`
                      : "Never reviewed"}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
