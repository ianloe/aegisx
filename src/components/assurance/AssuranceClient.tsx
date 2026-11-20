"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

interface BomRow {
  id: string;
  componentType: string;
  name: string;
  version: string;
  provider: string | null;
  isApproved: boolean;
}

interface DataSourceRow {
  id: string;
  sourceName: string;
  sourceType: string;
  classification: string;
  piiIncluded: boolean;
  retentionPolicy: string | null;
}

interface EvalRow {
  id: string;
  suiteName: string;
  evalType: string;
  passRate: number;
  threshold: number;
  passed: boolean;
  evaluatedAt: string;
}

interface McpPolicyRow {
  id: string;
  serverName: string;
  endpointUrl: string | null;
  transport: string;
  authMode: string;
  allowedTools: string[];
  riskTier: "READ_ONLY" | "WRITE" | "DESTRUCTIVE";
  requiresHitl: boolean;
  isApproved: boolean;
  callCount: number;
  lastCalledAt: string | null;
}

interface A2aLinkRow {
  id: string;
  targetName: string;
  targetAsset: { assetCode: string; name: string } | null;
  agentCardUrl: string | null;
  allowedSkills: string[];
  maxHopDepth: number;
  allowPiiSharing: boolean;
  isApproved: boolean;
  callCount: number;
  lastCalledAt: string | null;
}

interface ProtocolEventRow {
  id: string;
  protocol: "MCP" | "A2A";
  sourceAssetCode: string;
  targetName: string;
  operation: string;
  hopDepth: number;
  traceId: string | null;
  status: string;
  durationMs: number | null;
  violationReason: string | null;
  createdAt: string;
}

interface AssetAssuranceRow {
  id: string;
  assetCode: string;
  name: string;
  businessUnit: string;
  runtimeGateStatus: "ALLOW" | "RESTRICTED" | "SUSPENDED";
  runtimeGateReason: string | null;
  quarterlyBudgetAmount: number | null;
  quarterlyBudgetCurrency: "SGD" | "USD";
  quarterlySpend: number;
  bomComponents: BomRow[];
  dataSources: DataSourceRow[];
  evalScorecards: EvalRow[];
  mcpPolicies: McpPolicyRow[];
  a2aOutboundLinks: A2aLinkRow[];
}

interface ExceptionRow {
  id: string;
  title: string;
  businessUnit: string;
  justification: string;
  compensatingControls: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  approvedBy: string;
  asset: { id: string; assetCode: string; name: string } | null;
}

interface AttestationRow {
  id: string;
  policyName: string;
  policyVersion: string;
  businessUnit: string;
  attestedByName: string;
  attestedByEmail: string;
  trainingCompleted: boolean;
  attestedAt: string;
}

interface IncidentTimerRow {
  id: string;
  incidentCode: string;
  title: string;
  severity: string;
  assetCode: string;
  regulatoryFramework: string | null;
  notificationDueAt: string | null;
  reportedToRegulatorAt: string | null;
}

interface Props {
  quarter: string;
  canWrite: boolean;
  canSignOff: boolean;
  businessUnits: string[];
  initialAssets: AssetAssuranceRow[];
  initialExceptions: ExceptionRow[];
  initialAttestations: AttestationRow[];
  initialIncidents: IncidentTimerRow[];
  initialProtocolEvents: ProtocolEventRow[];
}

type TabKey = "gate-bom" | "mcp-a2a" | "data-evals" | "exceptions-aup" | "timers" | "finops";

const GATE_BADGE: Record<AssetAssuranceRow["runtimeGateStatus"], "success" | "warning" | "danger"> = {
  ALLOW: "success",
  RESTRICTED: "warning",
  SUSPENDED: "danger",
};

export function AssuranceClient({
  quarter,
  canWrite,
  canSignOff,
  businessUnits,
  initialAssets,
  initialExceptions,
  initialAttestations,
  initialIncidents,
  initialProtocolEvents,
}: Props) {
  const [tab, setTab] = useState<TabKey>("gate-bom");
  const [assets, setAssets] = useState<AssetAssuranceRow[]>(initialAssets);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>(initialExceptions);
  const [attestations, setAttestations] = useState<AttestationRow[]>(initialAttestations);
  const [incidents, setIncidents] = useState<IncidentTimerRow[]>(initialIncidents);
  const [protocolEvents, setProtocolEvents] = useState<ProtocolEventRow[]>(initialProtocolEvents);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAssets[0]?.id ?? "");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? assets[0];

  // Form states
  const [bomType, setBomType] = useState("MODEL");
  const [bomName, setBomName] = useState("");
  const [bomVersion, setBomVersion] = useState("1.0");
  const [bomProvider, setBomProvider] = useState("");

  const [dsName, setDsName] = useState("");
  const [dsType, setDsType] = useState("VECTOR_DB");
  const [dsClass, setDsClass] = useState("INTERNAL");
  const [dsPii, setDsPii] = useState(false);

  const [evalSuite, setEvalSuite] = useState("");
  const [evalType, setEvalType] = useState("RED_TEAM");
  const [evalPassRate, setEvalPassRate] = useState("92");
  const [evalThreshold, setEvalThreshold] = useState("85");

  const [exTitle, setExTitle] = useState("");
  const [exBu, setExBu] = useState(businessUnits[0] ?? "Engineering");
  const [exJust, setExJust] = useState("");
  const [exCtrl, setExCtrl] = useState("");
  const [exExpires, setExExpires] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );

  const [attName, setAttName] = useState("");
  const [attEmail, setAttEmail] = useState("");
  const [attBu, setAttBu] = useState(businessUnits[0] ?? "Engineering");
  const [attTraining, setAttTraining] = useState(true);

  const [budgetAmount, setBudgetAmount] = useState("5000");
  const [budgetCurrency, setBudgetCurrency] = useState<"SGD" | "USD">("SGD");

  const [timerIncidentId, setTimerIncidentId] = useState(initialIncidents[0]?.id ?? "");
  const [timerFramework, setTimerFramework] = useState("PDPC_72H");
  const [timerHours, setTimerHours] = useState("72");

  // MCP & A2A form states
  const [mcpServer, setMcpServer] = useState("");
  const [mcpTools, setMcpTools] = useState("read_query, list_tables");
  const [mcpRiskTier, setMcpRiskTier] = useState<"READ_ONLY" | "WRITE" | "DESTRUCTIVE">("READ_ONLY");
  const [mcpHitl, setMcpHitl] = useState(false);

  const [a2aTarget, setA2aTarget] = useState("");
  const [a2aTargetAssetId, setA2aTargetAssetId] = useState("");
  const [a2aSkills, setA2aSkills] = useState("verify_kyc");
  const [a2aMaxHop, setA2aMaxHop] = useState("2");
  const [a2aCardUrl, setA2aCardUrl] = useState("");

  async function refreshAll() {
    const res = await fetch("/api/assurance");
    if (res.ok) {
      const data = await res.json();
      setAssets(data.assets ?? []);
      setExceptions(data.exceptions ?? []);
      setAttestations(data.attestations ?? []);
      setProtocolEvents(
        (data.protocolEvents ?? []).map((ev: {
          id: string;
          protocol: "MCP" | "A2A";
          sourceAsset: { assetCode: string };
          targetName: string;
          operation: string;
          hopDepth: number;
          traceId: string | null;
          status: string;
          durationMs: number | null;
          violationReason: string | null;
          createdAt: string;
        }) => ({
          id: ev.id,
          protocol: ev.protocol,
          sourceAssetCode: ev.sourceAsset?.assetCode ?? "",
          targetName: ev.targetName,
          operation: ev.operation,
          hopDepth: ev.hopDepth,
          traceId: ev.traceId,
          status: ev.status,
          durationMs: ev.durationMs,
          violationReason: ev.violationReason,
          createdAt: ev.createdAt,
        })),
      );
      setIncidents(
        (data.incidents ?? []).map((inc: {
          id: string;
          incidentCode: string;
          title: string;
          severity: string;
          asset: { assetCode: string };
          regulatoryFramework: string | null;
          notificationDueAt: string | null;
          reportedToRegulatorAt: string | null;
        }) => ({
          id: inc.id,
          incidentCode: inc.incidentCode,
          title: inc.title,
          severity: inc.severity,
          assetCode: inc.asset?.assetCode ?? "",
          regulatoryFramework: inc.regulatoryFramework,
          notificationDueAt: inc.notificationDueAt,
          reportedToRegulatorAt: inc.reportedToRegulatorAt,
        })),
      );
    }
  }

  async function setGateStatus(assetCode: string, gateStatus: "ALLOW" | "RESTRICTED" | "SUSPENDED") {
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch(`/api/assets/${encodeURIComponent(assetCode)}/gate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gateStatus,
        reason: `Updated via Assurance Console to ${gateStatus}`,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatusMsg(`Runtime gate for ${assetCode} set to ${data.gateStatus}.`);
      await refreshAll();
    } else {
      setErrorMsg(data.error || "Failed to update runtime gate.");
    }
  }

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "gate-bom", label: "Kill-Switch & AI-BOM" },
            { key: "mcp-a2a", label: "MCP & A2A Graph" },
            { key: "data-evals", label: "Data Lineage & Evals" },
            { key: "exceptions-aup", label: "Exceptions & AUP" },
            { key: "timers", label: "Regulatory Timers" },
            { key: "finops", label: "FinOps Budget Caps" },
          ].map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={tab === item.key ? "primary" : "outline"}
              onClick={() => setTab(item.key as TabKey)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {(tab === "gate-bom" || tab === "mcp-a2a" || tab === "data-evals") && assets.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Asset:</span>
            <Select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="h-8 w-64 text-xs"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assetCode} — {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {tab === "gate-bom" && selectedAsset && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Runtime Kill-Switch / Circuit Breaker</CardTitle>
              <CardDescription>
                Production orchestrators poll <code>GET /api/assets/{selectedAsset.assetCode}/gate</code> before executing autonomous actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-xs text-muted-foreground">Current Gate Status</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={GATE_BADGE[selectedAsset.runtimeGateStatus]}>
                      {selectedAsset.runtimeGateStatus}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {selectedAsset.runtimeGateReason || "Normal operation"}
                    </span>
                  </div>
                </div>
                {canSignOff && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setGateStatus(selectedAsset.assetCode, "ALLOW")}>
                      Allow
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setGateStatus(selectedAsset.assetCode, "RESTRICTED")}>
                      Restrict
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setGateStatus(selectedAsset.assetCode, "SUSPENDED")}>
                      Suspend
                    </Button>
                  </div>
                )}
              </div>
              <pre className="rounded-md bg-surface-muted p-2.5 font-mono text-[11px] overflow-x-auto select-all">
                {`curl -H "Authorization: Bearer agx_live_YOUR_TOKEN" \\\n  http://localhost:3000/api/assets/${selectedAsset.assetCode}/gate`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Bill of Materials (AI-BOM)</CardTitle>
              <CardDescription>
                Authorised models, system prompts, MCP servers, tools, and guardrails for {selectedAsset.assetCode}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canWrite && (
                <form
                  className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch("/api/assurance", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "ADD_BOM_COMPONENT",
                        assetId: selectedAsset.id,
                        componentType: bomType,
                        name: bomName,
                        version: bomVersion,
                        provider: bomProvider || undefined,
                      }),
                    });
                    if (res.ok) {
                      setBomName("");
                      setStatusMsg("Added AI-BOM component.");
                      await refreshAll();
                    } else {
                      setErrorMsg("Failed to add AI-BOM component.");
                    }
                  }}
                >
                  <Select value={bomType} onChange={(e) => setBomType(e.target.value)} className="h-8 text-xs">
                    <option value="MODEL">Model</option>
                    <option value="PROMPT">System Prompt</option>
                    <option value="MCP_SERVER">MCP Server</option>
                    <option value="TOOL_API">Tool / API</option>
                    <option value="GUARDRAIL">Guardrail</option>
                  </Select>
                  <Input required placeholder="Name (e.g. gpt-4o)" value={bomName} onChange={(e) => setBomName(e.target.value)} className="h-8 text-xs" />
                  <Input placeholder="Version" value={bomVersion} onChange={(e) => setBomVersion(e.target.value)} className="h-8 text-xs" />
                  <Input placeholder="Provider" value={bomProvider} onChange={(e) => setBomProvider(e.target.value)} className="h-8 text-xs" />
                  <Button type="submit" size="sm">Add</Button>
                </form>
              )}
              <div className="space-y-1.5 text-xs">
                {selectedAsset.bomComponents.length === 0 ? (
                  <div className="text-muted-foreground">No AI-BOM components recorded yet.</div>
                ) : (
                  selectedAsset.bomComponents.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5">
                      <div>
                        <span className="font-semibold">{c.name}</span>{" "}
                        <span className="text-muted-foreground">v{c.version} · {c.componentType}</span>
                        {c.provider && <span className="text-muted-foreground"> · {c.provider}</span>}
                      </div>
                      <Badge variant={c.isApproved ? "success" : "danger"}>
                        {c.isApproved ? "Approved" : "Unapproved"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "data-evals" && selectedAsset && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>RAG &amp; Training Data Lineage</CardTitle>
              <CardDescription>Data repositories accessible by {selectedAsset.assetCode}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canWrite && (
                <form
                  className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch("/api/assurance", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "ADD_DATA_SOURCE",
                        assetId: selectedAsset.id,
                        sourceName: dsName,
                        sourceType: dsType,
                        classification: dsClass,
                        piiIncluded: dsPii,
                      }),
                    });
                    if (res.ok) {
                      setDsName("");
                      setStatusMsg("Linked data source.");
                      await refreshAll();
                    }
                  }}
                >
                  <Input required placeholder="Source name" value={dsName} onChange={(e) => setDsName(e.target.value)} className="h-8 text-xs sm:col-span-2" />
                  <Select value={dsType} onChange={(e) => setDsType(e.target.value)} className="h-8 text-xs">
                    <option value="VECTOR_DB">Vector DB</option>
                    <option value="DATA_WAREHOUSE">Warehouse</option>
                    <option value="DOCUMENT_REPO">Docs / Wiki</option>
                    <option value="CRM_ERP">CRM / ERP</option>
                    <option value="API_STREAM">API Stream</option>
                  </Select>
                  <Select value={dsClass} onChange={(e) => setDsClass(e.target.value)} className="h-8 text-xs">
                    <option value="PUBLIC">Public</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="CONFIDENTIAL">Confidential</option>
                    <option value="RESTRICTED_PII">Restricted PII</option>
                  </Select>
                  <Button type="submit" size="sm">Link</Button>
                  <label className="flex items-center gap-1.5 text-xs sm:col-span-5">
                    <input type="checkbox" checked={dsPii} onChange={(e) => setDsPii(e.target.checked)} />
                    Contains Personal Data / PII
                  </label>
                </form>
              )}
              <div className="space-y-1.5 text-xs">
                {selectedAsset.dataSources.length === 0 ? (
                  <div className="text-muted-foreground">No data sources linked yet.</div>
                ) : (
                  selectedAsset.dataSources.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5">
                      <div>
                        <span className="font-semibold">{d.sourceName}</span>{" "}
                        <span className="text-muted-foreground">({d.sourceType})</span>
                      </div>
                      <div className="flex gap-1.5">
                        {d.piiIncluded && <Badge variant="warning">PII</Badge>}
                        <Badge variant="outline">{d.classification}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pre-Deployment Red-Team &amp; Eval Scorecards</CardTitle>
              <CardDescription>Adversarial safety and accuracy benchmark results for {selectedAsset.assetCode}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canWrite && (
                <form
                  className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch("/api/assurance", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "ADD_EVAL_SCORECARD",
                        assetId: selectedAsset.id,
                        suiteName: evalSuite,
                        evalType,
                        passRate: Number(evalPassRate),
                        threshold: Number(evalThreshold),
                      }),
                    });
                    if (res.ok) {
                      setEvalSuite("");
                      setStatusMsg("Recorded eval scorecard.");
                      await refreshAll();
                    }
                  }}
                >
                  <Input required placeholder="Suite name" value={evalSuite} onChange={(e) => setEvalSuite(e.target.value)} className="h-8 text-xs sm:col-span-2" />
                  <Select value={evalType} onChange={(e) => setEvalType(e.target.value)} className="h-8 text-xs">
                    <option value="RED_TEAM">Red Team</option>
                    <option value="PROMPT_INJECTION">Prompt Injection</option>
                    <option value="HALLUCINATION">Hallucination</option>
                    <option value="BIAS_FAIRNESS">Bias / Fairness</option>
                    <option value="SAFETY_BENCHMARK">Safety</option>
                  </Select>
                  <Input type="number" step="0.1" placeholder="Pass %" value={evalPassRate} onChange={(e) => setEvalPassRate(e.target.value)} className="h-8 text-xs" />
                  <Button type="submit" size="sm">Record</Button>
                </form>
              )}
              <div className="space-y-1.5 text-xs">
                {selectedAsset.evalScorecards.length === 0 ? (
                  <div className="text-muted-foreground">No evaluation scorecards recorded yet.</div>
                ) : (
                  selectedAsset.evalScorecards.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5">
                      <div>
                        <span className="font-semibold">{ev.suiteName}</span>{" "}
                        <span className="text-muted-foreground">({ev.evalType}) · {ev.passRate}% / {ev.threshold}%</span>
                      </div>
                      <Badge variant={ev.passed ? "success" : "danger"}>
                        {ev.passed ? "PASS" : "FAIL"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "exceptions-aup" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Time-Bound Policy Exceptions &amp; Waivers</CardTitle>
              <CardDescription>Approved governance waivers with mandatory compensating controls and expiry dates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canSignOff && (
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch("/api/assurance", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "ADD_POLICY_EXCEPTION",
                        title: exTitle,
                        businessUnit: exBu,
                        justification: exJust,
                        compensatingControls: exCtrl,
                        expiresAt: exExpires,
                      }),
                    });
                    if (res.ok) {
                      setExTitle("");
                      setExJust("");
                      setExCtrl("");
                      setStatusMsg("Created policy exception.");
                      await refreshAll();
                    }
                  }}
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input required placeholder="Waiver title" value={exTitle} onChange={(e) => setExTitle(e.target.value)} className="h-8 text-xs" />
                    <Select value={exBu} onChange={(e) => setExBu(e.target.value)} className="h-8 text-xs">
                      {businessUnits.map((b) => <option key={b} value={b}>{b}</option>)}
                    </Select>
                    <Input required type="date" value={exExpires} onChange={(e) => setExExpires(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input required placeholder="Business justification" value={exJust} onChange={(e) => setExJust(e.target.value)} className="h-8 text-xs" />
                    <Input required placeholder="Compensating controls" value={exCtrl} onChange={(e) => setExCtrl(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <Button type="submit" size="sm">Grant Time-Bound Waiver</Button>
                </form>
              )}
              <div className="space-y-2 text-xs">
                {exceptions.length === 0 ? (
                  <div className="text-muted-foreground">No active policy exceptions.</div>
                ) : (
                  exceptions.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between rounded border border-border p-2.5">
                      <div>
                        <div className="font-semibold">{ex.title} ({ex.businessUnit})</div>
                        <div className="text-[11px] text-muted-foreground">
                          Controls: {ex.compensatingControls} · Expires {ex.expiresAt.slice(0, 10)}
                        </div>
                      </div>
                      <Badge variant={ex.status === "ACTIVE" ? "warning" : "secondary"}>{ex.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acceptable AI Use Policy (AUP) Attestations</CardTitle>
              <CardDescription>Track staff policy sign-offs and mandatory AI safety training completion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canWrite && (
                <form
                  className="grid grid-cols-1 gap-2 sm:grid-cols-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch("/api/assurance", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "ADD_POLICY_ATTESTATION",
                        businessUnit: attBu,
                        attestedByName: attName,
                        attestedByEmail: attEmail,
                        trainingCompleted: attTraining,
                      }),
                    });
                    if (res.ok) {
                      setAttName("");
                      setAttEmail("");
                      setStatusMsg("Recorded AUP attestation.");
                      await refreshAll();
                    }
                  }}
                >
                  <Input required placeholder="Staff name" value={attName} onChange={(e) => setAttName(e.target.value)} className="h-8 text-xs" />
                  <Input required type="email" placeholder="Staff email" value={attEmail} onChange={(e) => setAttEmail(e.target.value)} className="h-8 text-xs" />
                  <Select value={attBu} onChange={(e) => setAttBu(e.target.value)} className="h-8 text-xs">
                    {businessUnits.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                  <Button type="submit" size="sm">Log Attestation</Button>
                </form>
              )}
              <div className="space-y-1.5 text-xs">
                {attestations.length === 0 ? (
                  <div className="text-muted-foreground">No AUP attestations recorded yet.</div>
                ) : (
                  attestations.map((att) => (
                    <div key={att.id} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5">
                      <div>
                        <span className="font-semibold">{att.attestedByName}</span>{" "}
                        <span className="text-muted-foreground">({att.businessUnit}) · {att.policyName} v{att.policyVersion}</span>
                      </div>
                      <Badge variant={att.trainingCompleted ? "success" : "warning"}>
                        {att.trainingCompleted ? "Trained & Signed" : "Signed Only"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "timers" && (
        <Card>
          <CardHeader>
            <CardTitle>Statutory Incident Notification Timers</CardTitle>
            <CardDescription>
              Track PDPC 72-hour, EU AI Act serious-incident, and MAS TRM regulatory notification deadlines.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canWrite && incidents.length > 0 && (
              <form
                className="grid grid-cols-1 gap-2 sm:grid-cols-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch("/api/assurance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "SET_INCIDENT_TIMER",
                      incidentId: timerIncidentId,
                      regulatoryFramework: timerFramework,
                      hoursUntilDue: Number(timerHours),
                    }),
                  });
                  if (res.ok) {
                    setStatusMsg("Attached regulatory notification timer.");
                    await refreshAll();
                  }
                }}
              >
                <Select value={timerIncidentId} onChange={(e) => setTimerIncidentId(e.target.value)} className="h-8 text-xs">
                  {incidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.incidentCode} ({i.assetCode}) — {i.title}
                    </option>
                  ))}
                </Select>
                <Select value={timerFramework} onChange={(e) => setTimerFramework(e.target.value)} className="h-8 text-xs">
                  <option value="PDPC_72H">Singapore PDPC (72h)</option>
                  <option value="EU_AI_ACT_SERIOUS">EU AI Act Serious Incident</option>
                  <option value="MAS_TRM">MAS TRM Incident Notice</option>
                </Select>
                <Input type="number" min={1} max={720} value={timerHours} onChange={(e) => setTimerHours(e.target.value)} className="h-8 text-xs" placeholder="Hours" />
                <Button type="submit" size="sm">Start Timer</Button>
              </form>
            )}
            <div className="space-y-2 text-xs">
              {incidents.filter((i) => i.regulatoryFramework || i.notificationDueAt).length === 0 ? (
                <div className="text-muted-foreground">No regulatory notification timers active.</div>
              ) : (
                incidents
                  .filter((i) => i.regulatoryFramework || i.notificationDueAt)
                  .map((inc) => (
                    <div key={inc.id} className="flex items-center justify-between rounded border border-border p-2.5">
                      <div>
                        <div className="font-semibold">
                          {inc.incidentCode} ({inc.assetCode}) — {inc.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Framework: {inc.regulatoryFramework} · Due: {inc.notificationDueAt?.slice(0, 16).replace("T", " ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {inc.reportedToRegulatorAt ? (
                          <Badge variant="success">Reported</Badge>
                        ) : (
                          <>
                            <Badge variant="warning">Pending Filing</Badge>
                            {canSignOff && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  await fetch("/api/assurance", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "MARK_INCIDENT_REPORTED", id: inc.id }),
                                  });
                                  await refreshAll();
                                }}
                              >
                                Mark Reported
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "finops" && (
        <Card>
          <CardHeader>
            <CardTitle>FinOps Quarterly Budget Caps ({quarter})</CardTitle>
            <CardDescription>
              Set quarterly inference spend caps per asset. Live telemetry crossing 80% or 100% triggers <code>BUDGET_ALERT</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canWrite && assets.length > 0 && (
              <form
                className="grid grid-cols-1 gap-2 sm:grid-cols-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch("/api/assurance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "SET_BUDGET_CAP",
                      assetId: selectedAssetId,
                      quarterlyBudgetAmount: Number(budgetAmount),
                      quarterlyBudgetCurrency: budgetCurrency,
                    }),
                  });
                  if (res.ok) {
                    setStatusMsg("Updated quarterly FinOps budget cap.");
                    await refreshAll();
                  }
                }}
              >
                <Select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} className="h-8 text-xs">
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.assetCode} — {a.name}</option>)}
                </Select>
                <Input type="number" min={0} step="100" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} className="h-8 text-xs" placeholder="Budget cap" />
                <Select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value as "SGD" | "USD")} className="h-8 text-xs">
                  <option value="SGD">SGD</option>
                  <option value="USD">USD</option>
                </Select>
                <Button type="submit" size="sm">Save Budget Cap</Button>
              </form>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Asset</th>
                    <th className="py-2 pr-3 font-medium">Business Unit</th>
                    <th className="py-2 pr-3 font-medium">Quarterly Spend</th>
                    <th className="py-2 pr-3 font-medium">Budget Cap</th>
                    <th className="py-2 font-medium">Utilisation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assets.map((a) => {
                    const pct =
                      a.quarterlyBudgetAmount && a.quarterlyBudgetAmount > 0
                        ? (a.quarterlySpend / a.quarterlyBudgetAmount) * 100
                        : null;
                    return (
                      <tr key={a.id}>
                        <td className="py-2 pr-3 font-semibold">{a.assetCode} — {a.name}</td>
                        <td className="py-2 pr-3">{a.businessUnit}</td>
                        <td className="py-2 pr-3 font-mono">{a.quarterlyBudgetCurrency} {a.quarterlySpend.toLocaleString()}</td>
                        <td className="py-2 pr-3 font-mono">
                          {a.quarterlyBudgetAmount != null ? `${a.quarterlyBudgetCurrency} ${a.quarterlyBudgetAmount.toLocaleString()}` : "Uncapped"}
                        </td>
                        <td className="py-2">
                          {pct == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <Badge variant={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "success"}>
                              {pct.toFixed(1)}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "mcp-a2a" && selectedAsset && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>MCP Server &amp; Tool-Scope Policies ({selectedAsset.assetCode})</CardTitle>
                <CardDescription>
                  Define approved Model Context Protocol servers, allowed tools, risk tier, and HITL requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canWrite && (
                  <form
                    className="space-y-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch("/api/assurance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "ADD_MCP_POLICY",
                          assetId: selectedAsset.id,
                          serverName: mcpServer,
                          allowedTools: mcpTools
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                          riskTier: mcpRiskTier,
                          requiresHitl: mcpHitl,
                        }),
                      });
                      if (res.ok) {
                        setMcpServer("");
                        setStatusMsg("Saved MCP server policy.");
                        await refreshAll();
                      } else {
                        setErrorMsg("Failed to save MCP server policy.");
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input
                        required
                        placeholder="MCP Server (e.g. postgres-mcp)"
                        value={mcpServer}
                        onChange={(e) => setMcpServer(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="Allowed tools (comma-separated)"
                        value={mcpTools}
                        onChange={(e) => setMcpTools(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Select
                        value={mcpRiskTier}
                        onChange={(e) => setMcpRiskTier(e.target.value as "READ_ONLY" | "WRITE" | "DESTRUCTIVE")}
                        className="h-8 text-xs"
                      >
                        <option value="READ_ONLY">Read Only</option>
                        <option value="WRITE">Write</option>
                        <option value="DESTRUCTIVE">Destructive</option>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={mcpHitl} onChange={(e) => setMcpHitl(e.target.checked)} />
                        Requires Human-in-the-Loop Confirmation
                      </label>
                      <Button type="submit" size="sm">Save MCP Policy</Button>
                    </div>
                  </form>
                )}
                <div className="space-y-2 text-xs">
                  {selectedAsset.mcpPolicies.length === 0 ? (
                    <div className="text-muted-foreground">No MCP servers registered for {selectedAsset.assetCode}.</div>
                  ) : (
                    selectedAsset.mcpPolicies.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded border border-border p-2.5">
                        <div>
                          <div className="font-semibold">
                            {m.serverName} · <span className="font-mono text-[11px]">{m.riskTier}</span>
                            {m.requiresHitl && " · HITL"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Tools: {m.allowedTools.length > 0 ? m.allowedTools.join(", ") : "Any"} · Calls: {m.callCount}
                          </div>
                        </div>
                        <Badge variant={m.isApproved ? "success" : "danger"}>
                          {m.isApproved ? "Approved" : "Revoked"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>A2A Agent-to-Agent Trust Links ({selectedAsset.assetCode})</CardTitle>
                <CardDescription>
                  Control which downstream agents {selectedAsset.assetCode} may delegate to, permitted skills, and max hop depth.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canWrite && (
                  <form
                    className="space-y-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const targetAsset = assets.find((a) => a.id === a2aTargetAssetId);
                      const resolvedName = targetAsset ? targetAsset.assetCode : a2aTarget;
                      const res = await fetch("/api/assurance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "ADD_A2A_LINK",
                          sourceAssetId: selectedAsset.id,
                          targetAssetId: a2aTargetAssetId || null,
                          targetName: resolvedName,
                          agentCardUrl: a2aCardUrl || undefined,
                          allowedSkills: a2aSkills
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                          maxHopDepth: Number(a2aMaxHop) || 2,
                        }),
                      });
                      if (res.ok) {
                        setA2aTarget("");
                        setA2aCardUrl("");
                        setStatusMsg("Added A2A peer trust link.");
                        await refreshAll();
                      } else {
                        setErrorMsg("Failed to add A2A peer link.");
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Select
                        value={a2aTargetAssetId}
                        onChange={(e) => setA2aTargetAssetId(e.target.value)}
                        className="h-8 text-xs"
                      >
                        <option value="">External A2A Agent (enter name below)</option>
                        {assets
                          .filter((a) => a.id !== selectedAsset.id)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              Internal: {a.assetCode} — {a.name}
                            </option>
                          ))}
                      </Select>
                      <Input
                        required={!a2aTargetAssetId}
                        disabled={Boolean(a2aTargetAssetId)}
                        placeholder="External peer name (if external)"
                        value={a2aTarget}
                        onChange={(e) => setA2aTarget(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input
                        placeholder="Allowed skills (comma-separated)"
                        value={a2aSkills}
                        onChange={(e) => setA2aSkills(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        placeholder="Max hops"
                        value={a2aMaxHop}
                        onChange={(e) => setA2aMaxHop(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="Agent Card URL (/.well-known/agent.json)"
                        value={a2aCardUrl}
                        onChange={(e) => setA2aCardUrl(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button type="submit" size="sm">Add A2A Trust Link</Button>
                  </form>
                )}
                <div className="space-y-2 text-xs">
                  {selectedAsset.a2aOutboundLinks.length === 0 ? (
                    <div className="text-muted-foreground">No A2A peer links configured for {selectedAsset.assetCode}.</div>
                  ) : (
                    selectedAsset.a2aOutboundLinks.map((l) => (
                      <div key={l.id} className="flex items-center justify-between rounded border border-border p-2.5">
                        <div>
                          <div className="font-semibold">
                            {selectedAsset.assetCode} -&gt; {l.targetAsset ? `${l.targetAsset.assetCode} (${l.targetAsset.name})` : l.targetName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Skills: {l.allowedSkills.length > 0 ? l.allowedSkills.join(", ") : "Any"} · Max Hops: {l.maxHopDepth} · Calls: {l.callCount}
                          </div>
                        </div>
                        <Badge variant={l.isApproved ? "success" : "danger"}>
                          {l.isApproved ? "Approved" : "Revoked"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent MCP &amp; A2A Runtime Calls</CardTitle>
                <CardDescription>
                  Live delegation traces ingested via <code>POST /api/telemetry/mcp-a2a</code>. Unapproved calls automatically log Boundary Breaches.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {protocolEvents.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No MCP or A2A runtime calls ingested yet.</div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {protocolEvents.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5">
                        <div>
                          <span className="font-semibold">[{ev.protocol}]</span> {ev.sourceAssetCode} -&gt; {ev.targetName}{" "}
                          <span className="font-mono text-[11px] text-muted-foreground">({ev.operation}, hop {ev.hopDepth})</span>
                          {ev.violationReason && (
                            <div className="text-[11px] text-red-600">{ev.violationReason}</div>
                          )}
                        </div>
                        <Badge variant={ev.status === "OK" ? "success" : "danger"}>{ev.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stream MCP / A2A Telemetry</CardTitle>
                <CardDescription>
                  Send tool invocations or A2A task delegations from your gateway or middleware.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="rounded-md bg-surface-muted p-2.5 font-mono text-[11px] overflow-x-auto select-all">
                  {`curl -X POST http://localhost:3000/api/telemetry/mcp-a2a \\\n  -H "Authorization: Bearer agx_live_YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "protocol": "MCP",\n    "assetCode": "${selectedAsset.assetCode}",\n    "targetName": "postgres-mcp",\n    "operation": "read_query",\n    "hopDepth": 1,\n    "traceId": "trace-abc-123"\n  }'`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
