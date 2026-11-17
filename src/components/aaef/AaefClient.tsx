"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, CalendarClock, CheckCircle2, FileText, Plus, Printer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { assignPerformanceProfile, ProfileDefinition } from "@/lib/governance/aaef-engine";
import { formatDate, formatDateTime, formatEnumLabel } from "@/lib/utils";

interface AgentAsset {
  id: string;
  assetCode: string;
  name: string;
  autonomyLevel: string;
  businessUnit: { name: string };
  owner: { name: string } | null;
  authorityRules: Array<{ id: string; decisionType: string; scopeDescription: string }>;
}

interface DimensionScoreRow {
  dimension:
    | "TASK_COMPETENCE"
    | "JUDGEMENT_QUALITY"
    | "BOUNDARY_ADHERENCE"
    | "COLLABORATION_EFFECTIVENESS"
    | "IMPROVEMENT_TRAJECTORY";
  score: number;
  boundaryPassed: boolean | null;
  rationale: string;
}

interface AppraisalRow {
  id: string;
  assetId: string;
  cycleType: "DAY_30" | "DAY_90" | "QUARTERLY" | "BIANNUAL";
  dueDate: string;
  completedAt: string | null;
  status: "SCHEDULED" | "DUE" | "OVERDUE" | "COMPLETED";
  computedTrajectory: "IMPROVING" | "STABLE" | "DEGRADING" | null;
  assignmentReason: string | null;
  consequenceAction: string | null;
  signedOffAt: string | null;
  notes: string | null;
  asset: { id: string; assetCode: string; name: string };
  assessor: { name: string } | null;
  signedOffBy: { name: string } | null;
  assignedProfile: { id: string; code: string; name: string; governanceConsequence: string; requiredAction: string } | null;
  overrideProfile: { id: string; code: string; name: string } | null;
  dimensionScores: DimensionScoreRow[];
}

interface BreachRow {
  id: string;
  assetId: string;
  occurredAt: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  remediation: string | null;
  status: string;
  asset: { assetCode: string; name: string };
  authorityRule: { decisionType: string; scopeDescription: string } | null;
  reportedBy: { name: string };
}

export function AaefClient({
  agents,
  profiles,
  appraisals,
  breaches,
  initialAssetId,
  canAppraise,
  canSignOff,
}: {
  agents: AgentAsset[];
  profiles: ProfileDefinition[];
  appraisals: AppraisalRow[];
  breaches: BreachRow[];
  initialAssetId?: string;
  canAppraise: boolean;
  canSignOff: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"appraisals" | "conduct" | "breaches" | "scheduler" | "template">("appraisals");
  const [selectedAgentId, setSelectedAgentId] = useState<string>(initialAssetId || agents[0]?.id || "");
  const [selectedAppraisalId, setSelectedAppraisalId] = useState<string>(
    appraisals.find((a) => a.status === "COMPLETED")?.id || ""
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Conduct Appraisal state
  const [cycleType, setCycleType] = useState<"DAY_30" | "DAY_90" | "QUARTERLY" | "BIANNUAL">("DAY_90");
  const [taskComp, setTaskComp] = useState(3.2);
  const [judgement, setJudgement] = useState(3.0);
  const [collaboration, setCollaboration] = useState(3.1);
  const [boundaryPassed, setBoundaryPassed] = useState(true);
  const [ratTask, setRatTask] = useState("");
  const [ratJudge, setRatJudge] = useState("");
  const [ratBound, setRatBound] = useState("");
  const [ratCollab, setRatCollab] = useState("");
  const [ratTraj, setRatTraj] = useState("");
  const [appraisalNotes, setAppraisalNotes] = useState("");

  // Breach form state
  const [breachSeverity, setBreachSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [breachRuleId, setBreachRuleId] = useState("");
  const [breachDesc, setBreachDesc] = useState("");
  const [breachRemediation, setBreachRemediation] = useState("");

  // Scheduler form state
  const [schedCycle, setSchedCycle] = useState<"DAY_30" | "DAY_90" | "QUARTERLY" | "BIANNUAL">("QUARTERLY");
  const [schedDueDate, setSchedDueDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const completedForAgent = useMemo(
    () => appraisals.filter((a) => a.assetId === selectedAgent?.id && a.status === "COMPLETED"),
    [appraisals, selectedAgent]
  );

  const prevCoreAvg = useMemo(() => {
    const prev = completedForAgent[0];
    if (!prev) return null;
    const core = prev.dimensionScores.filter((d) =>
      ["TASK_COMPETENCE", "JUDGEMENT_QUALITY", "COLLABORATION_EFFECTIVENESS"].includes(d.dimension)
    );
    if (core.length === 0) return null;
    return core.reduce((s, d) => s + d.score, 0) / core.length;
  }, [completedForAgent]);

  const livePreview = useMemo(() => {
    return assignPerformanceProfile(
      {
        taskCompetence: taskComp,
        judgementQuality: judgement,
        collaborationEffectiveness: collaboration,
        boundaryPassed,
        openBreachCount: boundaryPassed ? 0 : 1,
        previousAvgScore: prevCoreAvg,
      },
      profiles
    );
  }, [taskComp, judgement, collaboration, boundaryPassed, prevCoreAvg, profiles]);

  const dueOrOverdue = useMemo(
    () => appraisals.filter((a) => a.status !== "COMPLETED"),
    [appraisals]
  );

  const templateAppraisal = useMemo(
    () => appraisals.find((a) => a.id === selectedAppraisalId) || completedForAgent[0] || appraisals[0],
    [appraisals, selectedAppraisalId, completedForAgent]
  );

  function profileBadgeVariant(code: string | undefined) {
    if (code === "OPERATIONAL") return "success";
    if (code === "DEVELOPING") return "info";
    if (code === "RESTRICTED") return "warning";
    if (code === "UNDER_REVIEW") return "danger";
    return "secondary";
  }

  async function handleSubmitAppraisal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgent) return;
    setStatusMsg(null);
    setErrorMsg(null);

    const res = await fetch("/api/aaef/appraisals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "COMPLETE",
        assetId: selectedAgent.id,
        cycleType,
        taskCompetence: taskComp,
        judgementQuality: judgement,
        collaborationEffectiveness: collaboration,
        boundaryPassed,
        rationales: {
          taskCompetence: ratTask || "Evaluated against AAEF Task Competence rubric.",
          judgementQuality: ratJudge || "Evaluated against AAEF Judgement Quality rubric.",
          boundaryAdherence: ratBound || (boundaryPassed ? "Zero boundary breaches." : "Boundary breach observed."),
          collaborationEffectiveness: ratCollab || "Evaluated against AAEF Collaboration rubric.",
          improvementTrajectory: ratTraj || undefined,
        },
        notes: appraisalNotes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to record AAEF appraisal.");
      return;
    }

    setStatusMsg(
      `Completed ${formatEnumLabel(cycleType)} appraisal for ${selectedAgent.assetCode}. Profile assigned: ${data.evaluation.profile.name} (${data.evaluation.reason})`
    );
    setTab("appraisals");
    router.refresh();
  }

  async function handleLogBreach(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgent) return;
    setStatusMsg(null);
    setErrorMsg(null);

    const res = await fetch("/api/aaef/breaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: selectedAgent.id,
        authorityRuleId: breachRuleId || null,
        severity: breachSeverity,
        description: breachDesc,
        remediation: breachRemediation,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to log boundary breach.");
      return;
    }

    const changeNote = data.profileChange
      ? ` Profile automatically updated from ${data.profileChange.previousProfile || "None"} to ${data.profileChange.newProfile}: ${data.profileChange.reason}`
      : "";
    setStatusMsg(`Logged Boundary Breach on ${selectedAgent.assetCode}.${changeNote}`);
    setBreachDesc("");
    setBreachRemediation("");
    router.refresh();
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgent) return;
    setStatusMsg(null);
    setErrorMsg(null);

    const res = await fetch("/api/aaef/appraisals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "SCHEDULE",
        assetId: selectedAgent.id,
        cycleType: schedCycle,
        dueDate: schedDueDate,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to schedule appraisal.");
      return;
    }

    setStatusMsg(`Scheduled ${formatEnumLabel(schedCycle)} appraisal for ${selectedAgent.assetCode}.`);
    router.refresh();
  }

  async function handleSignOff(appraisal: AppraisalRow) {
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/aaef/appraisals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appraisalId: appraisal.id,
        consequenceAction:
          appraisal.consequenceAction ||
          appraisal.assignedProfile?.governanceConsequence ||
          "Standard governance oversight confirmed.",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Sign-off failed.");
      return;
    }
    setStatusMsg(`Recorded Governance Office sign-off for ${appraisal.asset.assetCode}.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AAEF Agent Appraisals</h1>
          <p className="text-sm text-muted-foreground">
            Workforce-style evaluation of AI agents across 30-day, 90-day, and ongoing appraisal horizons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="aaef-agent-select" className="text-xs font-medium text-muted-foreground">
            Active Agent:
          </label>
          <Select
            id="aaef-agent-select"
            className="w-64"
            value={selectedAgent?.id || ""}
            onChange={(e) => setSelectedAgentId(e.target.value)}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetCode} · {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: "appraisals", label: "Appraisal Register & Profiles" },
          { id: "conduct", label: "Run New Appraisal" },
          { id: "breaches", label: `Boundary Breaches (${breaches.length})` },
          { id: "scheduler", label: `Scheduler & Due Queue (${dueOrOverdue.length})` },
          { id: "template", label: "Printable Appraisal Form" },
        ].map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? "primary" : "outline"}
            onClick={() => setTab(t.id as typeof tab)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {statusMsg && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
        >
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
        >
          {errorMsg}
        </div>
      )}

      {/* TAB 1: Appraisal Register & Profiles */}
      {tab === "appraisals" && (
        <div className="space-y-4">
          {appraisals
            .filter((a) => a.status === "COMPLETED")
            .map((app) => {
              const profile = app.overrideProfile || app.assignedProfile;
              return (
                <Card key={app.id}>
                  <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">{app.asset.assetCode}</span>
                        <CardTitle>{app.asset.name}</CardTitle>
                        <Badge variant="outline">{formatEnumLabel(app.cycleType)}</Badge>
                        {profile && <Badge variant={profileBadgeVariant(profile.code)}>{profile.name}</Badge>}
                        {app.computedTrajectory && (
                          <Badge variant="secondary">
                            Trajectory: {formatEnumLabel(app.computedTrajectory)}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        Completed {formatDate(app.completedAt)} by {app.assessor?.name || "Assessor"}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAppraisalId(app.id);
                          setTab("template");
                        }}
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Form View
                      </Button>
                      {app.signedOffAt ? (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                          Signed off by {app.signedOffBy?.name || "Governance Office"}
                        </Badge>
                      ) : canSignOff ? (
                        <Button type="button" size="sm" onClick={() => handleSignOff(app)}>
                          Record Governance Sign-Off
                        </Button>
                      ) : (
                        <Badge variant="warning">Awaiting Sign-Off</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="rounded border border-border bg-surface-muted/40 p-3 space-y-1">
                      <div className="font-semibold">Why this Performance Profile was assigned:</div>
                      <p className="text-muted-foreground">{app.assignmentReason}</p>
                      <div className="pt-1">
                        <strong>Governance Consequence:</strong>{" "}
                        <span>{app.consequenceAction || app.assignedProfile?.governanceConsequence}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                      {app.dimensionScores.map((ds) => (
                        <div key={ds.dimension} className="rounded border border-border p-2.5 space-y-1">
                          <div className="font-medium text-[11px] text-muted-foreground">
                            {formatEnumLabel(ds.dimension)}
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {ds.dimension === "BOUNDARY_ADHERENCE" ? (
                              <Badge variant={ds.boundaryPassed ? "success" : "danger"}>
                                {ds.boundaryPassed ? "PASSED (Within Authority)" : "BREACHED"}
                              </Badge>
                            ) : (
                              `${ds.score.toFixed(1)} / 4.0`
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{ds.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* TAB 2: Conduct Appraisal */}
      {tab === "conduct" && selectedAgent && (
        <Card>
          <CardHeader>
            <CardTitle>Run AAEF Appraisal: {selectedAgent.assetCode} · {selectedAgent.name}</CardTitle>
            <CardDescription>
              Score all five AAEF dimensions. Improvement Trajectory and Performance Profile are computed transparently
              from live rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitAppraisal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Appraisal Horizon / Cycle</label>
                  <Select value={cycleType} onChange={(e) => setCycleType(e.target.value as typeof cycleType)}>
                    <option value="DAY_30">30-Day Appraisal</option>
                    <option value="DAY_90">90-Day Appraisal</option>
                    <option value="QUARTERLY">Ongoing Quarterly</option>
                    <option value="BIANNUAL">Ongoing Biannual</option>
                  </Select>
                </div>
                <div className="md:col-span-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Live Profile Assignment Preview:</span>
                    <Badge variant={profileBadgeVariant(livePreview.profile.code)}>
                      {livePreview.profile.name}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{livePreview.reason}</p>
                  <p className="text-[11px]">
                    <strong>Consequence:</strong> {livePreview.profile.governanceConsequence}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">1. Task Competence (0 to 4)</label>
                    <span className="text-xs font-mono">{taskComp.toFixed(1)}</span>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="4"
                    value={taskComp}
                    onChange={(e) => setTaskComp(Number(e.target.value))}
                  />
                  <Textarea
                    required
                    placeholder="Evidence of task accuracy, completion quality, and reliability..."
                    value={ratTask}
                    onChange={(e) => setRatTask(e.target.value)}
                  />
                </div>

                <div className="rounded border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">2. Judgement Quality (0 to 4)</label>
                    <span className="text-xs font-mono">{judgement.toFixed(1)}</span>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="4"
                    value={judgement}
                    onChange={(e) => setJudgement(Number(e.target.value))}
                  />
                  <Textarea
                    required
                    placeholder="Handling of ambiguity, uncertainty, and escalation triggers..."
                    value={ratJudge}
                    onChange={(e) => setRatJudge(e.target.value)}
                  />
                </div>

                <div className="rounded border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">3. Boundary Adherence (Binary)</label>
                    <Badge variant={boundaryPassed ? "success" : "danger"}>
                      {boundaryPassed ? "Stayed Within Authority" : "Breached Authority"}
                    </Badge>
                  </div>
                  <Select
                    value={boundaryPassed ? "true" : "false"}
                    onChange={(e) => setBoundaryPassed(e.target.value === "true")}
                  >
                    <option value="true">Pass: Stayed within sanctioned authority</option>
                    <option value="false">Fail: Boundary breach occurred in cycle</option>
                  </Select>
                  <Textarea
                    required
                    placeholder="Boundary telemetry verification note..."
                    value={ratBound}
                    onChange={(e) => setRatBound(e.target.value)}
                  />
                </div>

                <div className="rounded border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">4. Collaboration Effectiveness (0 to 4)</label>
                    <span className="text-xs font-mono">{collaboration.toFixed(1)}</span>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="4"
                    value={collaboration}
                    onChange={(e) => setCollaboration(Number(e.target.value))}
                  />
                  <Textarea
                    required
                    placeholder="Handoff clarity, explainability to human overseer, responsiveness..."
                    value={ratCollab}
                    onChange={(e) => setRatCollab(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    5. Improvement Trajectory (Computed from Prior Cycle:{" "}
                    {prevCoreAvg !== null ? `${prevCoreAvg.toFixed(2)}` : "Baseline"})
                  </span>
                  <Badge variant="outline">{formatEnumLabel(livePreview.trajectory)}</Badge>
                </div>
                <Input
                  placeholder="Optional commentary on trajectory trend..."
                  value={ratTraj}
                  onChange={(e) => setRatTraj(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Appraisal Summary &amp; Overseer Notes</label>
                <Textarea
                  value={appraisalNotes}
                  onChange={(e) => setAppraisalNotes(e.target.value)}
                  placeholder="Overall appraisal notes and conditions..."
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={!canAppraise}>
                  Complete AAEF Appraisal &amp; Assign Profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Boundary Breaches */}
      {tab === "breaches" && selectedAgent && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {canAppraise && (
            <Card className="lg:col-span-5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <CardTitle>Log Boundary Breach: {selectedAgent.assetCode}</CardTitle>
                </div>
                <CardDescription>
                  Logging a breach automatically re-evaluates the agent&apos;s AAEF Performance Profile and raises a
                  remediation action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogBreach} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Severity</label>
                    <Select
                      value={breachSeverity}
                      onChange={(e) => setBreachSeverity(e.target.value as typeof breachSeverity)}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Authority Rule Breached</label>
                    <Select value={breachRuleId} onChange={(e) => setBreachRuleId(e.target.value)}>
                      <option value="">General boundary violation</option>
                      {selectedAgent.authorityRules.map((r) => (
                        <option key={r.id} value={r.id}>
                          [{formatEnumLabel(r.decisionType)}] {r.scopeDescription}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Breach Description</label>
                    <Textarea
                      required
                      value={breachDesc}
                      onChange={(e) => setBreachDesc(e.target.value)}
                      placeholder="Describe what sanctioned boundary the agent crossed..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Immediate Remediation</label>
                    <Input
                      value={breachRemediation}
                      onChange={(e) => setBreachRemediation(e.target.value)}
                      placeholder="e.g. Revoked API token, reverted action, added deterministic check"
                    />
                  </div>
                  <Button type="submit" variant="danger" className="w-full">
                    Log Boundary Breach &amp; Re-evaluate Profile
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className={canAppraise ? "lg:col-span-7" : "lg:col-span-12"}>
            <CardHeader>
              <CardTitle>Boundary Breach Incident Log ({breaches.length})</CardTitle>
              <CardDescription>Traceable record of all agent authority violations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {breaches.length === 0 ? (
                <p className="text-muted-foreground">No boundary breaches recorded.</p>
              ) : (
                breaches.map((b) => (
                  <div key={b.id} className="rounded border border-border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        <span className="font-mono text-primary mr-1.5">{b.asset.assetCode}</span>
                        {b.asset.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={b.severity === "CRITICAL" || b.severity === "HIGH" ? "danger" : "warning"}>
                          {formatEnumLabel(b.severity)}
                        </Badge>
                        <span className="text-muted-foreground tabular-nums">{formatDateTime(b.occurredAt)}</span>
                      </div>
                    </div>
                    <p>{b.description}</p>
                    {b.authorityRule && (
                      <div className="text-[11px] text-muted-foreground">
                        Rule breached: [{formatEnumLabel(b.authorityRule.decisionType)}]{" "}
                        {b.authorityRule.scopeDescription}
                      </div>
                    )}
                    {b.remediation && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Remediation: {b.remediation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: Scheduler */}
      {tab === "scheduler" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {canAppraise && selectedAgent && (
            <Card className="lg:col-span-4">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Schedule Appraisal Cycle</CardTitle>
                </div>
                <CardDescription>Schedule 30-day, 90-day, quarterly, or biannual reviews</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSchedule} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Agent</label>
                    <Input disabled value={`${selectedAgent.assetCode} · ${selectedAgent.name}`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Cycle Horizon</label>
                    <Select
                      value={schedCycle}
                      onChange={(e) => setSchedCycle(e.target.value as typeof schedCycle)}
                    >
                      <option value="DAY_30">30-Day Review</option>
                      <option value="DAY_90">90-Day Review</option>
                      <option value="QUARTERLY">Ongoing Quarterly</option>
                      <option value="BIANNUAL">Ongoing Biannual</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Due Date</label>
                    <Input
                      type="date"
                      required
                      value={schedDueDate}
                      onChange={(e) => setSchedDueDate(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Schedule Appraisal
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className={canAppraise ? "lg:col-span-8" : "lg:col-span-12"}>
            <CardHeader>
              <CardTitle>Due &amp; Scheduled Appraisals ({dueOrOverdue.length})</CardTitle>
              <CardDescription>Automatically flags overdue and upcoming (within 14 days) appraisals</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Agent</th>
                    <th className="py-2.5 px-4 font-medium">Horizon</th>
                    <th className="py-2.5 px-4 font-medium">Due Date</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dueOrOverdue.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-4 font-medium">
                        <span className="font-mono text-primary mr-1.5">{item.asset.assetCode}</span>
                        {item.asset.name}
                      </td>
                      <td className="py-2.5 px-4">{formatEnumLabel(item.cycleType)}</td>
                      <td className="py-2.5 px-4 tabular-nums">{formatDate(item.dueDate)}</td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={
                            item.status === "OVERDUE"
                              ? "danger"
                              : item.status === "DUE"
                              ? "warning"
                              : "secondary"
                          }
                        >
                          {formatEnumLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAgentId(item.assetId);
                            setCycleType(item.cycleType);
                            setTab("conduct");
                          }}
                        >
                          Run Now
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {dueOrOverdue.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No pending scheduled appraisals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: Printable Appraisal Form Template */}
      {tab === "template" && templateAppraisal && (
        <Card className="max-w-4xl mx-auto print:shadow-none print:border-black">
          <CardHeader className="border-b border-border flex-row items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                AAEF Official Appraisal Record (CC BY-NC 4.0 Ian Loe, Tactics Solutions)
              </div>
              <CardTitle className="text-lg mt-0.5">
                AI Agent Performance Appraisal: {templateAppraisal.asset.assetCode} · {templateAppraisal.asset.name}
              </CardTitle>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print Appraisal Form
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-border pb-4">
              <div>
                <div className="text-muted-foreground">Appraisal Horizon</div>
                <div className="font-semibold mt-0.5">{formatEnumLabel(templateAppraisal.cycleType)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Completed Date</div>
                <div className="font-semibold mt-0.5">{formatDate(templateAppraisal.completedAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Assigned Profile</div>
                <div className="font-semibold mt-0.5">
                  {templateAppraisal.assignedProfile?.name || "Pending"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Improvement Trajectory</div>
                <div className="font-semibold mt-0.5">
                  {templateAppraisal.computedTrajectory
                    ? formatEnumLabel(templateAppraisal.computedTrajectory)
                    : "Baseline"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-sm">Five-Dimension Evaluation</div>
              <table className="w-full border border-border border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-muted/60 border-b border-border">
                    <th className="p-2.5 text-left">AAEF Dimension</th>
                    <th className="p-2.5 text-left">Rating / Outcome</th>
                    <th className="p-2.5 text-left">Assessor Rationale &amp; Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {templateAppraisal.dimensionScores.map((ds) => (
                    <tr key={ds.dimension} className="border-b border-border">
                      <td className="p-2.5 font-medium">{formatEnumLabel(ds.dimension)}</td>
                      <td className="p-2.5 tabular-nums font-semibold">
                        {ds.dimension === "BOUNDARY_ADHERENCE"
                          ? ds.boundaryPassed
                            ? "PASS (Within Sanctioned Authority)"
                            : "FAIL (Boundary Breach)"
                          : `${ds.score.toFixed(1)} / 4.0`}
                      </td>
                      <td className="p-2.5">{ds.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded border border-border p-4 space-y-2">
              <div className="font-semibold">Profile Assignment Rationale</div>
              <p>{templateAppraisal.assignmentReason}</p>
              <div className="pt-2 border-t border-border">
                <strong>Required Governance Consequence:</strong>{" "}
                <span>
                  {templateAppraisal.consequenceAction ||
                    templateAppraisal.assignedProfile?.governanceConsequence}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border">
              <div>
                <div className="text-muted-foreground">Assessed By</div>
                <div className="font-semibold mt-1">{templateAppraisal.assessor?.name || "Assessor"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Governance Office Sign-Off</div>
                <div className="font-semibold mt-1">
                  {templateAppraisal.signedOffAt
                    ? `${templateAppraisal.signedOffBy?.name || "Signed"} on ${formatDate(templateAppraisal.signedOffAt)}`
                    : "Pending Sign-Off"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
