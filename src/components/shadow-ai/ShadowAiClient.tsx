"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export interface ShadowAiRow {
  id: string;
  domain: string;
  providerName: string;
  category: string;
  source: "SASE" | "DNS" | "IDP" | "CLOUD" | "EXPENSE";
  businessUnit: string;
  requestCount: number;
  bytesUploaded: number;
  uniqueUsers: number;
  status: "DETECTED" | "UNDER_REVIEW" | "SANCTIONED" | "BLOCKED" | "DISMISSED";
  matchedAsset: {
    id: string;
    assetCode: string;
    name: string;
    lifecycleStage: string;
  } | null;
  notes: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface Props {
  initialCandidates: ShadowAiRow[];
  canTriage: boolean;
  canSimulate: boolean;
}

const STATUS_VARIANT: Record<ShadowAiRow["status"], "warning" | "info" | "success" | "danger" | "secondary"> = {
  DETECTED: "warning",
  UNDER_REVIEW: "info",
  SANCTIONED: "success",
  BLOCKED: "danger",
  DISMISSED: "secondary",
};

export function ShadowAiClient({ initialCandidates, canTriage, canSimulate }: Props) {
  const [candidates, setCandidates] = useState<ShadowAiRow[]>(initialCandidates);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Simulator state for Admin
  const [simDomain, setSimDomain] = useState("api.anthropic.com");
  const [simSource, setSimSource] = useState<"SASE" | "DNS" | "IDP">("SASE");
  const [simBu, setSimBu] = useState("Finance");

  const stats = useMemo(() => {
    const detected = candidates.filter((c) => c.status === "DETECTED" || c.status === "UNDER_REVIEW").length;
    const totalRequests = candidates.reduce((sum, c) => sum + c.requestCount, 0);
    const totalMb = candidates.reduce((sum, c) => sum + c.bytesUploaded, 0) / (1024 * 1024);
    const blockedOrSanctioned = candidates.filter((c) => c.status === "BLOCKED" || c.status === "SANCTIONED").length;
    return { detected, totalRequests, totalMb, blockedOrSanctioned };
  }, [candidates]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (sourceFilter !== "ALL" && c.source !== sourceFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !c.domain.toLowerCase().includes(q) &&
          !c.providerName.toLowerCase().includes(q) &&
          !c.businessUnit.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [candidates, statusFilter, sourceFilter, search]);

  async function refreshList() {
    const res = await fetch("/api/discovery");
    if (res.ok) {
      const data = await res.json();
      setCandidates(data.candidates ?? []);
    }
  }

  async function updateStatus(id: string, status: ShadowAiRow["status"]) {
    setBusyId(id);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/discovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_STATUS", id, status }),
      });
      const data = await res.json();
      if (res.ok) {
        setCandidates((prev) => prev.map((c) => (c.id === id ? data.candidate : c)));
        setStatusMsg(`Updated status for ${data.candidate.domain} to ${status}.`);
      } else {
        setErrorMsg(data.error || "Failed to update status.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function promoteToAsset(row: ShadowAiRow) {
    setBusyId(row.id);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/discovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PROMOTE_TO_ASSET",
          id: row.id,
          assetName: `${row.providerName} (${row.businessUnit})`,
          businessUnit: row.businessUnit,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCandidates((prev) => prev.map((c) => (c.id === row.id ? data.candidate : c)));
        setStatusMsg(`Promoted ${row.domain} to AI Asset Register as ${data.asset.assetCode} (Proposal stage).`);
      } else {
        setErrorMsg(data.error || "Failed to promote to Asset Register.");
      }
    } finally {
      setBusyId(null);
    }
  }

  const discoveryCurl = `curl -X POST http://localhost:3000/api/discovery/ingest \\
  -H "Authorization: Bearer agx_live_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "events": [
      {
        "domain": "chatgpt.com",
        "source": "SASE",
        "businessUnit": "Marketing",
        "requestCount": 142,
        "bytesUploaded": 4520000,
        "uniqueUsers": 11
      },
      {
        "domain": "api.anthropic.com",
        "source": "DNS",
        "businessUnit": "Finance",
        "requestCount": 38,
        "uniqueUsers": 2
      }
    ]
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Shadow AI Candidates</CardDescription>
            <CardTitle className="text-2xl">{stats.detected}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Detected or under governance review
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Observed Requests</CardDescription>
            <CardTitle className="text-2xl">{stats.totalRequests.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across SASE, DNS, IdP, and Cloud feeds
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Data Uploaded</CardDescription>
            <CardTitle className="text-2xl">{stats.totalMb.toFixed(2)} MB</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Outbound payload volume from SWG/SASE
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Triaged (Sanctioned / Blocked)</CardDescription>
            <CardTitle className="text-2xl">{stats.blockedOrSanctioned}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Onboarded to Asset Register or blocked
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Detected Shadow AI Services</CardTitle>
            <CardDescription>
              Unregistered AI domains and SaaS apps captured from SASE/SWG traffic, DNS resolver logs, and IdP OAuth grants.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search domain, provider, BU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48 text-xs"
            />
            <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-8 w-32 text-xs">
              <option value="ALL">All Sources</option>
              <option value="SASE">SASE / SWG</option>
              <option value="DNS">DNS Logs</option>
              <option value="IDP">IdP / OAuth</option>
              <option value="CLOUD">Cloud</option>
              <option value="EXPENSE">Expense</option>
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 w-36 text-xs">
              <option value="ALL">All Statuses</option>
              <option value="DETECTED">Detected</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="SANCTIONED">Sanctioned</option>
              <option value="BLOCKED">Blocked</option>
              <option value="DISMISSED">Dismissed</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No Shadow AI candidates match the current filters. Forward SASE/DNS logs to{" "}
              <code>POST /api/discovery/ingest</code> or use the simulator below.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Provider / Domain</th>
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Business Unit</th>
                    <th className="py-2 pr-3 font-medium">Requests</th>
                    <th className="py-2 pr-3 font-medium">Uploaded</th>
                    <th className="py-2 pr-3 font-medium">Users</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Asset</th>
                    {canTriage && <th className="py-2 text-right font-medium">Triage</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold">{row.providerName}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {row.domain} · {row.category}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline">{row.source}</Badge>
                      </td>
                      <td className="py-2.5 pr-3">{row.businessUnit}</td>
                      <td className="py-2.5 pr-3 font-mono">{row.requestCount.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-mono">
                        {(row.bytesUploaded / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{row.uniqueUsers}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        {row.matchedAsset ? (
                          <Link
                            href={`/assets/${row.matchedAsset.id}`}
                            className="text-primary underline underline-offset-2"
                          >
                            {row.matchedAsset.assetCode}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Unregistered</span>
                        )}
                      </td>
                      {canTriage && (
                        <td className="py-2.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            {!row.matchedAsset && row.status !== "BLOCKED" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                disabled={busyId === row.id}
                                onClick={() => promoteToAsset(row)}
                              >
                                Promote
                              </Button>
                            )}
                            {row.status !== "BLOCKED" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busyId === row.id}
                                onClick={() => updateStatus(row.id, "BLOCKED")}
                              >
                                Block
                              </Button>
                            )}
                            {row.status !== "DISMISSED" && row.status !== "SANCTIONED" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busyId === row.id}
                                onClick={() => updateStatus(row.id, "DISMISSED")}
                              >
                                Dismiss
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SASE / DNS / IdP Feed Integration</CardTitle>
            <CardDescription>
              Forward aggregated events from Zscaler, Netskope, Cloudflare Gateway, Cisco Umbrella, or your SIEM using a{" "}
              <code>Bearer agx_live_...</code> key from <Link href="/integrations" className="underline">API &amp; Integrations</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-surface-muted p-3 font-mono text-[11px] overflow-x-auto select-all">
              {discoveryCurl}
            </pre>
          </CardContent>
        </Card>

        {canSimulate && (
          <Card>
            <CardHeader>
              <CardTitle>Simulate Network Discovery Event</CardTitle>
              <CardDescription>
                Test Shadow AI detection, domain matching, and <code>SHADOW_AI_DETECTED</code> alert delivery.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input
                  value={simDomain}
                  onChange={(e) => setSimDomain(e.target.value)}
                  placeholder="Domain (e.g. chatgpt.com)"
                />
                <Select
                  value={simSource}
                  onChange={(e) => setSimSource(e.target.value as "SASE" | "DNS" | "IDP")}
                >
                  <option value="SASE">SASE / SWG</option>
                  <option value="DNS">DNS Lookup</option>
                  <option value="IDP">IdP / OAuth</option>
                </Select>
                <Input
                  value={simBu}
                  onChange={(e) => setSimBu(e.target.value)}
                  placeholder="Business Unit"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  setStatusMsg(null);
                  setErrorMsg(null);
                  const res = await fetch("/api/discovery/ingest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      domain: simDomain,
                      source: simSource,
                      businessUnit: simBu,
                      requestCount: 25,
                      bytesUploaded: 1850000,
                      uniqueUsers: 4,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setStatusMsg(
                      `Ingested ${simDomain} (${simSource}) for ${simBu}. Alerts triggered: ${data.alertsTriggered}.`,
                    );
                    await refreshList();
                  } else {
                    setErrorMsg(data.error || "Failed to ingest discovery event.");
                  }
                }}
              >
                Send Test Discovery Event
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
