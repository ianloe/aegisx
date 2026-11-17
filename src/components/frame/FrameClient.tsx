"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Plus, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FrameRadarChart } from "@/components/frame/FrameRadarChart";
import { computeFrameSummary, evaluateRoleHealth } from "@/lib/governance/frame-scoring";
import { formatDate, formatEnumLabel } from "@/lib/utils";

interface Criterion {
  id: string;
  dimension: "FOCUS" | "ROLES" | "AUTHORITY" | "METRICS" | "EVALUATION";
  code: string;
  title: string;
  description: string;
  rubricJson: Record<string, string>;
  isPlaceholder: boolean;
}

interface ScoreRow {
  criterionId: string;
  score: number;
  rationale: string;
  metricClassification: "ACTIVITY" | "OUTCOME" | "BOTH" | "NONE";
  evidenceNote: string | null;
  criterion: { dimension: "FOCUS" | "ROLES" | "AUTHORITY" | "METRICS" | "EVALUATION"; code: string; title: string };
}

interface AssessmentRow {
  id: string;
  assetId: string;
  assessedAt: string;
  overallScore: number;
  notes: string | null;
  assessor: { name: string };
  scores: ScoreRow[];
}

interface AuthorityRuleRow {
  id: string;
  assetId: string;
  version: number;
  decisionType: "AUTONOMOUS" | "HUMAN_CONFIRMED" | "OUT_OF_SCOPE";
  scopeDescription: string;
  conditions: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AssetSummary {
  id: string;
  assetCode: string;
  name: string;
  ownerId: string | null;
  overseerId: string | null;
  escalationPath: string | null;
  rolesLastReviewedAt: string | null;
  owner: { name: string } | null;
  overseer: { name: string } | null;
  businessUnit: { name: string };
}

const DIMENSIONS: Array<{ key: Criterion["dimension"]; label: string }> = [
  { key: "FOCUS", label: "Focus" },
  { key: "ROLES", label: "Roles" },
  { key: "AUTHORITY", label: "Authority" },
  { key: "METRICS", label: "Metrics" },
  { key: "EVALUATION", label: "Evaluation" },
];

export function FrameClient({
  assets,
  criteria,
  assessments,
  authorityRules,
  initialAssetId,
  roleReviewMaxAgeDays,
  canAssess,
  canEditAuthority,
}: {
  assets: AssetSummary[];
  criteria: Criterion[];
  assessments: AssessmentRow[];
  authorityRules: AuthorityRuleRow[];
  initialAssetId?: string;
  roleReviewMaxAgeDays: number;
  canAssess: boolean;
  canEditAuthority: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"heatmap" | "assess" | "authority" | "roles">(
    initialAssetId ? "assess" : "heatmap"
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAssetId || assets[0]?.id || "");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New assessment form state
  const [showAssessForm, setShowAssessForm] = useState(false);
  const [assessNotes, setAssessNotes] = useState("");
  const [draftScores, setDraftScores] = useState<
    Record<string, { score: number; rationale: string; metricClassification: "ACTIVITY" | "OUTCOME" | "BOTH" | "NONE"; evidenceNote: string }>
  >(() =>
    Object.fromEntries(
      criteria.map((c) => [
        c.id,
        {
          score: 2,
          rationale: "",
          metricClassification: c.dimension === "METRICS" ? "BOTH" : "NONE",
          evidenceNote: "",
        },
      ])
    )
  );

  // Authority Matrix editor state
  const [draftRules, setDraftRules] = useState<
    Array<{ decisionType: "AUTONOMOUS" | "HUMAN_CONFIRMED" | "OUT_OF_SCOPE"; scopeDescription: string; conditions: string }>
  >([
    { decisionType: "AUTONOMOUS", scopeDescription: "", conditions: "" },
    { decisionType: "HUMAN_CONFIRMED", scopeDescription: "", conditions: "" },
    { decisionType: "OUT_OF_SCOPE", scopeDescription: "", conditions: "" },
  ]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];

  const assetAssessments = useMemo(
    () => assessments.filter((a) => a.assetId === selectedAsset?.id),
    [assessments, selectedAsset]
  );
  const latestAssetAssessment = assetAssessments[0];

  const radarData = useMemo(() => {
    if (!latestAssetAssessment) {
      return DIMENSIONS.map((d) => ({ dimension: d.label, score: 0 }));
    }
    const summary = computeFrameSummary(
      latestAssetAssessment.scores.map((s) => ({
        dimension: s.criterion.dimension,
        score: s.score,
        metricClassification: s.metricClassification,
      }))
    );
    return DIMENSIONS.map((d) => ({ dimension: d.label, score: summary.dimensions[d.key] }));
  }, [latestAssetAssessment]);

  const draftSummary = useMemo(() => {
    return computeFrameSummary(
      criteria.map((c) => ({
        dimension: c.dimension,
        score: draftScores[c.id]?.score ?? 0,
        metricClassification: draftScores[c.id]?.metricClassification ?? "NONE",
      }))
    );
  }, [criteria, draftScores]);

  const activeAuthorityForSelected = useMemo(
    () => authorityRules.filter((r) => r.assetId === selectedAsset?.id && r.isActive),
    [authorityRules, selectedAsset]
  );

  const authorityHistoryForSelected = useMemo(
    () => authorityRules.filter((r) => r.assetId === selectedAsset?.id),
    [authorityRules, selectedAsset]
  );

  async function handleSubmitAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    setStatusMsg(null);
    setErrorMsg(null);

    const payload = {
      assetId: selectedAsset.id,
      notes: assessNotes,
      scores: criteria.map((c) => ({
        criterionId: c.id,
        score: draftScores[c.id]?.score ?? 2,
        rationale: draftScores[c.id]?.rationale || "Assessed against FRAME criteria.",
        metricClassification: draftScores[c.id]?.metricClassification ?? "NONE",
        evidenceNote: draftScores[c.id]?.evidenceNote || "",
      })),
    };

    const res = await fetch("/api/frame/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to submit FRAME assessment.");
      return;
    }

    setStatusMsg(`Recorded FRAME assessment for ${selectedAsset.assetCode} (Overall: ${data.summary.overallScore}/4.0).`);
    setShowAssessForm(false);
    router.refresh();
  }

  async function handlePublishAuthority(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    setStatusMsg(null);
    setErrorMsg(null);

    const nonEmpty = draftRules.filter((r) => r.scopeDescription.trim().length >= 2);
    if (nonEmpty.length === 0) {
      setErrorMsg("Enter at least one authority rule description.");
      return;
    }

    const res = await fetch("/api/frame/authority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: selectedAsset.id, rules: nonEmpty }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to publish authority matrix.");
      return;
    }

    setStatusMsg(`Published Authority Matrix v${data.version} for ${selectedAsset.assetCode}.`);
    router.refresh();
  }

  function heatCellClass(score: number | null) {
    if (score === null) return "bg-surface-muted text-muted-foreground";
    if (score >= 3.2) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    if (score >= 2.2) return "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";
    if (score >= 1.2) return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    return "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">FRAME Governance Envelope</h1>
          <p className="text-sm text-muted-foreground">
            Assess enterprise AI deployment maturity across Focus, Roles, Authority, Metrics, and Evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="frame-asset-select" className="text-xs font-medium text-muted-foreground">
            Active Asset:
          </label>
          <Select
            id="frame-asset-select"
            className="w-64"
            value={selectedAsset?.id || ""}
            onChange={(e) => setSelectedAssetId(e.target.value)}
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetCode} · {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: "heatmap", label: "Portfolio Heatmap" },
          { id: "assess", label: "Assessment & Radar" },
          { id: "authority", label: "Authority Matrix" },
          { id: "roles", label: "Roles & Escalation" },
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
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: Portfolio Heatmap */}
      {tab === "heatmap" && (
        <Card>
          <CardHeader>
            <CardTitle>FRAME Portfolio Heatmap (Assets x Dimensions)</CardTitle>
            <CardDescription>
              Latest maturity scores (0 to 4) alongside Roles and Metrics governance flags
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">AI Asset</th>
                  {DIMENSIONS.map((d) => (
                    <th key={d.key} className="py-2.5 px-3 font-medium text-center">
                      {d.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 font-medium text-center">Overall</th>
                  <th className="py-2.5 px-4 font-medium">Governance Flags</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const latest = assessments.find((as) => as.assetId === a.id);
                  const summary = latest
                    ? computeFrameSummary(
                        latest.scores.map((s) => ({
                          dimension: s.criterion.dimension,
                          score: s.score,
                          metricClassification: s.metricClassification,
                        }))
                      )
                    : null;
                  const roleHealth = evaluateRoleHealth(
                    {
                      ownerId: a.ownerId,
                      overseerId: a.overseerId,
                      escalationPath: a.escalationPath,
                      rolesLastReviewedAt: a.rolesLastReviewedAt ? new Date(a.rolesLastReviewedAt) : null,
                    },
                    roleReviewMaxAgeDays
                  );

                  return (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAssetId(a.id);
                            setTab("assess");
                          }}
                          className="text-left hover:underline font-medium"
                        >
                          <span className="font-mono text-primary mr-1.5">{a.assetCode}</span>
                          {a.name}
                        </button>
                      </td>
                      {DIMENSIONS.map((d) => {
                        const val = summary ? summary.dimensions[d.key] : null;
                        return (
                          <td key={d.key} className="py-2 px-3 text-center">
                            <span
                              className={`inline-block w-14 py-1 rounded font-medium tabular-nums ${heatCellClass(val)}`}
                            >
                              {val !== null ? val.toFixed(1) : "N/A"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-center font-semibold tabular-nums">
                        {summary ? `${summary.overallScore.toFixed(2)}` : "N/A"}
                      </td>
                      <td className="py-2.5 px-4 space-y-1">
                        {summary?.activityOnlyWarning && (
                          <Badge variant="warning" className="mr-1">
                            Activity-only metrics
                          </Badge>
                        )}
                        {(!roleHealth.isComplete || roleHealth.isLapsed) && (
                          <Badge variant="danger">{roleHealth.flags[0]}</Badge>
                        )}
                        {!summary?.activityOnlyWarning && roleHealth.isComplete && !roleHealth.isLapsed && (
                          <Badge variant="success">Compliant</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Asset Assessment & Radar */}
      {tab === "assess" && selectedAsset && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{selectedAsset.assetCode} · {selectedAsset.name}</CardTitle>
                  <CardDescription>
                    {latestAssetAssessment
                      ? `Latest assessment on ${formatDate(latestAssetAssessment.assessedAt)} by ${latestAssetAssessment.assessor.name}`
                      : "No assessment recorded yet"}
                  </CardDescription>
                </div>
                {canAssess && (
                  <Button type="button" size="sm" onClick={() => setShowAssessForm(!showAssessForm)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    New Assessment
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <FrameRadarChart data={radarData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assessment History ({assetAssessments.length})</CardTitle>
                <CardDescription>Maturity trend across completed FRAME reviews</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {assetAssessments.length === 0 ? (
                  <p className="text-muted-foreground">No historical assessments yet.</p>
                ) : (
                  assetAssessments.map((as) => {
                    const sum = computeFrameSummary(
                      as.scores.map((s) => ({
                        dimension: s.criterion.dimension,
                        score: s.score,
                        metricClassification: s.metricClassification,
                      }))
                    );
                    return (
                      <div key={as.id} className="rounded border border-border p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {formatDate(as.assessedAt)} · Overall {as.overallScore.toFixed(2)} / 4.00
                          </span>
                          <span className="text-muted-foreground">{as.assessor.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DIMENSIONS.map((d) => (
                            <Badge key={d.key} variant="outline">
                              {d.label}: {sum.dimensions[d.key].toFixed(1)}
                            </Badge>
                          ))}
                          {sum.activityOnlyWarning && (
                            <Badge variant="warning">Activity-only metrics warning</Badge>
                          )}
                        </div>
                        {as.notes && <p className="text-muted-foreground">{as.notes}</p>}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {showAssessForm && canAssess && (
            <Card>
              <CardHeader>
                <CardTitle>Conduct FRAME Assessment for {selectedAsset.assetCode}</CardTitle>
                <CardDescription>
                  Score each criterion from 0 to 4 with rationale and evidence reference. Projected overall:{" "}
                  <strong>{draftSummary.overallScore.toFixed(2)} / 4.00</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitAssessment} className="space-y-4">
                  {draftSummary.activityOnlyWarning && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        Metrics warning: this assessment currently logs only Activity metrics without any Outcome
                        metrics. FRAME requires separating activity from business outcome metrics.
                      </span>
                    </div>
                  )}

                  {DIMENSIONS.map((dim) => {
                    const dimCriteria = criteria.filter((c) => c.dimension === dim.key);
                    return (
                      <div key={dim.key} className="space-y-3 border border-border rounded-md p-4">
                        <div className="font-semibold text-sm flex items-center justify-between">
                          <span>{dim.label}</span>
                          <Badge variant="outline">
                            Avg: {draftSummary.dimensions[dim.key].toFixed(2)} / 4.00
                          </Badge>
                        </div>
                        {dimCriteria.map((c) => {
                          const entry = draftScores[c.id];
                          return (
                            <div key={c.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2 border-t border-border">
                              <div className="lg:col-span-4 space-y-1">
                                <div className="text-xs font-medium">
                                  <span className="font-mono text-primary mr-1">{c.code}</span>
                                  {c.title}
                                </div>
                                <p className="text-[11px] text-muted-foreground">{c.description}</p>
                                <p className="text-[11px] text-primary">
                                  Level {entry?.score ?? 2}: {c.rubricJson[String(entry?.score ?? 2)]}
                                </p>
                              </div>
                              <div className="lg:col-span-2">
                                <label className="text-[11px] font-medium block mb-1">Maturity (0-4)</label>
                                <Select
                                  value={String(entry?.score ?? 2)}
                                  onChange={(e) =>
                                    setDraftScores((prev) => ({
                                      ...prev,
                                      [c.id]: { ...prev[c.id], score: Number(e.target.value) },
                                    }))
                                  }
                                >
                                  <option value="0">0 · Absent</option>
                                  <option value="1">1 · Initial</option>
                                  <option value="2">2 · Defined</option>
                                  <option value="3">3 · Managed</option>
                                  <option value="4">4 · Optimised</option>
                                </Select>
                                {dim.key === "METRICS" && (
                                  <div className="mt-2">
                                    <label className="text-[11px] font-medium block mb-1">Metric Type</label>
                                    <Select
                                      value={entry?.metricClassification || "ACTIVITY"}
                                      onChange={(e) =>
                                        setDraftScores((prev) => ({
                                          ...prev,
                                          [c.id]: {
                                            ...prev[c.id],
                                            metricClassification: e.target.value as "ACTIVITY" | "OUTCOME" | "BOTH" | "NONE",
                                          },
                                        }))
                                      }
                                    >
                                      <option value="ACTIVITY">Activity only</option>
                                      <option value="OUTCOME">Outcome only</option>
                                      <option value="BOTH">Activity &amp; Outcome</option>
                                    </Select>
                                  </div>
                                )}
                              </div>
                              <div className="lg:col-span-4">
                                <label className="text-[11px] font-medium block mb-1">Rationale</label>
                                <Textarea
                                  required
                                  className="min-h-[60px] text-xs"
                                  placeholder="Explain score and observed governance evidence..."
                                  value={entry?.rationale || ""}
                                  onChange={(e) =>
                                    setDraftScores((prev) => ({
                                      ...prev,
                                      [c.id]: { ...prev[c.id], rationale: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="lg:col-span-2">
                                <label className="text-[11px] font-medium block mb-1">Evidence Ref</label>
                                <Input
                                  className="text-xs"
                                  placeholder="Doc / URL / ID"
                                  value={entry?.evidenceNote || ""}
                                  onChange={(e) =>
                                    setDraftScores((prev) => ({
                                      ...prev,
                                      [c.id]: { ...prev[c.id], evidenceNote: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  <div>
                    <label className="text-xs font-medium block mb-1">Assessment Summary Notes</label>
                    <Textarea
                      value={assessNotes}
                      onChange={(e) => setAssessNotes(e.target.value)}
                      placeholder="Key strengths, gaps, and recommended follow-up actions."
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowAssessForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Submit FRAME Assessment</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: Authority Matrix */}
      {tab === "authority" && selectedAsset && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
                <CardTitle>Active Authority Matrix: {selectedAsset.assetCode}</CardTitle>
              </div>
              <CardDescription>
                Sanctioned decision rights separated into Autonomous, Human-confirmed, and Out of scope
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {activeAuthorityForSelected.length === 0 ? (
                <p className="text-muted-foreground">No active authority matrix published for this asset.</p>
              ) : (
                activeAuthorityForSelected.map((r) => (
                  <div key={r.id} className="rounded border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          r.decisionType === "AUTONOMOUS"
                            ? "info"
                            : r.decisionType === "HUMAN_CONFIRMED"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {formatEnumLabel(r.decisionType)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">Version {r.version}</span>
                    </div>
                    <p className="font-medium">{r.scopeDescription}</p>
                    {r.conditions && <p className="text-muted-foreground">Conditions: {r.conditions}</p>}
                  </div>
                ))
              )}

              {authorityHistoryForSelected.length > activeAuthorityForSelected.length && (
                <div className="pt-2 border-t border-border">
                  <div className="font-medium mb-1">Version History</div>
                  <div className="text-[11px] text-muted-foreground">
                    {Array.from(new Set(authorityHistoryForSelected.map((r) => r.version)))
                      .sort((a, b) => b - a)
                      .map((v) => `v${v}`)
                      .join(", ")}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {canEditAuthority && (
            <Card>
              <CardHeader>
                <CardTitle>Publish New Authority Matrix Version</CardTitle>
                <CardDescription>
                  Publishing creates an immutable new version and supersedes previous active rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePublishAuthority} className="space-y-3">
                  {draftRules.map((rule, idx) => (
                    <div key={idx} className="rounded border border-border p-3 space-y-2">
                      <Select
                        value={rule.decisionType}
                        onChange={(e) => {
                          const next = [...draftRules];
                          next[idx].decisionType = e.target.value as typeof rule.decisionType;
                          setDraftRules(next);
                        }}
                      >
                        <option value="AUTONOMOUS">Autonomous</option>
                        <option value="HUMAN_CONFIRMED">Human-confirmed</option>
                        <option value="OUT_OF_SCOPE">Out of scope</option>
                      </Select>
                      <Input
                        placeholder="Decision scope description..."
                        value={rule.scopeDescription}
                        onChange={(e) => {
                          const next = [...draftRules];
                          next[idx].scopeDescription = e.target.value;
                          setDraftRules(next);
                        }}
                      />
                      <Input
                        placeholder="Conditions / thresholds (optional)"
                        value={rule.conditions}
                        onChange={(e) => {
                          const next = [...draftRules];
                          next[idx].conditions = e.target.value;
                          setDraftRules(next);
                        }}
                      />
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraftRules([...draftRules, { decisionType: "HUMAN_CONFIRMED", scopeDescription: "", conditions: "" }])
                      }
                    >
                      Add Rule Row
                    </Button>
                    <Button type="submit" size="sm">
                      Publish New Version
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 4: Roles & Escalation */}
      {tab === "roles" && (
        <Card>
          <CardHeader>
            <CardTitle>Roles &amp; Accountability Register</CardTitle>
            <CardDescription>
              Flags assets with missing accountable owner, human overseer, escalation path, or reviews older than{" "}
              {roleReviewMaxAgeDays} days
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Asset</th>
                  <th className="py-2.5 px-4 font-medium">Accountable Owner</th>
                  <th className="py-2.5 px-4 font-medium">Human Overseer</th>
                  <th className="py-2.5 px-4 font-medium">Escalation Path</th>
                  <th className="py-2.5 px-4 font-medium">Last Reviewed</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const health = evaluateRoleHealth(
                    {
                      ownerId: a.ownerId,
                      overseerId: a.overseerId,
                      escalationPath: a.escalationPath,
                      rolesLastReviewedAt: a.rolesLastReviewedAt ? new Date(a.rolesLastReviewedAt) : null,
                    },
                    roleReviewMaxAgeDays
                  );
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-4 font-medium">
                        <Link href={`/assets/${a.id}`} className="text-primary hover:underline">
                          {a.assetCode} · {a.name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4">{a.owner?.name || <Badge variant="danger">Missing</Badge>}</td>
                      <td className="py-2.5 px-4">{a.overseer?.name || <Badge variant="danger">Missing</Badge>}</td>
                      <td className="py-2.5 px-4 max-w-xs truncate">
                        {a.escalationPath || <Badge variant="danger">Missing</Badge>}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">{formatDate(a.rolesLastReviewedAt)}</td>
                      <td className="py-2.5 px-4">
                        {health.flags.length === 0 ? (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                            Healthy
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {health.flags.map((f, idx) => (
                              <Badge key={idx} variant="danger">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
