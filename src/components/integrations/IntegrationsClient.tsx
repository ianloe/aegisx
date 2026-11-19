"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

interface AlertRuleRow {
  id: string;
  eventType: string;
  label: string;
  description: string;
  isEnabled: boolean;
  channel: "IN_APP" | "WEBHOOK";
  webhookUrl: string | null;
}

interface TelemetryKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface SimpleAssetRow {
  id: string;
  assetCode: string;
  name: string;
}

interface SsoStatusInfo {
  enabled: boolean;
  providerName: string;
  issuerUrl: string;
  clientId: string;
  hasClientSecret: boolean;
}

export function IntegrationsClient({
  initialAlertRules,
  initialTelemetryKeys,
  assets,
  ssoConfig,
  canEdit,
}: {
  initialAlertRules: AlertRuleRow[];
  initialTelemetryKeys: TelemetryKeyRow[];
  assets: SimpleAssetRow[];
  ssoConfig: SsoStatusInfo;
  canEdit: boolean;
}) {
  const [alertRules, setAlertRules] = useState<AlertRuleRow[]>(initialAlertRules);
  const [telemetryKeys, setTelemetryKeys] = useState<TelemetryKeyRow[]>(initialTelemetryKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdPlaintextKey, setCreatedPlaintextKey] = useState<string | null>(null);
  const [simAssetCode, setSimAssetCode] = useState(assets[0]?.assetCode || "");
  const [simAmount, setSimAmount] = useState("1250");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sampleToken = createdPlaintextKey || "<YOUR_AEGIS_BEARER_TOKEN>";
  const sampleAsset = simAssetCode || "AI-001";

  const breachCurl = `curl -X POST http://localhost:3000/api/telemetry/ingest \\
  -H "Authorization: Bearer ${sampleToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "eventType": "BOUNDARY_BREACH",
    "assetCode": "${sampleAsset}",
    "severity": "HIGH",
    "description": "Agent attempted action outside sanctioned authority"
  }'`;

  const roiCurl = `curl -X POST http://localhost:3000/api/telemetry/ingest \\
  -H "Authorization: Bearer ${sampleToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "eventType": "ROI_METRIC",
    "assetCode": "${sampleAsset}",
    "metricType": "COST",
    "category": "INFERENCE_COMPUTE",
    "description": "Monthly LLM inference spend",
    "amount": 1250,
    "currency": "SGD",
    "quarter": "2026-Q4"
  }'`;

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Telemetry &amp; Cost Ingestion API Keys</CardTitle>
            <CardDescription>
              Generate Bearer tokens so production AI agents and observability pipelines can push live boundary breaches
              and measured ROI telemetry to <code>POST /api/telemetry/ingest</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEdit && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setStatusMsg(null);
                  setErrorMsg(null);
                  setCreatedPlaintextKey(null);
                  const res = await fetch("/api/telemetry/keys", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newKeyName }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setTelemetryKeys((prev) => [data.key, ...prev]);
                    setCreatedPlaintextKey(data.plaintextToken);
                    setNewKeyName("");
                    setStatusMsg(`Created telemetry API key "${data.key.name}".`);
                  } else {
                    setErrorMsg(data.error || "Failed to create API key.");
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  required
                  placeholder="Key name (e.g. Langfuse Production)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
                <Button type="submit">Generate Key</Button>
              </form>
            )}

            {createdPlaintextKey && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                <div className="font-semibold">Copy this token now (it will not be shown again):</div>
                <code className="block mt-1 font-mono break-all select-all">{createdPlaintextKey}</code>
              </div>
            )}

            <div className="space-y-2 text-xs">
              {telemetryKeys.length === 0 ? (
                <p className="text-muted-foreground">No telemetry API keys created yet.</p>
              ) : (
                telemetryKeys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between rounded border border-border p-2.5">
                    <div>
                      <div className="font-medium">{k.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {k.keyPrefix}... ·{" "}
                        {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={k.isActive ? "success" : "secondary"}>
                        {k.isActive ? "Active" : "Revoked"}
                      </Badge>
                      {canEdit && k.isActive && (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            const res = await fetch(`/api/telemetry/keys?id=${encodeURIComponent(k.id)}`, {
                              method: "DELETE",
                            });
                            if (res.ok) {
                              setTelemetryKeys((prev) =>
                                prev.map((row) => (row.id === k.id ? { ...row, isActive: false } : row)),
                              );
                              setStatusMsg(`Revoked API key "${k.name}".`);
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {canEdit && assets.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                <div className="text-xs font-semibold">Simulate Measured Cost Telemetry Event</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Select value={simAssetCode} onChange={(e) => setSimAssetCode(e.target.value)} className="h-8 text-xs">
                    {assets.map((a) => (
                      <option key={a.id} value={a.assetCode}>
                        {a.assetCode}: {a.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="SGD amount"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setStatusMsg(null);
                      setErrorMsg(null);
                      const res = await fetch("/api/telemetry/ingest", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          eventType: "ROI_METRIC",
                          assetCode: simAssetCode,
                          metricType: "COST",
                          category: "INFERENCE_COMPUTE",
                          description: "Monthly inference compute spend",
                          amount: Number(simAmount),
                          currency: "SGD",
                          quarter: "2026-Q4",
                        }),
                      });
                      if (res.ok) {
                        setStatusMsg(`Ingested measured inference cost (${simAmount} SGD) for ${simAssetCode}.`);
                      } else {
                        setErrorMsg("Failed to ingest telemetry event.");
                      }
                    }}
                  >
                    Send Test Event
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telemetry API Examples &amp; Enterprise SSO</CardTitle>
            <CardDescription>
              Ready-to-use HTTP payloads for external integration and current OIDC SSO status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <div className="font-semibold mb-1">1. Push Boundary Breach (re-evaluates AAEF Profile)</div>
              <pre className="rounded-md bg-surface-muted p-2.5 font-mono text-[11px] overflow-x-auto select-all">
                {breachCurl}
              </pre>
            </div>
            <div>
              <div className="font-semibold mb-1">2. Push Measured ROI Cost / Benefit</div>
              <pre className="rounded-md bg-surface-muted p-2.5 font-mono text-[11px] overflow-x-auto select-all">
                {roiCurl}
              </pre>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Enterprise SSO (OIDC / SAML)</span>
                <Badge variant={ssoConfig.enabled ? "success" : "secondary"}>
                  {ssoConfig.enabled ? `Enabled (${ssoConfig.providerName})` : "Local Auth Only"}
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground space-y-1">
                <div>
                  <code>SSO_ENABLED</code>: {ssoConfig.enabled ? "true" : "false"} ·{" "}
                  <code>SSO_ISSUER_URL</code>: {ssoConfig.issuerUrl || "Not set"}
                </div>
                <div>
                  <code>SSO_CLIENT_ID</code>: {ssoConfig.clientId || "Not set"} ·{" "}
                  <code>SSO_CLIENT_SECRET</code>: {ssoConfig.hasClientSecret ? "Configured" : "Not set"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Automated Governance Alerts &amp; Webhooks</CardTitle>
            <CardDescription>
              Configure in-app bell notifications or Slack/Teams webhooks for governance events.
            </CardDescription>
          </div>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                setStatusMsg(null);
                setErrorMsg(null);
                const res = await fetch("/api/alerts", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  setStatusMsg(
                    `Digest sent: ${data.digest.appetiteBreaches} risk breaches, ${data.digest.overdueActions} overdue actions, ${data.digest.overdueAppraisals} overdue appraisals.`,
                  );
                } else {
                  setErrorMsg(data.error || "Failed to trigger digest.");
                }
              }}
            >
              Run Governance Digest Now
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {alertRules.map((rule) => (
            <div
              key={rule.id}
              className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center rounded-md border border-border p-3 text-xs"
            >
              <div className="lg:col-span-4">
                <div className="font-semibold">{rule.label}</div>
                <div className="text-[11px] text-muted-foreground">{rule.description}</div>
              </div>
              <div className="lg:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={rule.isEnabled}
                  onChange={(e) =>
                    setAlertRules((prev) =>
                      prev.map((r) => (r.id === rule.id ? { ...r, isEnabled: e.target.checked } : r)),
                    )
                  }
                  className="rounded border-border"
                />
                <span>{rule.isEnabled ? "Enabled" : "Disabled"}</span>
              </div>
              <div className="lg:col-span-2">
                <Select
                  disabled={!canEdit}
                  value={rule.channel}
                  onChange={(e) =>
                    setAlertRules((prev) =>
                      prev.map((r) =>
                        r.id === rule.id ? { ...r, channel: e.target.value as "IN_APP" | "WEBHOOK" } : r,
                      ),
                    )
                  }
                  className="h-8 text-xs"
                >
                  <option value="IN_APP">In-App Bell</option>
                  <option value="WEBHOOK">Webhook (Slack / Teams)</option>
                </Select>
              </div>
              <div className="lg:col-span-3">
                <Input
                  disabled={!canEdit || rule.channel !== "WEBHOOK"}
                  placeholder="https://hooks.slack.com/..."
                  value={rule.webhookUrl || ""}
                  onChange={(e) =>
                    setAlertRules((prev) =>
                      prev.map((r) => (r.id === rule.id ? { ...r, webhookUrl: e.target.value } : r)),
                    )
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="lg:col-span-1 flex justify-end">
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setStatusMsg(null);
                      setErrorMsg(null);
                      const res = await fetch("/api/alerts", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "UPDATE_RULE",
                          id: rule.id,
                          isEnabled: rule.isEnabled,
                          channel: rule.channel,
                          webhookUrl: rule.webhookUrl || null,
                        }),
                      });
                      if (res.ok) setStatusMsg(`Saved alert rule "${rule.label}".`);
                      else setErrorMsg("Failed to save alert rule.");
                    }}
                  >
                    Save
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
