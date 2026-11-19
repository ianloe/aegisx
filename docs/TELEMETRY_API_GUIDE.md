# Aegis Telemetry Ingestion API: Step-by-Step Setup & Integration Guide

**Endpoint**: `POST /api/telemetry/ingest`  
**Management UI**: **API & Integrations** (`/integrations`, accessible to `Administrator` and `AI Governance Office`)  
**Attribution**: FRAME and AAEF by Ian Loe, Tactics Solutions, licensed CC BY-NC 4.0.

---

## 1. Overview

The **Aegis Telemetry Ingestion API** enables production AI agents, API gateways, and observability platforms (such as Langfuse, Datadog, Azure AI, or custom Python/Node.js services) to stream two types of live operational evidence directly into Aegis:

1. **`BOUNDARY_BREACH`**: Logs a boundary violation against an AI asset, marks **Boundary Adherence** as failed on its latest AAEF appraisal, automatically re-evaluates its **Performance Profile** (`Operational`, `Developing`, `Restricted`, `Under Review`), writes an immutable audit log entry, and dispatches an `AAEF_PROFILE_DOWNGRADE` alert.
2. **`ROI_METRIC`**: Logs measured **Costs** (e.g. inference/compute spend) or measured **Benefits** (e.g. productivity hours, cost avoided), tagging all ingested benefits with confidence **`MEASURED`** so executives can distinguish verified telemetry from `Estimated` or `Assumed` projections.

---

## 2. Step-by-Step Setup in Aegis

### Step 1: Verify Target AI Assets Exist
1. Sign in to Aegis as an **Administrator** or **AI Governance Office** user (`http://localhost:3000/login`).
2. Open **AI Asset Register** (`/assets`) and note the exact **`assetCode`** of each AI system or agent you want to monitor (for example `AI-001`, `AI-004`).
3. For agent boundary-breach re-evaluation, ensure the asset has **This asset is an AI Agent** enabled and at least one AAEF appraisal recorded in **AAEF Appraisals** (`/aaef`).

### Step 2: Generate a Telemetry Bearer Token
1. In the left sidebar, open **API & Integrations** (`/integrations`).
2. Under **Telemetry & Cost Ingestion API Keys**, enter a descriptive key name (for example `Langfuse Production` or `Azure AI Gateway`).
3. Click **Generate Key**.
4. Copy the plaintext token immediately from the amber confirmation banner (format: `aegis_<48-hex-characters>`).
   - Aegis stores only a **SHA-256 hash** (`keyHash`) in PostgreSQL; the plaintext token is never shown again.
   - Store the token securely in your external service's secret manager (for example `AEGIS_TELEMETRY_TOKEN`).

### Step 3: Configure Automated Alerts (Optional)
1. On the same **API & Integrations** (`/integrations`) page, scroll to **Automated Governance Alerts & Webhooks**.
2. Locate **AAEF Profile Downgrade** (`AAEF_PROFILE_DOWNGRADE`).
3. Ensure it is **Enabled**, choose **In-App Bell** or **Webhook (Slack / Teams)**, paste your Slack or Microsoft Teams incoming webhook URL if using `WEBHOOK`, and click **Save**.

### Step 4: Verify Connectivity Using the Built-In Simulator
1. On `/integrations`, under **Simulate Measured Cost Telemetry Event**, select an `assetCode`, enter an SGD amount (e.g. `1250`), and click **Send Test Event**.
2. Open **ROI & Value** (`/roi`) or **Audit Log** (`/audit`) to confirm the `[Telemetry] Monthly inference compute spend` record and `TELEMETRY_ROI_COST` audit entry appeared.

---

## 3. API Authentication & Endpoint Specification

- **URL**: `POST http://<your-aegis-host>:3000/api/telemetry/ingest`
- **Headers**:
  - `Authorization: Bearer aegis_<your_token>`
  - `Content-Type: application/json`

### HTTP Status Codes

| Status | Meaning |
| :--- | :--- |
| `201 Created` | Event validated, persisted, and audited (`{ "status": "ingested", ... }`). |
| `400 Bad Request` | Payload failed schema validation (`details` lists invalid fields). |
| `401 Unauthorized` | Missing, invalid, or revoked Bearer token. |
| `404 Not Found` | `assetCode` does not match any registered AI Asset in Aegis. |

---

## 4. Event Type 1: `BOUNDARY_BREACH`

### Payload Schema

| Field | Type | Required | Allowed Values / Notes |
| :--- | :--- | :--- | :--- |
| `eventType` | `string` | Yes | Must be `"BOUNDARY_BREACH"` |
| `assetCode` | `string` | Yes | Exact asset code from `/assets` (e.g. `"AI-004"`) |
| `severity` | `string` | Yes | `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"` |
| `description` | `string` | Yes | Minimum 4 characters describing the rule/guardrail violated |
| `remediation` | `string` | No | Defaults to `"Automated telemetry alert: awaiting investigation."` |
| `occurredAt` | `string` | No | ISO-8601 timestamp (defaults to current server time) |

### Example `curl` Request

```bash
curl -X POST http://localhost:3000/api/telemetry/ingest \
  -H "Authorization: Bearer aegis_YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "BOUNDARY_BREACH",
    "assetCode": "AI-004",
    "severity": "HIGH",
    "description": "Agent attempted external wire transfer without human confirmation",
    "remediation": "Blocked by policy gateway; escalated to Asset Owner"
  }'
```

### Example Python Client

```python
import os
import requests

AEGIS_URL = os.environ["AEGIS_URL"]  # e.g. "http://localhost:3000"
AEGIS_TOKEN = os.environ["AEGIS_TELEMETRY_TOKEN"]

resp = requests.post(
    f"{AEGIS_URL}/api/telemetry/ingest",
    headers={
        "Authorization": f"Bearer {AEGIS_TOKEN}",
        "Content-Type": "application/json",
    },
    json={
        "eventType": "BOUNDARY_BREACH",
        "assetCode": "AI-004",
        "severity": "HIGH",
        "description": "Agent attempted action outside sanctioned authority matrix",
    },
    timeout=10,
)
resp.raise_for_status()
print(resp.json())
```

---

## 5. Event Type 2: `ROI_METRIC`

### Payload Schema

| Field | Type | Required | Allowed Values / Notes |
| :--- | :--- | :--- | :--- |
| `eventType` | `string` | Yes | Must be `"ROI_METRIC"` |
| `assetCode` | `string` | Yes | Exact asset code from `/assets` |
| `metricType` | `string` | Yes | `"COST"` or `"BENEFIT"` |
| `category` | `string` | Yes | For `COST`: `"BUILD"`, `"LICENCE"`, `"INFERENCE_COMPUTE"`, `"PEOPLE"`, `"CHANGE_MANAGEMENT"`, `"GOVERNANCE"`. For `BENEFIT`: `"COST_AVOIDED"`, `"REVENUE_UPLIFT"`, `"PRODUCTIVITY_HOURS"`, `"RISK_REDUCTION"`, `"QUALITY_IMPROVEMENT"` |
| `description` | `string` | Yes | Minimum 2 characters (prefixed with `[Telemetry]` in Aegis) |
| `amount` | `number` | Yes | Non-negative number (`>= 0`) |
| `currency` | `string` | No | `"SGD"` (default) or `"USD"` |
| `quarter` | `string` | Yes | Quarter string, e.g. `"2026-Q4"` |

### Example `curl` Request (Measured Inference Cost)

```bash
curl -X POST http://localhost:3000/api/telemetry/ingest \
  -H "Authorization: Bearer aegis_YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "ROI_METRIC",
    "assetCode": "AI-001",
    "metricType": "COST",
    "category": "INFERENCE_COMPUTE",
    "description": "November LLM token and GPU inference spend",
    "amount": 1840.50,
    "currency": "SGD",
    "quarter": "2026-Q4"
  }'
```

### Example Node.js / TypeScript Client (Measured Benefit)

```ts
const res = await fetch(`${process.env.AEGIS_URL}/api/telemetry/ingest`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.AEGIS_TELEMETRY_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    eventType: "ROI_METRIC",
    assetCode: "AI-001",
    metricType: "BENEFIT",
    category: "PRODUCTIVITY_HOURS",
    description: "Verified claims triage hours released in Q4",
    amount: 14500,
    currency: "SGD",
    quarter: "2026-Q4",
  }),
});

if (!res.ok) {
  throw new Error(`Aegis telemetry error (${res.status}): ${await res.text()}`);
}
console.log(await res.json());
```

---

## 6. Token Rotation & Revocation

1. To rotate a key without downtime, generate a new key in **API & Integrations** (`/integrations`), update the secret in your external pipeline, and verify `Last used` updates on the new key.
2. Click **Revoke** on the old key. Revocation takes effect immediately (`isActive = false`) and is recorded in the immutable **Audit Log** (`/audit`) as `REVOKE_TELEMETRY_KEY`.
