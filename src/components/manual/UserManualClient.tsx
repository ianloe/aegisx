"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer } from "lucide-react";

interface ManualSection {
  id: string;
  number: string;
  title: string;
  audience: string;
  route?: string;
  summary: string;
  steps: string[];
  notes?: string[];
}

const SECTIONS: ManualSection[] = [
  {
    id: "getting-started",
    number: "01",
    title: "Getting Started & Role-Based Access",
    audience: "All Users",
    route: "/",
    summary:
      "Aegis organises all governance around a central AI Asset Register, using FRAME as the enterprise governance envelope and AAEF as the agent-level evaluation discipline inside it.",
    steps: [
      "Sign in at /login using your assigned email and password (or Enterprise SSO when enabled by your administrator).",
      "Roles fall into three access tiers: Administrator (full system configuration and user management), Editors (AI Governance Office, Asset Owner, Assessor), and Viewers (Executive and Auditor, read-only).",
      "Use the sun/moon toggle in the top bar to switch between light and dark mode, and the bell icon to view governance alerts.",
    ],
    notes: [
      "Every write action (create, update, approval, sign-off, or deletion) is recorded in the immutable Audit Log with before-and-after values.",
    ],
  },
  {
    id: "executive-dashboard",
    number: "02",
    title: "Executive Dashboard & A4 Board Pack",
    audience: "Executives, Governance Office, Auditors",
    route: "/",
    summary:
      "Provides a single-page portfolio view of AI assets, average FRAME maturity, AAEF profile distribution, top risks versus appetite, portfolio ROI, overdue actions, and recent incidents.",
    steps: [
      "Filter the portfolio by Business Unit, Country, Lifecycle Stage, Autonomy Level, or Vendor using the filter bar.",
      "Click any KPI tile, chart segment, or table row to drill down directly to the underlying source records and attached evidence.",
      "Click Export Board Pack (A4 PDF) to generate a dated, print-ready executive summary in British English.",
    ],
  },
  {
    id: "governance-queue",
    number: "03",
    title: "My Governance Queue & Stage-Gate Approvals",
    audience: "Asset Owners, Assessors, Governance Office",
    route: "/queue",
    summary:
      "Your personal governance inbox showing pending lifecycle stage-gate approvals, open actions assigned to you, pending AAEF sign-offs, overdue risk reviews, and assets with lapsed role reviews.",
    steps: [
      "Open My Governance Queue from the sidebar to review items requiring your attention.",
      "To promote an AI asset (for example from Pilot to Production, or to Autonomous execution), open the asset detail page and submit a Lifecycle Stage-Gate Request.",
      "Aegis automatically evaluates readiness checks (Accountable Owner & Overseer, Authority Matrix, FRAME maturity, Risk Appetite, and AAEF Operational status) and attaches a readiness snapshot.",
      "AI Governance Office or Administrators can Approve or Reject the promotion with decision notes. Approval atomically updates the asset's lifecycle stage and autonomy level.",
    ],
  },
  {
    id: "asset-register",
    number: "04",
    title: "AI Asset Register",
    audience: "Asset Owners, Governance Office, Assessors",
    route: "/assets",
    summary:
      "The central register of every AI system, copilot, RAG assistant, model, autonomous agent, or vendor AI feature across the organisation.",
    steps: [
      "Click Register AI Asset to add a new asset with its Business Unit, Country, Accountable Owner, Human Overseer, Escalation Path, Lifecycle Stage, Autonomy Level, Data Sensitivity, and Sourcing Type.",
      "Tick This asset is an AI Agent to enrol the asset in AAEF 30-day, 90-day, and ongoing appraisal cycles.",
      "Use Import CSV and Export CSV for bulk updates; CSV exports automatically neutralise spreadsheet formula injection.",
      "Click any asset to open its Asset Detail Hub, which displays the FRAME governance envelope wrapping the asset's inner AAEF agent evaluation.",
    ],
  },
  {
    id: "frame-governance",
    number: "05",
    title: "FRAME Governance Assessment",
    audience: "Assessors, Asset Owners, Governance Office",
    route: "/frame",
    summary:
      "Captures each AI asset's governance maturity across five dimensions: Focus, Roles, Authority, Metrics, and Evaluation.",
    steps: [
      "Select an asset and score each criterion from 0 to 4 with written rationale and attached evidence.",
      "Review the Portfolio Heatmap to compare maturity across all assets and dimensions, and inspect the Radar Chart for dimension balance.",
      "Use the Authority Matrix tab to define and version what the asset may do autonomously, what requires human confirmation, and what is strictly out of scope.",
      "Use the Roles & Escalation tab to verify named accountable owners, human overseers, and escalation paths; assets with missing or lapsed reviews are flagged automatically.",
      "In the Metrics view, always pair Activity Metrics (usage, volume) with Outcome Metrics (business result); Aegis warns whenever an asset only reports activity.",
    ],
  },
  {
    id: "aaef-appraisals",
    number: "06",
    title: "AAEF Agent Appraisal & Boundary Breaches",
    audience: "Assessors, Governance Office",
    route: "/aaef",
    summary:
      "Evaluates AI agents as workforce members across Task Competence, Judgement Quality, Boundary Adherence (binary), Collaboration Effectiveness, and Improvement Trajectory.",
    steps: [
      "Monitor the Appraisal Scheduler for upcoming, due, and overdue 30-day, 90-day, and ongoing quarterly/biannual reviews.",
      "Run an appraisal by scoring Task Competence, Judgement Quality, and Collaboration Effectiveness (0 to 4) and recording whether Boundary Adherence passed or failed.",
      "Aegis computes Improvement Trajectory (Improving, Stable, or Degrading) from prior appraisals and assigns a Performance Profile (Operational, Developing, Restricted, or Under Review) with a transparent rule trace.",
      "Log any Boundary Breach with date, severity, authority rule breached, and remediation. Logging a breach automatically re-evaluates the agent's Performance Profile and prompts the required governance consequence.",
      "AI Governance Office users record formal sign-off on the appraisal, and can open the Printable Appraisal Form for formal review records.",
    ],
  },
  {
    id: "risk-controls",
    number: "07",
    title: "Risk Register, Controls, Crosswalk & Incidents",
    audience: "Risk Owners, Assessors, Governance Office",
    route: "/risks",
    summary:
      "Manages AI risks, inherent versus residual 5x5 heat maps, risk appetite thresholds, control effectiveness testing, multi-framework crosswalks, and AI incidents.",
    steps: [
      "Log risks linked to an AI asset and FRAME dimension with inherent and residual Likelihood and Impact (1 to 5), owner, and treatment (Mitigate, Accept, Transfer, Avoid).",
      "Inspect the 5x5 Heat Map to compare inherent versus residual risk and identify any Risk Appetite breaches.",
      "Record control effectiveness tests in the Control Library and link controls to FRAME, AAEF, ISO/IEC 42001, EU AI Act, NIST AI RMF, COSO, and Singapore MAS guidelines.",
      "Log AI incidents and near misses with root cause, lessons learned, and linked remediation actions.",
    ],
  },
  {
    id: "regulatory-readiness",
    number: "08",
    title: "Regulatory Readiness & Crosswalk Gap Analysis",
    audience: "Governance Office, Auditors, Executives",
    route: "/compliance",
    summary:
      "Aggregates framework requirements, mapped controls, effectiveness test results, and evidence counts into a live compliance posture dashboard.",
    steps: [
      "Select a framework card (for example ISO/IEC 42001, EU AI Act, NIST AI RMF, or Singapore MAS) to inspect requirement-by-requirement coverage.",
      "Filter by posture status (Unmapped Gaps, Ineffective Controls, Untested/Partial, or Covered & Effective) to prioritise remediation.",
      "Click Export Evidence Pack (CSV) to download a regulator-ready or auditor-ready traceability matrix.",
    ],
  },
  {
    id: "vendor-due-diligence",
    number: "09",
    title: "Vendor & Third-Party AI Due Diligence",
    audience: "Asset Owners, Governance Office",
    route: "/vendors",
    summary:
      "Tracks external model governance for all Vendor-sourced AI assets, including data residency, zero-data-retention guarantees, sub-processors, and exit portability.",
    steps: [
      "Open Vendor Due Diligence to view all Vendor-sourced AI assets and their review status.",
      "Click Assess or Edit to record the vendor's model card URL, data residency region, contractual Zero Data Retention status, sub-processors, renewal date, and exit plan.",
    ],
  },
  {
    id: "roi-value",
    number: "10",
    title: "ROI, Value-at-Risk & Pluggable Value Models",
    audience: "Asset Owners, Executives, Governance Office",
    route: "/roi",
    summary:
      "Tracks TCO, Net Benefit, ROI %, Payback Period, NPV, Cost per Outcome, and Risk-Adjusted Return in SGD (default) or USD, visibly distinguishing Measured from Estimated and Assumed value.",
    steps: [
      "Switch reporting currency between SGD (default) and USD at the top of the ROI & Value view.",
      "Log Cost Items (build, licence, inference and compute, people, change management, governance) and Benefit Items with a confidence rating (Measured, Estimated, or Assumed).",
      "Inspect the Value-at-Risk view to see how open residual risks from the Risk Register adjust net return.",
      "Use the Agentic P&L Framework and Capability Capitalisation Model tabs to review extension points ready for custom methodology logic.",
    ],
  },
  {
    id: "evidence-audit",
    number: "11",
    title: "Evidence Store, Actions & Immutable Audit Log",
    audience: "All Users (Audit Log: Admin, Governance Office, Auditor)",
    route: "/evidence",
    summary:
      "Centralises uploaded evidence files, external links, remediation actions, and the tamper-evident audit trail of every governance change.",
    steps: [
      "Upload supporting files or attach URLs to any asset, assessment, risk, control, or incident from Evidence & Actions.",
      "Track action items by owner, due date, and status; overdue actions surface in My Governance Queue and the Executive Dashboard.",
      "Auditors and Governance Office users can inspect the full Audit Log (/audit) to verify who changed what, when, and the exact before/after state.",
    ],
  },
  {
    id: "admin-integrations",
    number: "12",
    title: "Administration, Business Units & API / Integrations",
    audience: "Administrators, Governance Office",
    route: "/admin",
    summary:
      "Provides non-technical forms to configure Risk Appetite, Financial Defaults, FRAME rubrics, AAEF profile rules, Business Units, Users & Roles, Telemetry API keys, Webhooks, and Enterprise SSO.",
    steps: [
      "In Admin Config (/admin), use Parameters & Appetite to adjust Risk Appetite thresholds, SGD/USD rate, NPV discount rate, and cadence thresholds without touching JSON or code.",
      "Use Business Units to add, edit, or safely remove organisational units, and Users & Roles to add Administrators, Editors, or Viewers.",
      "In API & Integrations (/integrations), generate Bearer tokens for POST /api/telemetry/ingest to stream live Boundary Breaches and Measured ROI costs from production agents.",
      "Configure In-App Bell or Slack/Teams Webhooks for automated alerts, run an on-demand Governance Digest, and review Enterprise SSO (OIDC) status.",
    ],
  },
];

export function UserManualClient() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.steps.some((st) => st.toLowerCase().includes(q)) ||
        s.audience.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Input
          type="search"
          aria-label="Search user manual"
          placeholder="Search manual topics (e.g. stage-gate, AAEF, telemetry, ROI, backup)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          <span>Print / Save Manual as PDF</span>
        </Button>
      </div>

      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quick Contents</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {filtered.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded border border-border px-2.5 py-1.5 hover:bg-surface-muted/50 flex items-center gap-2"
            >
              <span className="font-mono text-muted-foreground">{s.number}</span>
              <span className="font-medium truncate">{s.title}</span>
            </a>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-xs text-muted-foreground">
              No manual sections match &ldquo;{query}&rdquo;.
            </CardContent>
          </Card>
        ) : (
          filtered.map((s) => (
            <Card key={s.id} id={s.id} className="scroll-mt-6">
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">Section {s.number}</Badge>
                    <Badge variant="info">{s.audience}</Badge>
                  </div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription className="mt-1">{s.summary}</CardDescription>
                </div>
                {s.route && (
                  <Link href={s.route} className="print:hidden">
                    <Button type="button" size="sm" variant="outline">
                      Open Module
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-relaxed">
                <ol className="list-decimal list-inside space-y-1.5 text-foreground">
                  {s.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                {s.notes && s.notes.length > 0 && (
                  <div className="rounded-md border border-border bg-surface-muted/40 p-2.5 text-[11px] text-muted-foreground">
                    {s.notes.map((n, idx) => (
                      <p key={idx}>{n}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
