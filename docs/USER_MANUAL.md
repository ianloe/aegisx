# Aegis: AI Governance Platform User Manual

> **Attribution**: FRAME and AAEF by Ian Loe, Tactics Solutions, licensed CC BY-NC 4.0.

---

## 1. Getting Started & Role-Based Access

Aegis organises all governance around a central **AI Asset Register**, using **FRAME** as the enterprise governance envelope and **AAEF** as the agent-level evaluation discipline inside it.

1. Sign in at `/login` using your assigned email and password (or Enterprise SSO when enabled).
2. Roles fall into three access tiers:
   - **Administrator**: `Administrator` (full system configuration, business units, API keys, and user management).
   - **Editors**: `AI Governance Office` (oversight, approvals, sign-offs), `Asset Owner` (assigned assets, risks, ROI, actions), `Assessor` (FRAME assessments, AAEF appraisals, control tests).
   - **Viewers**: `Executive` (read-only dashboards and board packs), `Auditor` (read-only across all records plus full immutable audit log).
3. Every write action is recorded in the immutable **Audit Log** (`/audit`) with before-and-after values.

---

## 2. Executive Dashboard & A4 Board Pack (`/`)

- Filter the portfolio by **Business Unit**, **Country**, **Lifecycle Stage**, **Autonomy Level**, or **Vendor**.
- Click any KPI tile, chart segment, or table row to drill down to the underlying records and evidence.
- Click **Export Board Pack (A4 PDF)** to download a dated, print-ready executive summary in British English.

---

## 3. My Governance Queue & Stage-Gate Approvals (`/queue`)

- View pending lifecycle stage-gate approvals, open actions assigned to you, pending AAEF sign-offs, overdue risk reviews, and assets with lapsed role reviews.
- On any asset's detail page (`/assets/[id]`), request promotion across lifecycle stages or autonomy levels. Aegis automatically evaluates readiness checks (Accountable Owner & Overseer, Authority Matrix, FRAME maturity, Risk Appetite, and AAEF Operational status for autonomous agents).
- AI Governance Office or Administrators can approve or reject promotion requests; approval atomically updates the asset's lifecycle stage and autonomy level.

---

## 4. AI Asset Register (`/assets`)

- Register AI systems, copilots, RAG assistants, models, autonomous agents, and vendor AI features.
- Tick **This asset is an AI Agent** to enrol an asset in AAEF 30-day, 90-day, and ongoing appraisal cycles.
- Use **Import CSV** and **Export CSV** for bulk operations.
- Click any asset to open its **Asset Detail Hub**, showing the FRAME governance envelope wrapping the inner AAEF agent evaluation.

---

## 5. FRAME Governance Assessment (`/frame`)

- Score each asset across **Focus**, **Roles**, **Authority**, **Metrics**, and **Evaluation** (0 to 4) with written rationale and attached evidence.
- Use the **Portfolio Heatmap** and **Radar Chart** to identify dimension imbalances.
- Maintain a versioned **Authority Matrix** (Autonomous, Human-Confirmed, Out of Scope).
- Keep **Roles & Escalation** current; Aegis flags missing or lapsed role reviews.
- Separate **Activity Metrics** (usage, volume) from **Outcome Metrics** (business result); Aegis warns when an asset only reports activity.

---

## 6. AAEF Agent Appraisal & Boundary Breaches (`/aaef`)

- Track 30-day, 90-day, and ongoing quarterly/biannual appraisals in the **Appraisal Scheduler**.
- Score **Task Competence**, **Judgement Quality**, and **Collaboration Effectiveness** (0 to 4), and record binary **Boundary Adherence** (Passed or Failed).
- Aegis computes **Improvement Trajectory** (`Improving`, `Stable`, `Degrading`) and assigns a **Performance Profile** (`Operational`, `Developing`, `Restricted`, `Under Review`) with an explicit rule explanation and governance consequence.
- Logging a **Boundary Breach** automatically re-evaluates the agent's latest Performance Profile and prompts Governance Office sign-off.
- Use the **Printable Appraisal Form** tab for formal print/PDF review records.

---

## 7. Risk Register, Controls, Crosswalk & Incidents (`/risks`)

- Log risks linked to assets and FRAME dimensions with inherent and residual Likelihood and Impact (1 to 5).
- View the **5x5 Heat Map** and automatic **Risk Appetite** breach alerts.
- Test controls in the **Control Library** and map them to FRAME, AAEF, ISO/IEC 42001, EU AI Act, NIST AI RMF, COSO, and Singapore MAS guidelines.
- Log AI incidents and near misses with root cause, lessons learned, and follow-up actions.

---

## 8. Regulatory Readiness & Crosswalk Gap Analysis (`/compliance`)

- Inspect per-framework requirement coverage, mapped controls, effectiveness test status, and evidence counts.
- Filter for **Unmapped Gaps** or **Ineffective Controls** and export a CSV evidence pack for auditors or regulators.

---

## 9. Vendor & Third-Party AI Due Diligence (`/vendors`)

- Assess external AI providers for model cards, data residency, contractual **Zero Data Retention**, sub-processors, contract renewal dates, and exit portability plans.

---

## 10. ROI, Value-at-Risk & Pluggable Value Models (`/roi`)

- Track TCO, Net Benefit, ROI %, Payback Period, NPV, Cost per Outcome, and Risk-Adjusted Return in **SGD** (default) or **USD**.
- Clearly distinguish **Measured**, **Estimated**, and **Assumed** benefits across all tables and charts.
- Review extension tabs for the **Agentic P&L Framework** and **Capability Capitalisation Model**.

---

## 11. Administration & API Integrations (`/admin` & `/integrations`)

- **Admin Config (`/admin`)**: Form-based editing for Parameters & Appetite, Business Units CRUD, FRAME Criteria & Rubrics, AAEF Profile Rules, and Users & Roles.
- **API & Integrations (`/integrations`)**:
  - Generate/revoke Bearer tokens (`agx_live_...`) for:
    - `POST /api/telemetry/ingest`: `BOUNDARY_BREACH`, `ROI_METRIC`, and `GUARDRAIL_EVENT` blocks (prompt injection, PII leaks, toxicity).
    - `POST /api/telemetry/pydantic`: Native **PydanticAI** run payloads and **Pydantic Logfire OTLP** (`resourceSpans`) telemetry.
    - `POST /api/telemetry/mcp-a2a`: Runtime MCP tool invocations and A2A peer delegations.
  - Configure **In-App Bell**, **Slack/Teams Webhooks**, or **Telegram Bot** (Bot Token + Chat ID) for automated alerts, run on-demand Governance Digests, and verify Enterprise SSO (OIDC) status.
- **In-App Manual (`/manual`)**: Searchable and printable user manual built directly into the Aegis sidebar.

---

## 12. Shadow AI Discovery & Visibility (`/shadow-ai`)

- **Network & Identity Feeds (`POST /api/discovery/ingest`)**: Stream aggregated SASE/SWG, DNS resolver, IdP/OAuth, Cloud, or Expense events to detect unregistered AI usage.
- **Catalogue Matching & Alerts**: Automatically identifies 35+ AI providers, tracks request counts and uploaded bytes, and fires `SHADOW_AI_DETECTED` alerts.
- **Triage**: Review candidates in `/shadow-ai` and **Promote** them directly into the AI Asset Register (`IDEA` stage), **Block**, or **Dismiss** them.

---

## 13. Assurance, Kill-Switch, AI-BOM & MCP/A2A (`/assurance`)

- **Runtime Kill-Switch (`GET / PATCH /api/assets/[id]/gate`)**: Production orchestrators poll the gate status (`ALLOW`, `RESTRICTED`, `SUSPENDED`) before executing autonomous actions. `CRITICAL` telemetry breaches auto-suspend the gate.
- **AI Bill of Materials (AI-BOM)**: Register approved foundation models, system prompts, MCP servers, tools/APIs, and guardrails per asset.
- **MCP & A2A Trust Graph**: Define allowed MCP server tools/HITL rules and A2A peer trust links (permitted skills and max hop depth). Unapproved calls streamed to `POST /api/telemetry/mcp-a2a` automatically log Boundary Breaches and fire `UNAPPROVED_MCP_OR_A2A` alerts.
- **RAG Data Lineage & Red-Team Evals**: Map data repositories with PII/sensitivity tags and record Red-Team, Prompt-Injection, Hallucination, and Bias evaluation scorecards.
- **Exceptions, AUP, Statutory Timers & FinOps**: Grant time-bound policy waivers, log staff AUP/training attestations, attach PDPC 72h / EU AI Act / MAS TRM notification countdowns to incidents, and set quarterly FinOps spend caps (`BUDGET_ALERT` at 80% and 100%).
