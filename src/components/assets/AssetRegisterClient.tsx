"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Download, Upload, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatEnumLabel } from "@/lib/utils";

interface AssetItem {
  id: string;
  assetCode: string;
  name: string;
  description: string;
  assetType: string;
  country: string;
  lifecycleStage: string;
  autonomyLevel: string;
  dataSensitivity: string;
  sourcingType: string;
  vendorName: string | null;
  isAgent: boolean;
  businessUnit: { id: string; code: string; name: string; country: string };
  owner: { id: string; name: string; email: string } | null;
  overseer: { id: string; name: string; email: string } | null;
  frameAssessments: Array<{ overallScore: number }>;
  aaefAppraisals: Array<{ assignedProfile: { code: string; name: string } | null }>;
  _count: { risks: number; incidents: number };
}

interface OptionItem {
  id: string;
  name: string;
  code?: string;
  country?: string;
}

export function AssetRegisterClient({
  initialAssets,
  businessUnits,
  users,
  canWrite,
}: {
  initialAssets: AssetItem[];
  businessUnits: OptionItem[];
  users: OptionItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [q, setQ] = useState("");
  const [buFilter, setBuFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [autonomyFilter, setAutonomyFilter] = useState("");
  const [sourcingFilter, setSourcingFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    assetType: "COPILOT",
    businessUnitId: businessUnits[0]?.id || "",
    country: businessUnits[0]?.country || "Singapore",
    ownerId: users[0]?.id || "",
    overseerId: "",
    escalationPath: "",
    lifecycleStage: "PILOT",
    autonomyLevel: "ASSISTIVE",
    dataSensitivity: "INTERNAL",
    sourcingType: "IN_HOUSE",
    vendorName: "",
    isAgent: false,
  });

  // CSV Import state
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<{
    validCount: number;
    totalRows: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const countries = useMemo(
    () => Array.from(new Set(assets.map((a) => a.country))).sort(),
    [assets]
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (buFilter && a.businessUnit.id !== buFilter) return false;
      if (countryFilter && a.country !== countryFilter) return false;
      if (lifecycleFilter && a.lifecycleStage !== lifecycleFilter) return false;
      if (autonomyFilter && a.autonomyLevel !== autonomyFilter) return false;
      if (sourcingFilter && a.sourcingType !== sourcingFilter) return false;
      if (agentFilter === "true" && !a.isAgent) return false;
      if (agentFilter === "false" && a.isAgent) return false;
      if (query) {
        const hay = `${a.assetCode} ${a.name} ${a.description} ${a.vendorName || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [assets, q, buFilter, countryFilter, lifecycleFilter, autonomyFilter, sourcingFilter, agentFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ownerId: form.ownerId || null,
        overseerId: form.overseerId || null,
        jurisdictions: [form.country],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create AI asset.");
      return;
    }
    setSuccess(`Registered ${data.asset.assetCode}: ${data.asset.name}`);
    setShowCreate(false);
    router.refresh();
    const listRes = await fetch("/api/assets");
    if (listRes.ok) {
      const listData = await listRes.json();
      setAssets(listData.assets);
    }
  }

  async function handleDryRun() {
    setError(null);
    const res = await fetch("/api/assets/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText, dryRun: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "CSV validation failed.");
      return;
    }
    setImportPreview(data);
  }

  async function handleCommitImport() {
    setError(null);
    const res = await fetch("/api/assets/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText, dryRun: false }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "CSV import failed.");
      return;
    }
    setSuccess(`Imported ${data.importedCount} AI asset(s).`);
    setShowImport(false);
    setImportPreview(null);
    setCsvText("");
    const listRes = await fetch("/api/assets");
    if (listRes.ok) {
      const listData = await listRes.json();
      setAssets(listData.assets);
    }
  }

  function profileVariant(code: string | undefined) {
    if (code === "OPERATIONAL") return "success";
    if (code === "DEVELOPING") return "info";
    if (code === "RESTRICTED") return "warning";
    if (code === "UNDER_REVIEW") return "danger";
    return "secondary";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AI Asset Register</h1>
          <p className="text-sm text-muted-foreground">
            Central inventory of enterprise AI systems, copilots, models, vendor features, and autonomous agents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/assets/export">
            <Button type="button" variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export CSV
            </Button>
          </a>
          {canWrite && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowImport(!showImport)}>
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Import CSV
              </Button>
              <Button type="button" size="sm" onClick={() => setShowCreate(!showCreate)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Register AI Asset
              </Button>
            </>
          )}
        </div>
      </div>

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </div>
      )}

      {showCreate && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>Register New AI Asset</CardTitle>
            <CardDescription>Assign accountable owner, lifecycle stage, autonomy level, and agent flag</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Asset Name</label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Claims Triage Agent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Asset Type</label>
                  <Select value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
                    <option value="COPILOT">Copilot</option>
                    <option value="MODEL">Model</option>
                    <option value="RAG_ASSISTANT">RAG Assistant</option>
                    <option value="AUTONOMOUS_AGENT">Autonomous Agent</option>
                    <option value="VENDOR_FEATURE">Vendor Feature</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Business Unit</label>
                  <Select
                    value={form.businessUnitId}
                    onChange={(e) => {
                      const bu = businessUnits.find((b) => b.id === e.target.value);
                      setForm({ ...form, businessUnitId: e.target.value, country: bu?.country || form.country });
                    }}
                  >
                    {businessUnits.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.country})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Lifecycle Stage</label>
                  <Select
                    value={form.lifecycleStage}
                    onChange={(e) => setForm({ ...form, lifecycleStage: e.target.value })}
                  >
                    <option value="IDEA">Idea</option>
                    <option value="PILOT">Pilot</option>
                    <option value="PRODUCTION">Production</option>
                    <option value="RETIRED">Retired</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Autonomy Level</label>
                  <Select
                    value={form.autonomyLevel}
                    onChange={(e) => setForm({ ...form, autonomyLevel: e.target.value })}
                  >
                    <option value="ASSISTIVE">Assistive</option>
                    <option value="HUMAN_IN_THE_LOOP">Human in the Loop</option>
                    <option value="HUMAN_ON_THE_LOOP">Human on the Loop</option>
                    <option value="AUTONOMOUS">Autonomous</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Data Sensitivity</label>
                  <Select
                    value={form.dataSensitivity}
                    onChange={(e) => setForm({ ...form, dataSensitivity: e.target.value })}
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="CONFIDENTIAL">Confidential</option>
                    <option value="RESTRICTED">Restricted</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Accountable Owner</label>
                  <Select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Human Overseer</label>
                  <Select value={form.overseerId} onChange={(e) => setForm({ ...form, overseerId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Sourcing</label>
                  <Select
                    value={form.sourcingType}
                    onChange={(e) => setForm({ ...form, sourcingType: e.target.value })}
                  >
                    <option value="IN_HOUSE">In-house</option>
                    <option value="VENDOR">Vendor</option>
                  </Select>
                </div>
              </div>

              {form.sourcingType === "VENDOR" && (
                <div>
                  <label className="text-xs font-medium block mb-1">Vendor Name</label>
                  <Input
                    value={form.vendorName}
                    onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                    placeholder="e.g. Helios AI Systems"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1">Description &amp; Intended Scope</label>
                <Textarea
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the AI asset's purpose, users, and operational boundaries."
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isAgent}
                    onChange={(e) => setForm({ ...form, isAgent: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span>Flag as AI Agent (enables AAEF 30/90-day and ongoing appraisals)</span>
                </label>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Save AI Asset
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showImport && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>Import AI Assets from CSV</CardTitle>
            <CardDescription>
              Paste CSV with headers: assetCode, name, description, assetType, businessUnitCode, country,
              lifecycleStage, autonomyLevel, dataSensitivity, sourcingType, vendorName, isAgent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              className="font-mono text-xs min-h-[120px]"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="assetCode,name,description,assetType,businessUnitCode,country,lifecycleStage,autonomyLevel,dataSensitivity,sourcingType,vendorName,isAgent"
            />
            {importPreview && (
              <div className="rounded border border-border p-3 text-xs space-y-1 bg-surface-muted/40">
                <div>
                  Validated {importPreview.validCount} of {importPreview.totalRows} row(s).
                </div>
                {importPreview.errors.map((err, i) => (
                  <div key={i} className="text-red-700 dark:text-red-400">
                    Row {err.row}: {err.message}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleDryRun}>
                Validate CSV
              </Button>
              {importPreview && importPreview.errors.length === 0 && (
                <Button type="button" size="sm" onClick={handleCommitImport}>
                  Import {importPreview.validCount} Asset(s)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            <div className="relative lg:col-span-2">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" aria-hidden="true" />
              <Input
                className="pl-8"
                placeholder="Search code, name, or vendor..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={buFilter} onChange={(e) => setBuFilter(e.target.value)}>
              <option value="">All Business Units</option>
              {businessUnits.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              <option value="">All Countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}>
              <option value="">All Lifecycles</option>
              <option value="IDEA">Idea</option>
              <option value="PILOT">Pilot</option>
              <option value="PRODUCTION">Production</option>
              <option value="RETIRED">Retired</option>
            </Select>
            <Select value={autonomyFilter} onChange={(e) => setAutonomyFilter(e.target.value)}>
              <option value="">All Autonomy</option>
              <option value="ASSISTIVE">Assistive</option>
              <option value="HUMAN_IN_THE_LOOP">Human in Loop</option>
              <option value="HUMAN_ON_THE_LOOP">Human on Loop</option>
              <option value="AUTONOMOUS">Autonomous</option>
            </Select>
            <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
              <option value="">Agents &amp; Non-Agents</option>
              <option value="true">AI Agents Only</option>
              <option value="false">Non-Agent Assets</option>
            </Select>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Showing {filtered.length} of {assets.length} registered AI assets</span>
            <Select
              className="w-40 h-7 text-xs"
              value={sourcingFilter}
              onChange={(e) => setSourcingFilter(e.target.value)}
            >
              <option value="">All Sourcing</option>
              <option value="IN_HOUSE">In-house</option>
              <option value="VENDOR">Vendor</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Register Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">Code</th>
                <th className="py-2.5 px-4 font-medium">AI Asset</th>
                <th className="py-2.5 px-4 font-medium">Business Unit</th>
                <th className="py-2.5 px-4 font-medium">Lifecycle</th>
                <th className="py-2.5 px-4 font-medium">Autonomy</th>
                <th className="py-2.5 px-4 font-medium">Owner</th>
                <th className="py-2.5 px-4 font-medium">FRAME</th>
                <th className="py-2.5 px-4 font-medium">AAEF Profile</th>
                <th className="py-2.5 px-4 font-medium text-right">Risks</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const latestFrame = a.frameAssessments[0]?.overallScore;
                const latestProfile = a.aaefAppraisals[0]?.assignedProfile;
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                    <td className="py-2.5 px-4 font-mono font-medium">
                      <Link href={`/assets/${a.id}`} className="text-primary hover:underline">
                        {a.assetCode}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4">
                      <Link href={`/assets/${a.id}`} className="font-medium hover:underline">
                        {a.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span>{formatEnumLabel(a.assetType)}</span>
                        {a.isAgent && <Badge variant="info">Agent</Badge>}
                        {a.vendorName && <span>· {a.vendorName}</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div>{a.businessUnit.name}</div>
                      <div className="text-[11px] text-muted-foreground">{a.country}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant={a.lifecycleStage === "PRODUCTION" ? "success" : "secondary"}>
                        {formatEnumLabel(a.lifecycleStage)}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4">{formatEnumLabel(a.autonomyLevel)}</td>
                    <td className="py-2.5 px-4">
                      {a.owner ? a.owner.name : <Badge variant="danger">Unassigned</Badge>}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums font-medium">
                      {latestFrame !== undefined ? `${latestFrame.toFixed(1)} / 4.0` : "Not assessed"}
                    </td>
                    <td className="py-2.5 px-4">
                      {a.isAgent ? (
                        latestProfile ? (
                          <Badge variant={profileVariant(latestProfile.code)}>{latestProfile.name}</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{a._count.risks}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No AI assets match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
