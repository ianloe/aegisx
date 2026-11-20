"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, GraduationCap, Presentation } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LabModule {
  id: string;
  number: string;
  title: string;
  duration: string;
  roles: string[];
  route: string;
  routeLabel: string;
  objective: string;
  steps: string[];
  trainerCue: string;
}

const LABS: LabModule[] = [
  {
    id: "lab-1",
    number: "Lab 01",
    title: "Executive Command Centre & Board Pack Export",
    duration: "15 min",
    roles: ["EXECUTIVE", "GOVERNANCE_OFFICE", "ADMIN"],
    route: "/",
    routeLabel: "Open Executive Dashboard",
    objective: "Filter the AI portfolio, generate an AI Executive Briefing, and export a board-ready A4 PDF.",
    steps: [
      "Open the Executive Dashboard (/) and use the Global Portfolio Filter Bar to filter by Business Unit and Lifecycle Stage = Production.",
      "Inspect the 7 KPI tiles: AI Assets, Avg FRAME Maturity, AAEF Risk, Risk Posture, Measured ROI, Overdue Actions, and Shadow AI.",
      "Click Generate AI Insights on the AI Executive & Board Briefing card (requires a configured LLM in Admin Config).",
      "Click Export Board Pack (A4 PDF) to download a snapshot matching your active filters.",
    ],
    trainerCue:
      "Demonstrate how filtering by a single Business Unit updates both the charts and the exported A4 Board Pack PDF dynamically.",
  },
  {
    id: "lab-2",
    number: "Lab 02",
    title: "Asset Onboarding, FRAME Maturity & AAEF Appraisals",
    duration: "25 min",
    roles: ["ASSET_OWNER", "ASSESSOR", "GOVERNANCE_OFFICE", "ADMIN"],
    route: "/frame",
    routeLabel: "Open FRAME Governance",
    objective: "Inspect an AI asset's governance envelope and see how binary Boundary Adherence drives AAEF profiles.",
    steps: [
      "Open AI Asset Register (/assets) and inspect an autonomous agent (e.g. AI-001), noting its Owner, Overseer, and Autonomy Level.",
      "Open FRAME Governance (/frame) and review the 5-dimension maturity scores (Focus, Roles, Authority, Metrics, Evaluation).",
      "Check whether metrics are Activity-Only vs Outcome-Linked.",
      "Open AAEF Appraisals (/aaef) and verify how a Boundary Adherence failure immediately downgrades an agent to Restricted or Under Review.",
    ],
    trainerCue:
      "Emphasise that FRAME sets the enterprise envelope while AAEF evaluates individual agents inside that envelope.",
  },
  {
    id: "lab-3",
    number: "Lab 03",
    title: "Risk Register, Regulatory Crosswalks & FinOps ROI",
    duration: "20 min",
    roles: ["GOVERNANCE_OFFICE", "ASSESSOR", "EXECUTIVE", "AUDITOR", "ADMIN"],
    route: "/risks",
    routeLabel: "Open Risk & Controls",
    objective: "Evaluate residual risk against Risk Appetite and separate Measured vs Estimated/Assumed ROI.",
    steps: [
      "Open Risk & Controls (/risks) and inspect the 5x5 Residual Risk Heatmap for risks breaching the configured appetite.",
      "Open Regulatory Readiness (/compliance) to review control coverage across IMDA, ISO/IEC 42001, NIST AI RMF, and the EU AI Act.",
      "Open ROI & Value (/roi) and compare Measured benefits (from verified actuals/telemetry) against Estimated and Assumed benefits.",
    ],
    trainerCue:
      "Highlight how separating Measured from Assumed benefits prevents inflated ROI claims in board reporting.",
  },
  {
    id: "lab-4",
    number: "Lab 04",
    title: "Shadow AI Discovery & SASE / DNS Triage",
    duration: "20 min",
    roles: ["GOVERNANCE_OFFICE", "ADMIN"],
    route: "/shadow-ai",
    routeLabel: "Open Shadow AI",
    objective: "Ingest simulated SASE/DNS traffic to detect unregistered AI usage and promote or block candidates.",
    steps: [
      "Open Shadow AI (/shadow-ai) from the sidebar.",
      "In Simulate Network Discovery Event, enter Domain = chatgpt.com, Source = SASE / SWG, Business Unit = Marketing, and click Send Test Discovery Event.",
      "Verify that Aegis matches the domain to ChatGPT, updates request counts and uploaded MB, and logs the candidate.",
      "Practice triaging: click Promote to onboard into the AI Asset Register (Idea stage), or Block to flag prohibited traffic.",
    ],
    trainerCue:
      "Explain that repeat traffic hitting a BLOCKED domain automatically escalates as a CRITICAL SHADOW_AI_DETECTED alert.",
  },
  {
    id: "lab-5",
    number: "Lab 05",
    title: "Runtime Kill-Switch, AI-BOM, MCP / A2A & FinOps Caps",
    duration: "30 min",
    roles: ["ASSET_OWNER", "GOVERNANCE_OFFICE", "ADMIN"],
    route: "/assurance",
    routeLabel: "Open Assurance & AI-BOM",
    objective: "Enforce runtime gates, register AI-BOM components, govern MCP tools & A2A hops, and set budget caps.",
    steps: [
      "Open Assurance & AI-BOM (/assurance) and select asset AI-001.",
      "In Kill-Switch & AI-BOM, register a MODEL component and test toggling the runtime gate (Allow / Restrict / Suspend).",
      "In the MCP & A2A Graph tab, add an McpServerPolicy (e.g. postgres-mcp with allowedTools: read_query, list_tables) and an A2aPeerLink with maxHopDepth: 2.",
      "In API & Integrations (/integrations), note how POST /api/telemetry/mcp-a2a flags out-of-scope tools or excessive hop depths as HIGH Boundary Breaches.",
      "In FinOps Budget Caps, set a quarterly SGD cap to track live spend utilisation (alerts fire at 80% and 100%).",
    ],
    trainerCue:
      "Show GET /api/assets/AI-001/gate and explain how production orchestrators poll this before executing autonomous actions.",
  },
  {
    id: "lab-6",
    number: "Lab 06",
    title: "BYO-AI Insights & Telegram / Webhook Alert Routing",
    duration: "20 min",
    roles: ["ADMIN", "GOVERNANCE_OFFICE"],
    route: "/admin",
    routeLabel: "Open Admin Config",
    objective: "Configure an LLM provider for AI Insights and route alerts to Slack, Teams, or Telegram.",
    steps: [
      "Open Admin Config (/admin) -> Alerts & Integrations and inspect rules such as SHADOW_AI_DETECTED and UNAPPROVED_MCP_OR_A2A.",
      "Note that each rule supports In-App Bell, Webhook (Slack / Teams), or Telegram Bot (Bot Token + Chat ID).",
      "Open Admin Config (/admin) -> AI Insights (BYO LLM), select OpenRouter, Gemini, Claude, OpenAI, or Custom OpenAI-Compatible.",
      "Enter a Model ID and API Key, click Test Connection, enable AI Insights, and save.",
    ],
    trainerCue:
      "Reassure security teams that API keys are stored server-side, masked in the UI, and never sent to the browser.",
  },
];

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUIZ: QuizQuestion[] = [
  {
    id: "q1",
    question: "Which AAEF dimension is binary (pass/fail) and immediately downgrades an agent if breached?",
    options: [
      "Task Competence",
      "Boundary Adherence",
      "Collaboration Effectiveness",
      "Judgement Quality",
    ],
    correctIndex: 1,
    explanation: "Boundary Adherence is binary; any breach downgrades the agent to Restricted or Under Review.",
  },
  {
    id: "q2",
    question: "What happens when an agent calls an MCP tool not listed in its approved allowedTools scope?",
    options: [
      "It is silently ignored",
      "It logs an UNAPPROVED trace, creates a HIGH Boundary Breach, restricts the gate, and fires an alert",
      "It deletes the asset from the register",
      "It only sends a weekly digest email",
    ],
    correctIndex: 1,
    explanation: "POST /api/telemetry/mcp-a2a enforces MCP tool scopes and A2A hop limits in real time.",
  },
  {
    id: "q3",
    question: "Where do Administrators configure a Telegram Bot Token and Chat ID for governance alerts?",
    options: [
      "Shadow AI (/shadow-ai)",
      "API & Integrations (/integrations) or Admin Config (/admin) -> Alerts & Integrations",
      "ROI & Value (/roi)",
      "Audit Log (/audit)",
    ],
    correctIndex: 1,
    explanation: "Both /integrations and /admin allow selecting Telegram Bot per alert rule.",
  },
  {
    id: "q4",
    question: "When a BLOCKED Shadow AI domain receives new SASE or DNS traffic, what alert severity is raised?",
    options: ["INFO", "WARNING", "CRITICAL", "No alert is sent"],
    correctIndex: 2,
    explanation: "Repeat traffic to a BLOCKED domain triggers a CRITICAL SHADOW_AI_DETECTED alert.",
  },
  {
    id: "q5",
    question: "Where are BYO-AI provider API keys stored when configured in Admin Config?",
    options: [
      "In browser localStorage",
      "Server-side in GovernanceConfig (masked in the UI, never exposed to the browser)",
      "In public/aegis-logo.png metadata",
      "In URL query parameters",
    ],
    correctIndex: 1,
    explanation: "API keys remain server-side in PostgreSQL GovernanceConfig and are masked in UI responses.",
  },
];

const STORAGE_KEY = "aegis_training_progress_v1";

export function TrainingPortalClient({
  userName,
  userRole,
  isTrainerEligible,
}: {
  userName: string;
  userRole: string;
  isTrainerEligible: boolean;
}) {
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [completedLabs, setCompletedLabs] = useState<string[]>([]);
  const [trainerMode, setTrainerMode] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCompletedLabs(parsed);
      }
    } catch {
      // Ignore storage read errors
    }
  }, []);

  function toggleLabComplete(labId: string) {
    setCompletedLabs((prev) => {
      const next = prev.includes(labId) ? prev.filter((id) => id !== labId) : [...prev, labId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }

  const visibleLabs = useMemo(() => {
    if (roleFilter === "ALL") return LABS;
    if (roleFilter === "MY_ROLE") return LABS.filter((l) => l.roles.includes(userRole));
    return LABS.filter((l) => l.roles.includes(roleFilter));
  }, [roleFilter, userRole]);

  const progressPct = Math.round((completedLabs.length / LABS.length) * 100);
  const quizScore = QUIZ.reduce(
    (sum, q) => (answers[q.id] === q.correctIndex ? sum + 1 : sum),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Progress & Role Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span>Welcome, {userName}</span>
              <Badge variant="outline">{userRole}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Completed {completedLabs.length} of {LABS.length} hands-on labs ({progressPct}%)
            </div>
            <div className="h-2 w-64 max-w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: "All Labs (6)" },
              { id: "MY_ROLE", label: `My Role (${userRole})` },
              { id: "EXECUTIVE", label: "Executive" },
              { id: "GOVERNANCE_OFFICE", label: "Governance" },
              { id: "ASSET_OWNER", label: "Engineering / Owner" },
              { id: "ADMIN", label: "Admin / SecOps" },
            ].map((btn) => (
              <Button
                key={btn.id}
                type="button"
                size="sm"
                variant={roleFilter === btn.id ? "primary" : "outline"}
                onClick={() => setRoleFilter(btn.id)}
              >
                {btn.label}
              </Button>
            ))}

            {isTrainerEligible && (
              <Button
                type="button"
                size="sm"
                variant={trainerMode ? "primary" : "outline"}
                onClick={() => setTrainerMode((v) => !v)}
              >
                <Presentation className="h-3.5 w-3.5 mr-1" />
                {trainerMode ? "Hide Trainer Guide" : "Trainer Guide Mode"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trainer Agenda & Setup Panel (when Trainer Mode is toggled) */}
      {trainerMode && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Facilitator &amp; Trainer Guide</CardTitle>
            <CardDescription>
              Pre-session checklist, 3-hour workshop agenda, and live troubleshooting cues.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2 text-xs">
            <div className="space-y-2">
              <div className="font-semibold">Recommended 3-Hour Workshop Agenda</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong>00:00 - 00:25</strong>: FRAME &amp; AAEF Framework Overview (<code>/about</code>)</li>
                <li><strong>00:25 - 00:55</strong>: Executive Oversight, AI Briefings &amp; Board Packs (Lab 01)</li>
                <li><strong>00:55 - 01:35</strong>: Asset Onboarding, FRAME &amp; AAEF Appraisals (Lab 02)</li>
                <li><strong>01:50 - 02:20</strong>: Risk Heatmap, Crosswalks &amp; Shadow AI (Lab 03 &amp; Lab 04)</li>
                <li><strong>02:20 - 02:50</strong>: Kill-Switch, AI-BOM, MCP/A2A &amp; BYO-AI (Lab 05 &amp; Lab 06)</li>
                <li><strong>02:50 - 03:00</strong>: Knowledge Check Quiz &amp; AUP Attestation</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="font-semibold">Pre-Class Environment &amp; Troubleshooting</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Verify <code>/api/health</code> returns <code>database: connected</code> and demo data is seeded.</li>
                <li>Pre-configure a test LLM key in <code>/admin</code> (AI Insights) and test Slack/Telegram webhook.</li>
                <li><strong>401 on telemetry</strong>: Generate a fresh <code>agx_live_...</code> token in <code>/integrations</code>.</li>
                <li><strong>404 on telemetry</strong>: Verify exact <code>assetCode</code> (e.g. <code>AI-001</code>).</li>
                <li><strong>400 on AI Insights</strong>: Enable the provider and save in <code>/admin</code>.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interactive Labs Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visibleLabs.map((lab) => {
          const done = completedLabs.includes(lab.id);
          return (
            <Card key={lab.id} className={done ? "border-emerald-500/50" : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Badge variant="outline">{lab.number}</Badge>
                      <span>{lab.duration}</span>
                    </div>
                    <CardTitle className="text-base">{lab.title}</CardTitle>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={done ? "primary" : "outline"}
                    onClick={() => toggleLabComplete(lab.id)}
                  >
                    {done ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Completed
                      </>
                    ) : (
                      <>
                        <Circle className="h-3.5 w-3.5 mr-1" />
                        Mark Complete
                      </>
                    )}
                  </Button>
                </div>
                <CardDescription>{lab.objective}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                  {lab.steps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>

                {trainerMode && (
                  <div className="rounded border border-primary/30 bg-primary/5 p-2.5 text-[11px]">
                    <span className="font-semibold text-primary">Trainer Cue: </span>
                    {lab.trainerCue}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex flex-wrap gap-1">
                    {lab.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                  <Link
                    href={lab.route}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <span>{lab.routeLabel}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Interactive Knowledge Check Quiz */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge Check Quiz</CardTitle>
          <CardDescription>
            Verify your understanding of Aegis governance workflows, telemetry enforcement, and BYO-AI configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-xs">
          {QUIZ.map((q, qIdx) => (
            <div key={q.id} className="space-y-2 border-b border-border pb-4 last:border-b-0 last:pb-0">
              <div className="font-semibold text-sm">
                {qIdx + 1}. {q.question}
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {q.options.map((opt, oIdx) => {
                  const selected = answers[q.id] === oIdx;
                  const isCorrect = q.correctIndex === oIdx;
                  let borderCls = "border-border";
                  if (quizSubmitted && selected && isCorrect) borderCls = "border-emerald-500 bg-emerald-500/10";
                  else if (quizSubmitted && selected && !isCorrect) borderCls = "border-red-500 bg-red-500/10";
                  else if (quizSubmitted && isCorrect) borderCls = "border-emerald-500/50";
                  return (
                    <label
                      key={oIdx}
                      className={`flex items-center gap-2 rounded border p-2 cursor-pointer ${borderCls}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
              {quizSubmitted && (
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold">Explanation:</span> {q.explanation}
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => setQuizSubmitted(true)}>
                Check Answers
              </Button>
              {quizSubmitted && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuizSubmitted(false);
                    setAnswers({});
                  }}
                >
                  Reset Quiz
                </Button>
              )}
            </div>
            {quizSubmitted && (
              <Badge variant={quizScore >= 4 ? "success" : "warning"}>
                Score: {quizScore} / {QUIZ.length}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
