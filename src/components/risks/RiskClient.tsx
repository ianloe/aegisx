"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Plus, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  buildRiskHeatmapMatrix,
  evaluateRiskPosture,
  RiskAppetiteThresholds,
} from "@/lib/governance/risk-scoring";
import { formatCurrency, formatDate, formatEnumLabel } from "@/lib/utils";

interface RiskRow {
  id: string;
  riskCode: string;
  assetId: string;
  frameDimension: string | null;
  title: string;
  description: string;
  category: string;
  cause: string;
  impactDescription: string;
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood: number;
  residualImpact: number;
  financialExposure: number | null;
  treatment: string;
  reviewDate: string;
  status: string;
  asset: { id: string; assetCode: string; name: string; businessUnit: { id: string; name: string } };
  owner: { id: string; name: string };
  controls: Array<{ control: { id: string; controlCode: string; title: string } }>;
}

interface ControlRow {
  id: string;
  controlCode: string;
  title: string;
  description: string;
  testFrequency: string;
  lastTestedAt: string | null;
  effectiveness: "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NOT_TESTED";
  testNotes: string | null;
  owner: { name: string };
  mappings: Array<{
    id: string;
    coverage: string;
    notes: string | null;
    requirement: {
      id: string;
      code: string;
      title: string;
      framework: { id: string; code: string; name: string };
    };
  }>;
}

interface FrameworkRow {
  id: string;
  code: string;
  name: string;
  version: string;
  description: string;
  requirements: Array<{ id: string; code: string; title: string; description: string }>;
}

interface IncidentRow {
  id: string;
  incidentCode: string;
  assetId: string;
  title: string;
  isNearMiss: boolean;
  occurredAt: string;
  severity: string;
  description: string;
  rootCause: string | null;
  lessonsLearned: string | null;
  status: string;
  asset: { id: string; assetCode: string; name: string };
  risk: { id: string; riskCode: string; title: string } | null;
}

interface OptionItem {
  id: string;
  name: string;
  assetCode?: string;
}

export function RiskClient({
  risks,
  controls,
  frameworks,
  incidents,
  assets,
  users,
  appetite,
  canWriteRisks,
  canTestControls,
  canWriteIncidents,
}: {
  risks: RiskRow[];
  controls: ControlRow[];
  frameworks: FrameworkRow[];
  incidents: IncidentRow[];
  assets: OptionItem[];
  users: OptionItem[];
  appetite: RiskAppetiteThresholds;
  canWriteRisks: boolean;
  canTestControls: boolean;
  canWriteIncidents: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"register" | "controls" | "crosswalk" | "incidents">("register");
  const [heatMode, setHeatMode] = useState<"residual" | "inherent">("residual");
  const [selectedCell, setSelectedCell] = useState<{ l: number; i: number } | null>(null);
  const [assetFilter, setAssetFilter] = useState("");
  const [buFilter, setBuFilter] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals / forms
  const [showNewRisk, setShowNewRisk] = useState(false);
  const [showImportRisk, setShowImportRisk] = useState(false);
  const [csvText, setCsvText] = useState("");

  const [riskForm, setRiskForm] = useState({
    assetId: assets[0]?.id || "",
    frameDimension: "AUTHORITY",
    title: "",
    description: "",
    category: "SAFETY",
    cause: "",
    impactDescription: "",
    inherentLikelihood: 4,
    inherentImpact: 4,
    residualLikelihood: 3,
    residualImpact: 3,
    financialExposure: 90000,
    ownerId: users[0]?.id || "",
    treatment: "MITIGATE",
    reviewDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    controlIds: [] as string[],
  });

  // Control mapping form
  const [mapControlId, setMapControlId] = useState(controls[0]?.id || "");
  const [mapReqId, setMapReqId] = useState(frameworks[0]?.requirements[0]?.id || "");
  const [mapCoverage, setMapCoverage] = useState("FULL");
  const [mapNotes, setMapNotes] = useState("");

  // Incident form
  const [incForm, setIncForm] = useState({
    assetId: assets[0]?.id || "",
    riskId: "",
    title: "",
    isNearMiss: false,
    severity: "MEDIUM",
    description: "",
    rootCause: "",
    lessonsLearned: "",
  });

  const businessUnits = useMemo(() => {
    const map = new Map<string, string>();
    risks.forEach((r) => map.set(r.asset.businessUnit.id, r.asset.businessUnit.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [risks]);

  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (assetFilter && r.assetId !== assetFilter) return false;
      if (buFilter && r.asset.businessUnit.id !== buFilter) return false;
      if (selectedCell) {
        const l = heatMode === "residual" ? r.residualLikelihood : r.inherentLikelihood;
        const i = heatMode === "residual" ? r.residualImpact : r.inherentImpact;
        if (l !== selectedCell.l || i !== selectedCell.i) return false;
      }
      return true;
    });
  }, [risks, assetFilter, buFilter, selectedCell, heatMode]);

  const matrix = useMemo(() => buildRiskHeatmapMatrix(filteredRisks, heatMode), [filteredRisks, heatMode]);

  const breachedRisks = useMemo(
    () =>
      risks.filter((r) => evaluateRiskPosture(r, appetite).appetiteBreached),
    [risks, appetite]
  );

  const overdueRisks = useMemo(
    () =>
      risks.filter((r) => evaluateRiskPosture(r, appetite).isOverdueReview),
    [risks, appetite]
  );

  function cellBg(score: number) {
    if (score >= appetite.criticalThreshold)
      return "bg-red-100 border-red-300 text-red-950 dark:bg-red-950/70 dark:border-red-800 dark:text-red-200";
    if (score > appetite.maxAcceptableResidualScore)
      return "bg-amber-100 border-amber-300 text-amber-950 dark:bg-amber-950/70 dark:border-amber-800 dark:text-amber-200";
    if (score >= 6)
      return "bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/50 dark:border-sky-800 dark:text-sky-200";
    return "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200";
  }

  async function handleCreateRisk(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/risks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(riskForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to log risk.");
      return;
    }
    setStatusMsg(`Logged risk ${data.risk.riskCode}: ${data.risk.title}`);
    setShowNewRisk(false);
    router.refresh();
  }

  async function handleImportRiskCsv() {
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/risks/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Risk CSV import failed.");
      return;
    }
    setStatusMsg(`Imported ${data.importedCount} risk record(s).`);
    setShowImportRisk(false);
    setCsvText("");
    router.refresh();
  }

  async function handleTestControl(ctrlId: string, effectiveness: string) {
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/controls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ctrlId,
        effectiveness,
        testNotes: `Control effectiveness verified as ${effectiveness} on ${new Date().toISOString().slice(0, 10)}.`,
      }),
    });
    if (res.ok) {
      setStatusMsg("Recorded control effectiveness test result.");
      router.refresh();
    } else {
      setErrorMsg("Failed to update control test.");
    }
  }

  async function handleAddMapping(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "ADD_MAPPING",
        controlId: mapControlId,
        requirementId: mapReqId,
        coverage: mapCoverage,
        notes: mapNotes,
      }),
    });
    if (res.ok) {
      setStatusMsg("Saved framework crosswalk mapping.");
      setMapNotes("");
      router.refresh();
    } else {
      setErrorMsg("Failed to add crosswalk mapping.");
    }
  }

  async function handleCreateIncident(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...incForm,
        riskId: incForm.riskId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to log incident.");
      return;
    }
    setStatusMsg(`Logged ${data.incident.incidentCode}: ${data.incident.title}`);
    setIncForm({ ...incForm, title: "", description: "", rootCause: "", lessonsLearned: "" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Risk Register, Controls, Framework Crosswalk &amp; Incidents
          </h1>
          <p className="text-sm text-muted-foreground">
            Enterprise AI risk posture linked to FRAME dimensions, multi-framework controls, and ROI Value-at-Risk.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href="/api/risks/export">
            <Button type="button" variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export Risks CSV
            </Button>
          </a>
          {canWriteRisks && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowImportRisk(!showImportRisk)}>
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Import CSV
              </Button>
              <Button type="button" size="sm" onClick={() => setShowNewRisk(!showNewRisk)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Log Risk
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Risk Appetite Alert Banner */}
      {breachedRisks.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Risk Appetite Breach Alert:</strong> {breachedRisks.length} risk(s) exceed the maximum acceptable
              residual threshold ({appetite.maxAcceptableResidualScore}). {overdueRisks.length} review(s) are overdue.
            </span>
          </div>
          <Badge variant="danger">Critical Threshold: {appetite.criticalThreshold}</Badge>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: "register", label: `Risk Register & 5x5 Heatmap (${risks.length})` },
          { id: "controls", label: `Control Library (${controls.length})` },
          { id: "crosswalk", label: `Framework Crosswalk (${frameworks.length} Frameworks)` },
          { id: "incidents", label: `Incidents & Near Misses (${incidents.length})` },
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

      {/* Create Risk Modal/Card */}
      {showNewRisk && canWriteRisks && (
        <Card>
          <CardHeader>
            <CardTitle>Log New AI Risk</CardTitle>
            <CardDescription>
              Link risk to an AI asset, FRAME dimension, inherent/residual ratings, and financial exposure (feeds ROI
              Value-at-Risk)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRisk} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">AI Asset</label>
                  <Select
                    value={riskForm.assetId}
                    onChange={(e) => setRiskForm({ ...riskForm, assetId: e.target.value })}
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.assetCode} · {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">FRAME Dimension</label>
                  <Select
                    value={riskForm.frameDimension}
                    onChange={(e) => setRiskForm({ ...riskForm, frameDimension: e.target.value })}
                  >
                    <option value="FOCUS">Focus</option>
                    <option value="ROLES">Roles</option>
                    <option value="AUTHORITY">Authority</option>
                    <option value="METRICS">Metrics</option>
                    <option value="EVALUATION">Evaluation</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Risk Category</label>
                  <Select
                    value={riskForm.category}
                    onChange={(e) => setRiskForm({ ...riskForm, category: e.target.value })}
                  >
                    <option value="SAFETY">Safety</option>
                    <option value="SECURITY">Security</option>
                    <option value="PRIVACY">Privacy</option>
                    <option value="BIAS_FAIRNESS">Bias and Fairness</option>
                    <option value="REGULATORY">Regulatory</option>
                    <option value="OPERATIONAL">Operational</option>
                    <option value="REPUTATIONAL">Reputational</option>
                    <option value="THIRD_PARTY">Third-Party</option>
                    <option value="MODEL_DRIFT">Model Drift</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium block mb-1">Risk Title</label>
                  <Input
                    required
                    value={riskForm.title}
                    onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })}
                    placeholder="e.g. Unauthorised autonomous execution on edge-case inputs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Est. Financial Exposure (SGD)</label>
                  <Input
                    type="number"
                    min="0"
                    value={riskForm.financialExposure}
                    onChange={(e) => setRiskForm({ ...riskForm, financialExposure: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  required
                  placeholder="Root cause..."
                  value={riskForm.cause}
                  onChange={(e) => setRiskForm({ ...riskForm, cause: e.target.value })}
                />
                <Input
                  required
                  placeholder="Business / regulatory impact..."
                  value={riskForm.impactDescription}
                  onChange={(e) => setRiskForm({ ...riskForm, impactDescription: e.target.value })}
                />
                <Input
                  required
                  placeholder="Detailed risk description..."
                  value={riskForm.description}
                  onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1">Inherent L (1-5)</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={riskForm.inherentLikelihood}
                    onChange={(e) => setRiskForm({ ...riskForm, inherentLikelihood: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1">Inherent I (1-5)</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={riskForm.inherentImpact}
                    onChange={(e) => setRiskForm({ ...riskForm, inherentImpact: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1">Residual L (1-5)</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={riskForm.residualLikelihood}
                    onChange={(e) => setRiskForm({ ...riskForm, residualLikelihood: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1">Residual I (1-5)</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={riskForm.residualImpact}
                    onChange={(e) => setRiskForm({ ...riskForm, residualImpact: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1">Treatment</label>
                  <Select
                    value={riskForm.treatment}
                    onChange={(e) => setRiskForm({ ...riskForm, treatment: e.target.value })}
                  >
                    <option value="MITIGATE">Mitigate</option>
                    <option value="ACCEPT">Accept</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="AVOID">Avoid</option>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1">Next Review Date</label>
                  <Input
                    type="date"
                    value={riskForm.reviewDate}
                    onChange={(e) => setRiskForm({ ...riskForm, reviewDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewRisk(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Risk Entry
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showImportRisk && canWriteRisks && (
        <Card>
          <CardHeader>
            <CardTitle>Import Risks from CSV</CardTitle>
            <CardDescription>
              Headers: riskCode, assetCode, frameDimension, title, description, category, cause, impactDescription,
              inherentLikelihood, inherentImpact, residualLikelihood, residualImpact, financialExposure, treatment,
              reviewDate, status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              className="font-mono text-xs min-h-[100px]"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <Button type="button" size="sm" onClick={handleImportRiskCsv}>
              Import CSV
            </Button>
          </CardContent>
        </Card>
      )}

      {/* TAB 1: Risk Register & 5x5 Heatmap */}
      {tab === "register" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Card className="lg:col-span-5">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>5x5 Risk Heat Map ({heatMode === "residual" ? "Residual" : "Inherent"})</CardTitle>
                  <CardDescription>Click any cell to filter the register</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={heatMode === "residual" ? "primary" : "outline"}
                    onClick={() => setHeatMode("residual")}
                  >
                    Residual
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={heatMode === "inherent" ? "primary" : "outline"}
                    onClick={() => setHeatMode("inherent")}
                  >
                    Inherent
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-1.5 text-xs text-center items-center">
                  <div className="text-[10px] text-muted-foreground font-medium">L \ I</div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="text-[10px] font-semibold text-muted-foreground">
                      Impact {i}
                    </div>
                  ))}
                  {matrix.map((row, rIdx) => (
                    <React.Fragment key={rIdx}>
                      <div className="text-[10px] font-semibold text-muted-foreground">
                        Like {5 - rIdx}
                      </div>
                      {row.map((cell) => {
                        const isSelected =
                          selectedCell?.l === cell.likelihood && selectedCell?.i === cell.impact;
                        return (
                          <button
                            key={`${cell.likelihood}-${cell.impact}`}
                            type="button"
                            onClick={() =>
                              setSelectedCell(
                                isSelected ? null : { l: cell.likelihood, i: cell.impact }
                              )
                            }
                            className={`h-12 rounded border flex flex-col items-center justify-center transition-all cursor-pointer ${cellBg(
                              cell.score
                            )} ${isSelected ? "ring-2 ring-primary font-bold" : ""}`}
                          >
                            <span className="text-xs font-semibold tabular-nums">{cell.items.length}</span>
                            <span className="text-[9px] opacity-75">({cell.score})</span>
                          </button>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
                {selectedCell && (
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span>
                      Filtered by Likelihood {selectedCell.l} x Impact {selectedCell.i}
                    </span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedCell(null)}>
                      Clear cell filter
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Portfolio Risk Summary &amp; Filters</CardTitle>
                    <CardDescription>Filter by AI asset or business unit</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      className="w-44 h-8 text-xs"
                      value={assetFilter}
                      onChange={(e) => setAssetFilter(e.target.value)}
                    >
                      <option value="">All AI Assets</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.assetCode} · {a.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      className="w-44 h-8 text-xs"
                      value={buFilter}
                      onChange={(e) => setBuFilter(e.target.value)}
                    >
                      <option value="">All Business Units</option>
                      {businessUnits.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border border-border p-3">
                    <div className="text-muted-foreground">Total Filtered Risks</div>
                    <div className="text-xl font-semibold tabular-nums mt-0.5">{filteredRisks.length}</div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-muted-foreground">Appetite Breaches (&gt;{appetite.maxAcceptableResidualScore})</div>
                    <div className="text-xl font-semibold tabular-nums text-red-600 mt-0.5">
                      {filteredRisks.filter((r) => evaluateRiskPosture(r, appetite).appetiteBreached).length}
                    </div>
                  </div>
                  <div className="rounded border border-border p-3">
                    <div className="text-muted-foreground">Overdue Reviews</div>
                    <div className="text-xl font-semibold tabular-nums text-amber-600 mt-0.5">
                      {filteredRisks.filter((r) => evaluateRiskPosture(r, appetite).isOverdueReview).length}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold mb-1.5">Top Residual Risks</div>
                  <div className="space-y-1.5">
                    {[...filteredRisks]
                      .sort(
                        (a, b) =>
                          b.residualLikelihood * b.residualImpact -
                          a.residualLikelihood * a.residualImpact
                      )
                      .slice(0, 4)
                      .map((r) => {
                        const evalPosture = evaluateRiskPosture(r, appetite);
                        return (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded border border-border px-3 py-1.5"
                          >
                            <div className="truncate pr-2">
                              <span className="font-mono font-semibold text-primary mr-1.5">{r.riskCode}</span>
                              <span>{r.title}</span>
                              <span className="text-muted-foreground ml-1.5">({r.asset.assetCode})</span>
                            </div>
                            <Badge variant={evalPosture.appetiteBreached ? "danger" : "outline"}>
                              Score {evalPosture.residualScore}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Code</th>
                    <th className="py-2.5 px-4 font-medium">Risk &amp; Cause</th>
                    <th className="py-2.5 px-4 font-medium">Asset / BU</th>
                    <th className="py-2.5 px-4 font-medium">Category / FRAME</th>
                    <th className="py-2.5 px-4 font-medium text-center">Inherent</th>
                    <th className="py-2.5 px-4 font-medium text-center">Residual</th>
                    <th className="py-2.5 px-4 font-medium">Exposure</th>
                    <th className="py-2.5 px-4 font-medium">Review Date</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.map((r) => {
                    const posture = evaluateRiskPosture(r, appetite);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-4 font-mono font-medium">{r.riskCode}</td>
                        <td className="py-2.5 px-4 max-w-xs">
                          <div className="font-medium">{r.title}</div>
                          <div className="text-[11px] text-muted-foreground truncate">Cause: {r.cause}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <Link href={`/assets/${r.asset.id}`} className="text-primary hover:underline font-medium">
                            {r.asset.assetCode}
                          </Link>
                          <div className="text-[11px] text-muted-foreground">{r.asset.businessUnit.name}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline">{formatEnumLabel(r.category)}</Badge>
                          {r.frameDimension && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              FRAME: {formatEnumLabel(r.frameDimension)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center tabular-nums">
                          {r.inherentLikelihood}x{r.inherentImpact} ({posture.inherentScore})
                        </td>
                        <td className="py-2.5 px-4 text-center tabular-nums">
                          <Badge variant={posture.appetiteBreached ? "danger" : "success"}>
                            {r.residualLikelihood}x{r.residualImpact} ({posture.residualScore})
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 tabular-nums">
                          {formatCurrency(r.financialExposure ?? 0, "SGD")}
                        </td>
                        <td className="py-2.5 px-4 tabular-nums">
                          <div>{formatDate(r.reviewDate)}</div>
                          {posture.isOverdueReview && <Badge variant="warning">Overdue</Badge>}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="secondary">{formatEnumLabel(r.status)}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: Control Library */}
      {tab === "controls" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {controls.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{c.controlCode}</span>
                    <Badge
                      variant={
                        c.effectiveness === "EFFECTIVE"
                          ? "success"
                          : c.effectiveness === "PARTIAL"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {formatEnumLabel(c.effectiveness)}
                    </Badge>
                  </div>
                  <CardTitle className="mt-1">{c.title}</CardTitle>
                  <CardDescription>{c.description}</CardDescription>
                </div>
                {canTestControls && (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestControl(c.id, "EFFECTIVE")}
                    >
                      Mark Effective
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestControl(c.id, "PARTIAL")}
                    >
                      Partial
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="text-muted-foreground">
                  Frequency: <strong>{c.testFrequency}</strong> · Last Tested:{" "}
                  <strong>{formatDate(c.lastTestedAt)}</strong> · Owner: <strong>{c.owner.name}</strong>
                </div>
                {c.testNotes && <p className="text-muted-foreground">{c.testNotes}</p>}
                <div className="flex flex-wrap gap-1 pt-1">
                  {c.mappings.map((m) => (
                    <Badge key={m.id} variant="info">
                      {m.requirement.framework.code}: {m.requirement.code} ({m.coverage})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 3: Data-Driven Framework Crosswalk */}
      {tab === "crosswalk" && (
        <div className="space-y-6">
          {canTestControls && (
            <Card>
              <CardHeader>
                <CardTitle>Add Crosswalk Mapping</CardTitle>
                <CardDescription>
                  Map any Control in the library to any requirement across FRAME, AAEF, COSO, NIST AI RMF, ISO/IEC
                  42001, EU AI Act, or Singapore MAS / IMDA MGF
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddMapping} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Select value={mapControlId} onChange={(e) => setMapControlId(e.target.value)}>
                    {controls.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.controlCode} · {c.title}
                      </option>
                    ))}
                  </Select>
                  <Select value={mapReqId} onChange={(e) => setMapReqId(e.target.value)}>
                    {frameworks.flatMap((fw) =>
                      fw.requirements.map((req) => (
                        <option key={req.id} value={req.id}>
                          [{fw.code}] {req.code} · {req.title}
                        </option>
                      ))
                    )}
                  </Select>
                  <Select value={mapCoverage} onChange={(e) => setMapCoverage(e.target.value)}>
                    <option value="FULL">Full Coverage</option>
                    <option value="PARTIAL">Partial Coverage</option>
                    <option value="SUPPORTING">Supporting Control</option>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Mapping rationale..."
                      value={mapNotes}
                      onChange={(e) => setMapNotes(e.target.value)}
                    />
                    <Button type="submit">Map</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {frameworks.map((fw) => (
              <Card key={fw.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{fw.name}</CardTitle>
                    <Badge variant="outline">v{fw.version}</Badge>
                  </div>
                  <CardDescription>{fw.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {fw.requirements.map((req) => {
                    const mappedControls = controls.filter((c) =>
                      c.mappings.some((m) => m.requirement.id === req.id)
                    );
                    return (
                      <div key={req.id} className="rounded border border-border p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            <span className="font-mono text-primary mr-1.5">{req.code}</span>
                            {req.title}
                          </span>
                          <Badge variant={mappedControls.length > 0 ? "success" : "secondary"}>
                            {mappedControls.length} control(s)
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{req.description}</p>
                        {mappedControls.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {mappedControls.map((mc) => (
                              <Badge key={mc.id} variant="outline">
                                {mc.controlCode}: {mc.title}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Incidents & Near Misses */}
      {tab === "incidents" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {canWriteIncidents && (
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Log AI Incident or Near Miss</CardTitle>
                <CardDescription>Capture root cause and lessons learned</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateIncident} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">AI Asset</label>
                    <Select
                      value={incForm.assetId}
                      onChange={(e) => setIncForm({ ...incForm, assetId: e.target.value })}
                    >
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.assetCode} · {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium block mb-1">Severity</label>
                      <Select
                        value={incForm.severity}
                        onChange={(e) => setIncForm({ ...incForm, severity: e.target.value })}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </Select>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={incForm.isNearMiss}
                          onChange={(e) => setIncForm({ ...incForm, isNearMiss: e.target.checked })}
                        />
                        <span>Near Miss (intercepted before harm)</span>
                      </label>
                    </div>
                  </div>
                  <Input
                    required
                    placeholder="Incident title..."
                    value={incForm.title}
                    onChange={(e) => setIncForm({ ...incForm, title: e.target.value })}
                  />
                  <Textarea
                    required
                    placeholder="Description of what occurred..."
                    value={incForm.description}
                    onChange={(e) => setIncForm({ ...incForm, description: e.target.value })}
                  />
                  <Input
                    placeholder="Root cause..."
                    value={incForm.rootCause}
                    onChange={(e) => setIncForm({ ...incForm, rootCause: e.target.value })}
                  />
                  <Input
                    placeholder="Lessons learned & preventive controls..."
                    value={incForm.lessonsLearned}
                    onChange={(e) => setIncForm({ ...incForm, lessonsLearned: e.target.value })}
                  />
                  <Button type="submit" className="w-full">
                    Log Incident
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className={canWriteIncidents ? "lg:col-span-7" : "lg:col-span-12"}>
            <CardHeader>
              <CardTitle>Incident &amp; Near-Miss Register ({incidents.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {incidents.map((inc) => (
                <div key={inc.id} className="rounded border border-border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-primary">{inc.incidentCode}</span>
                      <span className="font-semibold">{inc.title}</span>
                      {inc.isNearMiss && <Badge variant="info">Near Miss</Badge>}
                    </div>
                    <Badge variant={inc.severity === "HIGH" || inc.severity === "CRITICAL" ? "danger" : "warning"}>
                      {formatEnumLabel(inc.severity)}
                    </Badge>
                  </div>
                  <p>{inc.description}</p>
                  <div className="text-[11px] text-muted-foreground">
                    Asset: <strong>{inc.asset.assetCode}</strong> · Date: {formatDate(inc.occurredAt)}
                    {inc.risk && ` · Linked Risk: ${inc.risk.riskCode}`}
                  </div>
                  {inc.rootCause && (
                    <div className="text-[11px]">
                      <strong>Root Cause:</strong> {inc.rootCause}
                    </div>
                  )}
                  {inc.lessonsLearned && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      <strong>Lessons Learned:</strong> {inc.lessonsLearned}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
