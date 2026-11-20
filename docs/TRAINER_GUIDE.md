# Aegis AI Governance Platform: Trainer & Facilitator Guide

This guide equips trainers and AI Governance leads to deliver structured, hands-on Aegis onboarding sessions for **Executives**, **Governance Officers / Assessors**, **Asset Owners / Engineers**, and **Administrators / SecOps**.

---

## 1. Pre-Session Setup Checklist (30 Minutes Before Class)

1. **Start the Training Environment**:
   - Ensure Docker Compose is running with demo data enabled (`SEED_DEMO_DATA=true` in `.env` for first boot):
     ```bash
     docker compose up -d
     curl -s http://localhost:3000/api/health
     ```
   - Verify `/api/health` returns `{"status":"ok","database":"connected"}`.
2. **Verify Demo Accounts** (seeded in `prisma/seed.ts`):
   - Confirm you can sign in as the **Administrator** (`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`) and check **Admin Config (`/admin`) -> Users & Roles** to confirm participant accounts or role-based demo accounts (`GOVERNANCE_OFFICE`, `ASSET_OWNER`, `ASSESSOR`, `EXECUTIVE`, `AUDITOR`) are active.
3. **Optional Live Integrations for Demo**:
   - **BYO-AI Insights**: Pre-configure an OpenRouter, Gemini, Claude, or OpenAI key in `/admin` -> **AI Insights (BYO LLM)** and click **Test Connection** so Lab 1 and Lab 6 work live.
   - **Alerting**: Set up a test Slack/Teams webhook or Telegram test group (`Bot Token` + `Chat ID`) on `SHADOW_AI_DETECTED` and `UNAPPROVED_MCP_OR_A2A` to show real-time alerts arriving during the session.
4. **Share Participant Materials**:
   - Distribute [TRAINING_PARTICIPANT_WORKBOOK.md](TRAINING_PARTICIPANT_WORKBOOK.md) and point participants to the in-app **User Manual (`/manual`)**.

---

## 2. Recommended Session Formats

### Option A: Half-Day Executive & Governance Workshop (3 Hours)
| Time | Module | Target Audience | Labs |
| :--- | :--- | :--- | :--- |
| 00:00 - 00:25 | Welcome, FRAME & AAEF Overview | All | Slides / `/about` |
| 00:25 - 00:55 | Portfolio Oversight, ROI & Board Packs | Executives, Governance | Lab 1 (`/`, `/roi`) |
| 00:55 - 01:35 | Asset Register, FRAME Maturity & AAEF Appraisals | Governance, Assessors, Owners | Lab 2 (`/assets`, `/frame`, `/aaef`) |
| 01:35 - 01:50 | *Break* | — | — |
| 01:50 - 02:20 | Risk Register, Regulatory Crosswalks & Shadow AI | Governance, Security | Lab 3 & Lab 4 (`/risks`, `/compliance`, `/shadow-ai`) |
| 02:20 - 02:50 | Runtime Kill-Switch, AI-BOM, MCP/A2A & BYO-AI Insights | Engineering, Admins, Governance | Lab 5 & Lab 6 (`/assurance`, `/admin`) |
| 02:50 - 03:00 | Knowledge Check Quiz & Q&A | All | Workbook Section 4 |

### Option B: 60-Minute Engineering & SecOps Deep Dive
Focus on **Lab 4** (SASE/DNS/IdP ingestion to `/api/discovery/ingest`), **Lab 5** (`GET /api/assets/[id]/gate` kill-switch, `POST /api/telemetry/pydantic` OTLP, `POST /api/telemetry/mcp-a2a` tool/hop enforcement, `GUARDRAIL_EVENT`), and **Lab 6** (`agx_live_...` key rotation and Telegram/Webhook alerts).

---

## 3. Module-by-Module Facilitator Notes & Talking Points

### Module 1: Executive Command Centre (`/`)
- **Key Message**: Governance should not live in quarterly slide decks. Aegis gives leadership real-time visibility across maturity, agent behaviour, risk appetite, Shadow AI, and actual financial return.
- **Live Demo Cue**: Filter by one Business Unit, generate an **AI Executive & Board Briefing**, and click **Export Board Pack (A4 PDF)** to show how filters carry straight into the PDF.

### Module 2: FRAME & AAEF (`/frame`, `/aaef`)
- **Key Message**: FRAME defines the *enterprise envelope*; AAEF evaluates *individual agents* inside that envelope.
- **Facilitator Emphasis**: Explain why **Boundary Adherence** is binary. Even a highly capable agent (`Task Competence = 4`) must be downgraded to `Restricted` or `Under Review` when it crosses sanctioned authority.
- **Common Question**: *"Can we customise the 0 to 4 rubrics or AAEF thresholds?"*
  - **Answer**: Yes, live in **Admin Config (`/admin`)** under **FRAME Criteria & Rubrics** and **AAEF Profile Rules** without any code changes.

### Module 3: Shadow AI Discovery (`/shadow-ai`)
- **Key Message**: You cannot govern AI assets you do not know about. SASE/SWG, DNS resolver logs, and IdP OAuth grants feed `POST /api/discovery/ingest` to surface Shadow AI automatically.
- **Live Demo Cue**: Run the simulator in `/shadow-ai` (`chatgpt.com`, `SASE`, `Marketing`), show the alert arriving, and demonstrate clicking **Promote** to turn it into a tracked `AIAsset`.

### Module 4: Assurance, Kill-Switch & MCP / A2A (`/assurance`)
- **Key Message**: Modern agents call external tools via **MCP** and delegate to peer agents via **A2A**. Governance must validate both at runtime.
- **Live Demo Cue**:
  1. Show `GET /api/assets/AI-001/gate` returning `ALLOW`.
  2. In **MCP & A2A Graph**, register `postgres-mcp` allowing only `read_query`.
  3. Trigger an unapproved `drop_table` call via `POST /api/telemetry/mcp-a2a` and show the resulting `BoundaryBreach`, gate restriction (`RESTRICTED`), and alert.
  4. Point out **PDPC 72-hour / EU AI Act** timers and **FinOps Budget Caps** (`80%` / `100%` alerts).

### Module 5: BYO-AI Insights & Alerting (`/admin`, `/integrations`)
- **Key Message**: Aegis never locks you into one AI vendor. Admins bring their own OpenRouter, Gemini, Claude, OpenAI, or local Ollama/vLLM endpoint.
- **Security Talking Point**: Emphasise that API keys are stored server-side, masked in the UI, and never sent to the browser, and prompts contain only aggregated metrics rather than personal data.

---

## 4. Troubleshooting During Training

| Symptom | Likely Cause | Fix |
| :--- | :--- | :--- |
| **401 on telemetry `curl` test** | Missing or revoked `agx_live_...` Bearer token | Generate a new token in `/integrations` and copy the full `agx_live_...` string immediately. |
| **404 on telemetry ingest** | `assetCode` does not match an existing asset | Check exact `assetCode` in `/assets` (for example `AI-001`, not `AST-001`). |
| **AI Insights returns 400 ("disabled")** | BYO-AI provider not enabled or key missing | Open `/admin -> AI Insights (BYO LLM)`, enter key, run **Test Connection**, tick **Enable**, and **Save**. |
| **Participants cannot see `/admin` or `/integrations`** | Signed in with non-Admin role (e.g. `ASSESSOR` or `EXECUTIVE`) | Expected RBAC behaviour; use `/admin` only for Administrator / Governance Office tracks. |
| **Demo data looks heavily modified after class** | Participants ran live edits during labs | Run `./scripts/restore.sh <pre-class-backup.dump>` or reset the test volume after the session. |

---

## 5. Post-Training Rollout Checklist
1. Export or back up the clean production database (`./scripts/backup.sh`).
2. Issue scoped `agx_live_...` telemetry keys per environment (Staging vs Production).
3. Configure at least one alert channel (Slack, Teams, or Telegram) for `AAEF_PROFILE_DOWNGRADE`, `SHADOW_AI_DETECTED`, and `UNAPPROVED_MCP_OR_A2A`.
4. Have each Business Unit complete their **Acceptable AI Use Policy (AUP) Attestation** in `/assurance`.
