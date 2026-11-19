"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatEnumLabel } from "@/lib/utils";

interface GateCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

interface GateRequestRow {
  id: string;
  targetLifecycleStage: string;
  targetAutonomyLevel: string;
  status: string;
  readinessPassed: boolean;
  readinessSnapshotJson: { checks?: GateCheck[] };
  justification: string | null;
  decisionNotes: string | null;
  createdAt: string;
  requestedBy: { name: string };
  reviewedBy: { name: string } | null;
}

export function AssetGatePanel({
  assetId,
  currentLifecycleStage,
  currentAutonomyLevel,
  initialRequests,
  canRequest,
  canApprove,
}: {
  assetId: string;
  currentLifecycleStage: string;
  currentAutonomyLevel: string;
  initialRequests: GateRequestRow[];
  canRequest: boolean;
  canApprove: boolean;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [targetStage, setTargetStage] = useState(
    currentLifecycleStage === "IDEA" ? "PILOT" : "PRODUCTION",
  );
  const [targetAutonomy, setTargetAutonomy] = useState(currentAutonomyLevel);
  const [justification, setJustification] = useState("");
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submitGate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/gates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        targetLifecycleStage: targetStage,
        targetAutonomyLevel: targetAutonomy,
        justification,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Failed to submit stage-gate request.");
      return;
    }
    setRequests((prev) => [data.request, ...prev]);
    setJustification("");
    setMsg("Stage-gate promotion request submitted with automated readiness snapshot.");
  }

  async function decideGate(id: string, decision: "APPROVED" | "REJECTED") {
    setMsg(null);
    setErr(null);
    const notes = decisionNotes[id]?.trim() || (decision === "APPROVED" ? "Approved." : "Returned for remediation.");
    const res = await fetch("/api/gates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, decisionNotes: notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Failed to decide stage-gate request.");
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? data.request : r)));
    setMsg(`Stage-gate request ${decision.toLowerCase()}.`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle Stage-Gate Approvals</CardTitle>
        <CardDescription>
          Request promotion across lifecycle stages or autonomy levels with automated FRAME and AAEF readiness checks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {canRequest && (
          <form onSubmit={submitGate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-medium block mb-1">Target Lifecycle Stage</label>
              <Select value={targetStage} onChange={(e) => setTargetStage(e.target.value)}>
                <option value="PILOT">Pilot</option>
                <option value="PRODUCTION">Production</option>
                <option value="RETIRED">Retired</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Target Autonomy Level</label>
              <Select value={targetAutonomy} onChange={(e) => setTargetAutonomy(e.target.value)}>
                <option value="ASSISTIVE">Assistive</option>
                <option value="HUMAN_IN_THE_LOOP">Human-in-the-Loop</option>
                <option value="HUMAN_ON_THE_LOOP">Human-on-the-Loop</option>
                <option value="AUTONOMOUS">Autonomous</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Justification / Evidence Summary</label>
              <Input
                required
                minLength={4}
                placeholder="Pilot results, controls verified..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
            </div>
            <Button type="submit">Request Stage-Gate</Button>
          </form>
        )}

        <div className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-xs text-muted-foreground">No stage-gate requests recorded for this asset.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">
                      Target: {formatEnumLabel(r.targetLifecycleStage)} ({formatEnumLabel(r.targetAutonomyLevel)})
                    </span>
                    <span className="text-muted-foreground ml-2">
                      by {r.requestedBy.name} on {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.readinessPassed ? "success" : "warning"}>
                      {r.readinessPassed ? "Readiness Passed" : "Readiness Gaps"}
                    </Badge>
                    <Badge
                      variant={
                        r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "info"
                      }
                    >
                      {formatEnumLabel(r.status)}
                    </Badge>
                  </div>
                </div>
                {r.justification && <p className="text-muted-foreground">{r.justification}</p>}
                <div className="flex flex-wrap gap-2">
                  {(r.readinessSnapshotJson?.checks || []).map((c, idx) => (
                    <Badge key={idx} variant={c.passed ? "outline" : "danger"}>
                      {c.passed ? "✓" : "✕"} {c.label}
                    </Badge>
                  ))}
                </div>
                {r.decisionNotes && (
                  <p className="text-[11px] text-muted-foreground">
                    Decision ({r.reviewedBy?.name || "Governance Office"}): {r.decisionNotes}
                  </p>
                )}
                {r.status === "PENDING" && canApprove && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                    <Input
                      placeholder="Approval / rejection notes..."
                      value={decisionNotes[r.id] || ""}
                      onChange={(e) => setDecisionNotes({ ...decisionNotes, [r.id]: e.target.value })}
                      className="max-w-sm h-7 text-xs"
                    />
                    <Button type="button" size="sm" onClick={() => decideGate(r.id, "APPROVED")}>
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="danger" onClick={() => decideGate(r.id, "REJECTED")}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
