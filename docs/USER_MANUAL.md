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

- **Admin Config (`/admin`)**: Form-based editing for Parameters & Appetite, Business Units CRUD, FRAME Criteria & Rubrics, AAEF Profile Rules, Users & Roles, and **AI Insights (BYO LLM)** (OpenRouter, Gemini, Claude, OpenAI, or Custom OpenAI-compatible endpoints with live connection testing for `/`, `/shadow-ai`, and `/assurance` briefings).
- **API & Integrations (`/integrations`)**:
  - Generate/revoke Bearer tokens (`agx_live_...`) for:
    - `POST /api/telemetry/ingest`: `BOUNDARY_BREACH`, `ROI_METRIC`, and `GUARDRAIL_EVENT` blocks (prompt injection, PII leaks, toxicity).
    - `POST /api/telemetry/pydantic`: Native **PydanticAI** run payloads and **Pydantic Logfire OTLP** (`resourceSpans`) telemetry.
    - `POST /api/telemetry/mcp-a2a`: Runtime MCP tool invocations and A2A peer delegations.
  - Configure **In-App Bell**, **Slack/Teams Webhooks**, or **Telegram Bot** (Bot Token + Chat ID) for automated alerts, run on-demand Governance Digests, and verify Enterprise SSO (OIDC) status.
- **In-App Manual (`/manual`)**: Searchable and printable user manual built directly into the Aegis sidebar.

---

## 12. Shadow AI Discovery & Visibility (`/shadow-ai`)

Aegis captures unregistered AI usage by ingesting aggregated network and identity feeds and turning detections into a governed triage workflow:

1. **Feed Sources (`POST /api/discovery/ingest`)**: Forward aggregated events from **SASE/SWG** (Zscaler, Netskope, Cloudflare Gateway), **DNS Resolver logs** (Cisco Umbrella, Infoblox, Route53), **IdP/OAuth grants** (Okta, Entra ID), **Cloud**, or **Expense** feeds using a `Bearer agx_live_...` key.
2. **Payload & Catalogue Matching**: Submit `{ domain, source, businessUnit, requestCount, bytesUploaded, uniqueUsers }` (or `{ events: [...] }`). Aegis normalises hostnames and matches them against 35+ known AI providers. Use `onlyKnownAi: true` when forwarding unfiltered DNS/SASE traffic.
3. **Deduplication & Alerts**: Records deduplicate by `(domain, businessUnit, source)`, accumulating `requestCount` and `bytesUploaded`. New discoveries (and any traffic hitting a `BLOCKED` domain) trigger `SHADOW_AI_DETECTED` alerts to In-App, Slack/Teams, or Telegram.
4. **Triage (`/shadow-ai` & `/` KPI Tile)**: Filter by source or status, then **Promote** (creates a new `AIAsset` in `IDEA` stage and marks `SANCTIONED`), **Block**, or **Dismiss**.

---

## 13. Assurance, Runtime Kill-Switch, AI-BOM & MCP / A2A Telemetry (`/assurance`)

- **Runtime Kill-Switch (`GET / PATCH /api/assets/[id]/gate`)**: Production orchestrators poll the gate status (`ALLOW`, `RESTRICTED`, `SUSPENDED`) before executing autonomous actions. `CRITICAL` telemetry breaches automatically suspend the gate; `HIGH` breaches restrict it.
- **AI Bill of Materials (AI-BOM) & RAG Data Lineage**: Register approved foundation models, system prompts, MCP servers, tools/APIs, and guardrails per asset, alongside linked Vector DBs, Data Warehouses, and PII classifications.
- **How MCP Telemetry Works (`POST /api/telemetry/mcp-a2a`)**:
  - Register `McpServerPolicy` entries per asset (`serverName`, `allowedTools`, `riskTier: READ_ONLY | WRITE | DESTRUCTIVE`, `requiresHitl`).
  - Stream runtime tool invocations (`{ protocol: "MCP", assetCode, targetName, operation, traceId }`).
  - Unregistered/revoked servers or out-of-scope tools log `UNAPPROVED` traces, create a `HIGH` `BoundaryBreach`, restrict the runtime gate, and fire `UNAPPROVED_MCP_OR_A2A` alerts.
- **How A2A Telemetry Works (`POST /api/telemetry/mcp-a2a`)**:
  - Register `A2aPeerLink` edges from a source asset to an internal asset or external Agent Card URL (`/.well-known/agent.json`), defining `allowedSkills` and `maxHopDepth`.
  - Stream agent-to-agent delegations (`{ protocol: "A2A", assetCode, targetName, operation, hopDepth, traceId }`).
  - Unapproved peers, disallowed skills, or delegations exceeding `maxHopDepth` trigger `BoundaryBreach` records, gate restrictions, and `UNAPPROVED_MCP_OR_A2A` alerts.
- **Evals, Exceptions, AUP, Statutory Timers & FinOps**: Record Red-Team/Prompt-Injection/Hallucination scorecards, grant time-bound policy waivers, log staff AUP/training attestations, attach PDPC 72h / EU AI Act / MAS TRM notification countdowns to incidents, and set quarterly FinOps spend caps (`BUDGET_ALERT` at 80% and 100%).

---

## 14. AI Insights (Bring Your Own LLM) (`/admin` -> `AI Insights`)

1. **Configuration (`/admin`)**: Open **AI Insights (BYO LLM)** and choose **OpenRouter**, **Google Gemini**, **Anthropic Claude**, **OpenAI**, or **Custom OpenAI-Compatible** (Ollama, vLLM, LiteLLM, Azure OpenAI). Enter your Model ID and API Key, click **Test Connection**, enable AI Insights, and save.
2. **Security**: API keys are stored server-side in `GovernanceConfig`, masked in the UI (`sk-o...cdef`), and never exposed to the browser. Only aggregated governance metrics (never raw PII) are sent in prompts.
3. **Where Insights Appear**:
   - **Executive Dashboard (`/`)**: **AI Executive & Board Briefing**
   - **Shadow AI (`/shadow-ai`)**: **AI Shadow Triage & Exfiltration Brief**
   - **Assurance (`/assurance`)**: **AI Assurance & Runtime Control Brief**
4. **Auditability**: Every call is logged in `/audit` under `AI_INSIGHT_GENERATED` with scope, provider, and model.
