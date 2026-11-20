# Aegis AI Governance Platform: Participant Training Workbook

**Welcome to Aegis.** This hands-on workbook teaches you how to govern AI systems and autonomous agents across their full lifecycle using **FRAME** and **AAEF (AI Agent Evaluation Framework)**.

---

## 1. Learning Tracks by Role

| Role | Primary Pages Used | Key Responsibilities |
| :--- | :--- | :--- |
| **Executive / Board** | `/`, `/roi`, `/compliance` | Review portfolio posture, Measured vs Assumed ROI, AI Executive Briefings, and export A4 PDF Board Packs. |
| **Governance Office / Assessor** | `/queue`, `/frame`, `/aaef`, `/risks`, `/shadow-ai`, `/assurance`, `/vendors` | Conduct FRAME & AAEF assessments, approve stage-gates, triage Shadow AI, grant time-bound waivers, and enforce runtime gates. |
| **Asset Owner / Engineering** | `/assets`, `/assurance`, `/integrations`, `/evidence` | Register AI systems, maintain AI-BOM & MCP/A2A policies, stream PydanticAI/OTLP/gateway telemetry, and close remediation actions. |
| **Administrator / SecOps** | `/admin`, `/integrations`, `/shadow-ai`, `/audit` | Configure rubrics, risk appetite, Business Units, Users, `agx_live_...` API keys, Slack/Teams/Telegram alerts, and BYO-AI LLM providers. |
| **Auditor** | `/audit`, `/evidence`, `/compliance` | Inspect tamper-evident before/after audit trails and regulatory evidence readiness (read-only). |

---

## 2. Core Concepts Quick Refresher

- **FRAME (Governance Envelope)**: Five enterprise dimensions scored 0 to 4: **Focus**, **Roles**, **Authority**, **Metrics**, and **Evaluation**.
- **AAEF (Agent Appraisal)**: Evaluates autonomous agents on **Task Competence**, **Judgement Quality**, **Boundary Adherence** (binary pass/fail), **Collaboration Effectiveness**, and **Improvement Trajectory**, assigning **Operational**, **Developing**, **Restricted**, or **Under Review**.
- **Runtime Kill-Switch (`ALLOW` / `RESTRICTED` / `SUSPENDED`)**: Live circuit-breaker polled by production agents via `GET /api/assets/[id]/gate`. Critical breaches automatically suspend the gate.

---

## 3. Hands-On Labs

### Lab 1: Executive Command Centre & Board Pack Export (`/`)
**Objective:** Filter the AI portfolio, generate an AI briefing, and export a Board Pack.
1. Open `http://localhost:3000` and sign in with your training credentials.
2. Use the **Global Portfolio Filter Bar** to filter by a single **Business Unit** and **Lifecycle Stage = Production**.
3. Observe how the KPI tiles (**AI Assets**, **Avg FRAME Maturity**, **AAEF Risk**, **Risk Posture**, **Measured ROI**, **Overdue Actions**, and **Shadow AI**) update dynamically.
4. *(If BYO-AI is enabled by your trainer)* Click **Generate AI Insights** on the **AI Executive & Board Briefing** card to review a live synthesis of portfolio risks and priorities.
5. Click **Export Board Pack (A4 PDF)** to download a board-ready PDF report matching your active filters.

---

### Lab 2: Asset Onboarding, FRAME & AAEF Appraisal (`/assets`, `/frame`, `/aaef`)
**Objective:** Inspect an AI asset and understand how boundary breaches affect AAEF profiles.
1. Navigate to **AI Asset Register (`/assets`)** and open an existing agent (for example `AI-001`).
2. Review its **Lifecycle Stage**, **Autonomy Level**, **Owner**, and **Overseer**.
3. Open **FRAME Governance (`/frame`)** and inspect the 5-dimension maturity breakdown (note whether metrics are *Activity-Only* vs *Outcome-Linked*).
4. Open **AAEF Appraisals (`/aaef`)** and inspect an agent's appraisal scorecard:
   - Check how a single **Boundary Adherence** failure downgrades an otherwise high-scoring agent to **Restricted** or **Under Review**.

---

### Lab 3: Risk Posture, Regulatory Readiness & ROI (`/risks`, `/compliance`, `/roi`)
**Objective:** Evaluate residual risk against risk appetite and separate Measured vs Assumed ROI.
1. Open **Risk & Controls (`/risks`)** and inspect the **5x5 Residual Risk Heatmap**. Risks exceeding the configured **Risk Appetite** threshold are highlighted automatically.
2. Open **Regulatory Readiness (`/compliance`)** to view control coverage across **IMDA Model AI Governance Framework**, **ISO/IEC 42001**, **NIST AI RMF**, and **EU AI Act**.
3. Open **ROI & Value (`/roi`)** and compare **Measured** benefits (from actual telemetry or verified outcomes) against **Estimated** and **Assumed** benefits, plus **Risk-Adjusted ROI**.

---

### Lab 4: Shadow AI Discovery & Triage (`/shadow-ai`)
**Objective:** Capture an unregistered AI service from simulated SASE/DNS traffic and triage it.
1. Open **Shadow AI (`/shadow-ai`)** from the left sidebar.
2. Under **Simulate Network Discovery Event** *(Admin)*, enter:
   - Domain: `chatgpt.com`
   - Source: `SASE / SWG`
   - Business Unit: `Marketing`
3. Click **Send Test Discovery Event**.
4. Observe the new row in **Detected Shadow AI Services** showing provider matching (`ChatGPT`), request count, uploaded MB, and `DETECTED` status.
5. Practice triaging:
   - Click **Promote** to onboard the service into the AI Asset Register (`IDEA` stage) and mark it `SANCTIONED`, **or**
   - Click **Block** to mark it prohibited (any future SASE/DNS hits to a blocked domain automatically raise a `CRITICAL` alert).

---

### Lab 5: Assurance, Kill-Switch, AI-BOM & MCP / A2A Graph (`/assurance`, `/integrations`)
**Objective:** Register an MCP server policy, test the runtime kill-switch, and trace tool calls.
1. Open **Assurance & AI-BOM (`/assurance`)** and select asset `AI-001`.
2. In **Kill-Switch & AI-BOM**:
   - Register a new AI-BOM component (for example `MODEL`, `gpt-4o`, version `2024-08-06`, provider `OpenAI`).
   - Toggle the runtime gate to **Restrict** or **Suspend**, then restore it to **Allow** and notice the audit trail.
3. Switch to the **MCP & A2A Graph** tab:
   - Add an MCP policy: Server Name `postgres-mcp`, Allowed Tools `read_query, list_tables`, Risk Tier `Read Only`.
   - Add an A2A peer link to another internal asset with Allowed Skills `verify_kyc` and Max Hops `2`.
4. *(Technical track)* In **API & Integrations (`/integrations`)**, generate a test Bearer token (`agx_live_...`) and send a sample `POST /api/telemetry/mcp-a2a` call:
   - Sending `operation: "read_query"` returns `status: "OK"`.
   - Sending an unapproved tool such as `operation: "drop_table"` returns `status: "UNAPPROVED"`, creates a `HIGH` Boundary Breach, restricts the runtime gate, and triggers an `UNAPPROVED_MCP_OR_A2A` alert.
5. Explore the **FinOps Budget Caps** tab and set a quarterly SGD cap to see live spend utilisation.

---

### Lab 6: Configuring BYO-AI Insights & Alert Channels (`/admin`, `/integrations`)
**Objective:** Connect an LLM provider for AI Insights and verify Telegram / Slack / Teams alert routing.
1. Open **Admin Config (`/admin`) -> Alerts & Integrations**:
   - Inspect the alert rules (`AAEF_PROFILE_DOWNGRADE`, `SHADOW_AI_DETECTED`, `UNAPPROVED_MCP_OR_A2A`, `BUDGET_ALERT`, `GUARDRAIL_VIOLATION`).
   - Notice each rule can route to **In-App Bell**, **Webhook (Slack / Teams)**, or **Telegram Bot** (`Bot Token` + `Chat ID`).
2. Open **Admin Config (`/admin`) -> AI Insights (BYO LLM)**:
   - Choose a provider (**OpenRouter**, **Google Gemini**, **Anthropic Claude**, **OpenAI**, or **Custom OpenAI-Compatible**), enter the Model ID and API key, and click **Test Connection**.
   - Tick **Enable AI Insights across Aegis** and click **Save AI Provider**.

---

## 4. Knowledge Check Quiz

1. Which AAEF dimension is binary (pass/fail) and immediately downgrades an agent if breached?
2. What happens when an AI agent calls an MCP tool that is not listed in its approved `allowedTools` scope?
3. Where does an administrator configure a Telegram Bot Token and Chat ID for governance alerts?
4. What is the difference between **Measured**, **Estimated**, and **Assumed** benefits on `/roi`?
5. When a `BLOCKED` Shadow AI domain receives new SASE or DNS traffic, what severity alert is raised?

### Quiz Answer Key
1. **Boundary Adherence** (downgrades the agent to `Restricted` or `Under Review`).
2. Aegis logs an `UNAPPROVED` `ProtocolCallEvent`, creates a `HIGH` `BoundaryBreach`, restricts the asset's runtime gate (`ALLOW` -> `RESTRICTED`), writes an audit log entry, and fires an `UNAPPROVED_MCP_OR_A2A` alert.
3. In **API & Integrations (`/integrations`)** or **Admin Config (`/admin`) -> Alerts & Integrations**, by selecting **Telegram Bot** on the relevant alert rule.
4. **Measured** benefits come from verified actuals or live telemetry; **Estimated** and **Assumed** benefits are planning/projection figures separated so Boards can see real vs projected ROI.
5. **CRITICAL** (`SHADOW_AI_DETECTED` alert).
