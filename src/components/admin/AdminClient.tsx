"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatEnumLabel } from "@/lib/utils";

interface ConfigRow {
  id: string;
  key: string;
  description: string;
  valueJson: Record<string, unknown>;
}

interface CriterionRow {
  id: string;
  dimension: string;
  code: string;
  title: string;
  description: string;
  rubricJson: Record<string, string>;
  isPlaceholder: boolean;
  isActive: boolean;
}

interface ProfileRow {
  id: string;
  code: string;
  name: string;
  description: string;
  governanceConsequence: string;
  requiredAction: string;
  ruleConfigJson: Record<string, unknown>;
  isPlaceholder: boolean;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  role: { id: string; code: string; name: string };
  businessUnit: { id: string; code: string; name: string } | null;
}

interface RoleRow {
  id: string;
  code: string;
  name: string;
}

interface BusinessUnitRow {
  id: string;
  code: string;
  name: string;
  country: string;
  headName: string | null;
  _count?: { assets: number; users: number };
}

interface AlertRuleRow {
  id: string;
  eventType: string;
  label: string;
  description: string;
  isEnabled: boolean;
  channel: "IN_APP" | "WEBHOOK" | "TELEGRAM";
  webhookUrl: string | null;
  telegramChatId: string | null;
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

interface MaskedAiConfigProp {
  enabled: boolean;
  provider: "OPENAI" | "OPENROUTER" | "GEMINI" | "ANTHROPIC" | "CUSTOM_OPENAI";
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  maskedKey: string;
  temperature: number;
}

function getRoleTierLabel(code: string): "Administrator" | "Editor" | "Viewer" {
  if (code === "ADMIN") return "Administrator";
  if (code === "EXECUTIVE" || code === "AUDITOR") return "Viewer";
  return "Editor";
}

export function AdminClient({
  initialConfigs,
  initialCriteria,
  initialProfiles,
  initialUsers,
  roles,
  businessUnits,
  initialAlertRules,
  initialTelemetryKeys,
  assets,
  ssoConfig,
  initialAiConfig,
  canEdit,
}: {
  initialConfigs: ConfigRow[];
  initialCriteria: CriterionRow[];
  initialProfiles: ProfileRow[];
  initialUsers: UserRow[];
  roles: RoleRow[];
  businessUnits: BusinessUnitRow[];
  initialAlertRules: AlertRuleRow[];
  initialTelemetryKeys: TelemetryKeyRow[];
  assets: SimpleAssetRow[];
  ssoConfig: SsoStatusInfo;
  initialAiConfig: MaskedAiConfigProp;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"params" | "business-units" | "frame" | "aaef" | "users" | "integrations" | "ai-insights">("params");
  const [aiEnabled, setAiEnabled] = useState(initialAiConfig.enabled);
  const [aiProvider, setAiProvider] = useState(initialAiConfig.provider);
  const [aiModel, setAiModel] = useState(initialAiConfig.model);
  const [aiBaseUrl, setAiBaseUrl] = useState(initialAiConfig.baseUrl);
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiHasKey, setAiHasKey] = useState(initialAiConfig.hasApiKey);
  const [aiMaskedKey, setAiMaskedKey] = useState(initialAiConfig.maskedKey);
  const [aiTemperature, setAiTemperature] = useState(String(initialAiConfig.temperature));
  const [aiTesting, setAiTesting] = useState(false);
  const [configs, setConfigs] = useState(initialConfigs);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [users, setUsers] = useState(initialUsers);
  const [buList, setBuList] = useState<BusinessUnitRow[]>(businessUnits);
  const [alertRules, setAlertRules] = useState<AlertRuleRow[]>(initialAlertRules);
  const [telemetryKeys, setTelemetryKeys] = useState<TelemetryKeyRow[]>(initialTelemetryKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdPlaintextKey, setCreatedPlaintextKey] = useState<string | null>(null);
  const [simAssetCode, setSimAssetCode] = useState(assets[0]?.assetCode || "");
  const [simAmount, setSimAmount] = useState("1250");
  const [simDesc, setSimDesc] = useState("Monthly inference compute spend");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New user state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoleId, setNewRoleId] = useState(roles[0]?.id || "");
  const [newBuId, setNewBuId] = useState("");

  // New business unit state
  const [newBuCode, setNewBuCode] = useState("");
  const [newBuName, setNewBuName] = useState("");
  const [newBuCountry, setNewBuCountry] = useState("Singapore");
  const [newBuHead, setNewBuHead] = useState("");

  async function saveGovernanceConfig(cfg: ConfigRow, valueJson: Record<string, unknown>) {
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GOVERNANCE_CONFIG", key: cfg.key, valueJson }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save configuration.");
      setConfigs((prev) => prev.map((c) => (c.key === cfg.key ? { ...c, valueJson } : c)));
      setStatusMsg(`Saved ${cfg.key} configuration.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save configuration.");
    }
  }

  async function handleCreateBusinessUnit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/business-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newBuCode,
          name: newBuName,
          country: newBuCountry,
          headName: newBuHead || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add business unit.");
      setBuList((prev) => [...prev, data.businessUnit].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBuCode("");
      setNewBuName("");
      setNewBuHead("");
      setStatusMsg(`Added business unit ${data.businessUnit.name} (${data.businessUnit.code}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add business unit.");
    }
  }

  async function handleUpdateBusinessUnit(bu: BusinessUnitRow) {
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/business-units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bu.id,
          code: bu.code,
          name: bu.name,
          country: bu.country,
          headName: bu.headName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update business unit.");
      setBuList((prev) => prev.map((row) => (row.id === bu.id ? data.businessUnit : row)));
      setUsers((prev) =>
        prev.map((u) =>
          u.businessUnit?.id === bu.id
            ? { ...u, businessUnit: { id: data.businessUnit.id, code: data.businessUnit.code, name: data.businessUnit.name } }
            : u,
        ),
      );
      setStatusMsg(`Saved business unit ${data.businessUnit.name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update business unit.");
    }
  }

  async function handleDeleteBusinessUnit(bu: BusinessUnitRow) {
    setStatusMsg(null);
    setErrorMsg(null);
    if (!window.confirm(`Remove business unit "${bu.name}" (${bu.code})?`)) return;
    try {
      const res = await fetch(`/api/admin/business-units?id=${encodeURIComponent(bu.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove business unit.");
      setBuList((prev) => prev.filter((row) => row.id !== bu.id));
      setStatusMsg(`Removed business unit ${bu.name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to remove business unit.");
    }
  }

  async function saveCriterion(c: CriterionRow) {
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "FRAME_CRITERION",
          id: c.id,
          title: c.title,
          description: c.description,
          rubricJson: c.rubricJson,
          isPlaceholder: c.isPlaceholder,
          isActive: c.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save criterion.");
      setStatusMsg(`Saved FRAME criterion ${c.code}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function saveProfile(p: ProfileRow, ruleConfigJson: Record<string, unknown>) {
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PERFORMANCE_PROFILE",
          id: p.id,
          governanceConsequence: p.governanceConsequence,
          requiredAction: p.requiredAction,
          ruleConfigJson,
          isPlaceholder: p.isPlaceholder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile.");
      setProfiles((prev) => prev.map((row) => (row.id === p.id ? { ...p, ruleConfigJson } : row)));
      setStatusMsg(`Saved AAEF profile rule for ${p.name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save profile.");
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          password: newPassword,
          roleId: newRoleId,
          businessUnitId: newBuId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user.");
      setUsers((prev) => [...prev, data.user]);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setStatusMsg(`Created user ${data.user.email}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create user.");
    }
  }

  async function handleUpdateUser(
    u: UserRow,
    patch: { roleId?: string; businessUnitId?: string | null; isActive?: boolean },
  ) {
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, ...patch }),
    });
    const data = await res.json();
    if (res.ok) {
      setUsers((prev) => prev.map((row) => (row.id === u.id ? data.user : row)));
      setStatusMsg(`Updated account settings for ${u.email}.`);
    } else {
      setErrorMsg(data.error || "Failed to update user.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: "params", label: "Parameters & Appetite" },
          { id: "business-units", label: "Business Units" },
          { id: "frame", label: "FRAME Criteria & Rubrics" },
          { id: "aaef", label: "AAEF Profile Rules" },
          { id: "users", label: "Users & Roles" },
          { id: "integrations", label: "Alerts & Integrations" },
          { id: "ai-insights", label: "AI Insights (BYO LLM)" },
        ].map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? "primary" : "outline"}
            onClick={() => setTab(t.id as typeof tab)}
          >
            {t.label}
          </Button>
        ))}
      </div>

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

      {tab === "params" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {configs.map((cfg) => (
            <ConfigCard key={cfg.key} cfg={cfg} canEdit={canEdit} onSave={saveGovernanceConfig} />
          ))}
        </div>
      )}

      {tab === "business-units" && (
        <div className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Add Business Unit</CardTitle>
                <CardDescription>
                  Create an organisational business unit for AI asset ownership, risk grouping, and user scoping.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateBusinessUnit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <Input
                    type="text"
                    required
                    placeholder="Code (e.g. SG-FIN)"
                    value={newBuCode}
                    onChange={(e) => setNewBuCode(e.target.value.toUpperCase())}
                  />
                  <Input
                    type="text"
                    required
                    placeholder="Business Unit Name"
                    value={newBuName}
                    onChange={(e) => setNewBuName(e.target.value)}
                  />
                  <Input
                    type="text"
                    required
                    placeholder="Country (e.g. Singapore)"
                    value={newBuCountry}
                    onChange={(e) => setNewBuCountry(e.target.value)}
                  />
                  <Input
                    type="text"
                    placeholder="Head / Lead Name (optional)"
                    value={newBuHead}
                    onChange={(e) => setNewBuHead(e.target.value)}
                  />
                  <Button type="submit">Add Business Unit</Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Registered Business Units ({buList.length})</CardTitle>
              <CardDescription>
                Edit details inline and click Save. Business units with assigned AI assets or users must be reassigned before removal.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Code</th>
                    <th className="py-2.5 px-4 font-medium">Name</th>
                    <th className="py-2.5 px-4 font-medium">Country</th>
                    <th className="py-2.5 px-4 font-medium">Head / Lead</th>
                    <th className="py-2.5 px-4 font-medium">Assets</th>
                    <th className="py-2.5 px-4 font-medium">Users</th>
                    {canEdit && <th className="py-2.5 px-4 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {buList.map((bu) => {
                    const assetCount = bu._count?.assets ?? 0;
                    const userCount = bu._count?.users ?? 0;
                    const inUse = assetCount > 0 || userCount > 0;
                    return (
                      <tr key={bu.id} className="border-b border-border last:border-0">
                        <td className="py-2 px-4">
                          {canEdit ? (
                            <Input
                              aria-label={`Code for ${bu.name}`}
                              value={bu.code}
                              onChange={(e) =>
                                setBuList((prev) =>
                                  prev.map((row) =>
                                    row.id === bu.id ? { ...row, code: e.target.value.toUpperCase() } : row,
                                  ),
                                )
                              }
                              className="h-7 text-xs w-28 font-mono"
                            />
                          ) : (
                            <Badge variant="outline">{bu.code}</Badge>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {canEdit ? (
                            <Input
                              aria-label={`Name for ${bu.code}`}
                              value={bu.name}
                              onChange={(e) =>
                                setBuList((prev) =>
                                  prev.map((row) => (row.id === bu.id ? { ...row, name: e.target.value } : row)),
                                )
                              }
                              className="h-7 text-xs min-w-[180px]"
                            />
                          ) : (
                            <span className="font-medium">{bu.name}</span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {canEdit ? (
                            <Input
                              aria-label={`Country for ${bu.code}`}
                              value={bu.country}
                              onChange={(e) =>
                                setBuList((prev) =>
                                  prev.map((row) => (row.id === bu.id ? { ...row, country: e.target.value } : row)),
                                )
                              }
                              className="h-7 text-xs w-32"
                            />
                          ) : (
                            bu.country
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {canEdit ? (
                            <Input
                              aria-label={`Head for ${bu.code}`}
                              placeholder="Unassigned"
                              value={bu.headName ?? ""}
                              onChange={(e) =>
                                setBuList((prev) =>
                                  prev.map((row) => (row.id === bu.id ? { ...row, headName: e.target.value } : row)),
                                )
                              }
                              className="h-7 text-xs min-w-[140px]"
                            />
                          ) : (
                            bu.headName || "Unassigned"
                          )}
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant={assetCount > 0 ? "info" : "secondary"}>{assetCount}</Badge>
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant={userCount > 0 ? "info" : "secondary"}>{userCount}</Badge>
                        </td>
                        {canEdit && (
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateBusinessUnit(bu)}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                disabled={inUse}
                                title={
                                  inUse
                                    ? "Reassign linked AI assets and users before removing this business unit."
                                    : "Remove business unit"
                                }
                                onClick={() => handleDeleteBusinessUnit(bu)}
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "frame" && (
        <div className="space-y-4">
          {criteria.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.code}</Badge>
                    <Badge variant="info">{formatEnumLabel(c.dimension)}</Badge>
                    {c.isPlaceholder && <Badge variant="warning">Placeholder</Badge>}
                  </div>
                  <CardTitle className="mt-2">{c.title}</CardTitle>
                </div>
                {canEdit && (
                  <Button type="button" size="sm" onClick={() => saveCriterion(c)}>
                    Save Criterion
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Title</label>
                    <Input
                      disabled={!canEdit}
                      value={c.title}
                      onChange={(e) =>
                        setCriteria((prev) => prev.map((row) => (row.id === c.id ? { ...row, title: e.target.value } : row)))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Description</label>
                    <Input
                      disabled={!canEdit}
                      value={c.description}
                      onChange={(e) =>
                        setCriteria((prev) =>
                          prev.map((row) => (row.id === c.id ? { ...row, description: e.target.value } : row))
                        )
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {["0", "1", "2", "3", "4"].map((lvl) => (
                    <div key={lvl}>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Level {lvl}
                      </label>
                      <Textarea
                        disabled={!canEdit}
                        className="min-h-[64px] text-xs"
                        value={c.rubricJson[lvl] || ""}
                        onChange={(e) =>
                          setCriteria((prev) =>
                            prev.map((row) =>
                              row.id === c.id
                                ? { ...row, rubricJson: { ...row.rubricJson, [lvl]: e.target.value } }
                                : row
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "aaef" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {profiles.map((p) => (
            <ProfileRuleCard
              key={p.id}
              profile={p}
              canEdit={canEdit}
              onChange={(updated) => setProfiles((prev) => prev.map((row) => (row.id === p.id ? updated : row)))}
              onSave={saveProfile}
            />
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Add Governance User</CardTitle>
                <CardDescription>
                  Create an account and assign an Administrator, Editor, or Viewer role with optional business unit scope.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border border-border bg-surface-muted/40 p-2.5">
                    <span className="font-semibold text-foreground">Administrator</span>
                    <p className="text-muted-foreground mt-0.5">
                      <strong>Administrator</strong>: Full system configuration, user management, and write access.
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-muted/40 p-2.5">
                    <span className="font-semibold text-foreground">Editors</span>
                    <p className="text-muted-foreground mt-0.5">
                      <strong>AI Governance Office</strong>, <strong>Asset Owner</strong>, <strong>Assessor</strong>: Create and edit governed records per role scope.
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-surface-muted/40 p-2.5">
                    <span className="font-semibold text-foreground">Viewers</span>
                    <p className="text-muted-foreground mt-0.5">
                      <strong>Executive</strong>, <strong>Auditor</strong>: Read-only access (Auditor also views the immutable audit log).
                    </p>
                  </div>
                </div>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <Input
                    type="email"
                    required
                    placeholder="Email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <Input
                    type="text"
                    required
                    placeholder="Full name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <Input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Initial password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)} aria-label="User role">
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({getRoleTierLabel(r.code)})
                      </option>
                    ))}
                  </Select>
                  <div className="flex gap-2">
                    <Select value={newBuId} onChange={(e) => setNewBuId(e.target.value)} aria-label="Business unit">
                      <option value="">All Business Units</option>
                      {buList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit">Add</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Registered Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Name</th>
                    <th className="py-2.5 px-4 font-medium">Email</th>
                    <th className="py-2.5 px-4 font-medium">Access Tier</th>
                    <th className="py-2.5 px-4 font-medium">Role</th>
                    <th className="py-2.5 px-4 font-medium">Business Unit</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    {canEdit && <th className="py-2.5 px-4 font-medium">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-4 font-medium">{u.name}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{u.email}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline">{getRoleTierLabel(u.role.code)}</Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        {canEdit ? (
                          <Select
                            aria-label={`Role for ${u.email}`}
                            value={u.role.id}
                            onChange={(e) => handleUpdateUser(u, { roleId: e.target.value })}
                            className="h-7 text-xs min-w-[170px]"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Badge variant="outline">{u.role.name}</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {canEdit ? (
                          <Select
                            aria-label={`Business unit for ${u.email}`}
                            value={u.businessUnit?.id ?? ""}
                            onChange={(e) => handleUpdateUser(u, { businessUnitId: e.target.value || null })}
                            className="h-7 text-xs min-w-[160px]"
                          >
                            <option value="">Enterprise-wide</option>
                            {buList.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          u.businessUnit ? u.businessUnit.name : "Enterprise-wide"
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant={u.isActive ? "success" : "secondary"}>
                          {u.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      {canEdit && (
                        <td className="py-2.5 px-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateUser(u, { isActive: !u.isActive })}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "integrations" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle>Automated Governance Alerts &amp; Digest</CardTitle>
                <CardDescription>
                  Configure in-app notifications or Slack/Teams webhook alerts for governance events.
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
                            r.id === rule.id
                              ? { ...r, channel: e.target.value as "IN_APP" | "WEBHOOK" | "TELEGRAM" }
                              : r,
                          ),
                        )
                      }
                      className="h-8 text-xs"
                    >
                      <option value="IN_APP">In-App Bell</option>
                      <option value="WEBHOOK">Webhook (Slack / Teams)</option>
                      <option value="TELEGRAM">Telegram Bot</option>
                    </Select>
                  </div>
                  <div className="lg:col-span-3">
                    {rule.channel === "TELEGRAM" ? (
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        <Input
                          disabled={!canEdit}
                          type="password"
                          placeholder="Bot Token (123456:ABC...)"
                          value={rule.webhookUrl || ""}
                          onChange={(e) =>
                            setAlertRules((prev) =>
                              prev.map((r) => (r.id === rule.id ? { ...r, webhookUrl: e.target.value } : r)),
                            )
                          }
                          className="h-8 text-xs"
                        />
                        <Input
                          disabled={!canEdit}
                          placeholder="Chat ID (e.g. -100123...)"
                          value={rule.telegramChatId || ""}
                          onChange={(e) =>
                            setAlertRules((prev) =>
                              prev.map((r) => (r.id === rule.id ? { ...r, telegramChatId: e.target.value } : r)),
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    ) : (
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
                    )}
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
                              telegramChatId: rule.telegramChatId || null,
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Telemetry &amp; Cost Ingestion API</CardTitle>
                <CardDescription>
                  Issue Bearer tokens for external agents or observability pipelines to push live boundary breaches and
                  measured ROI telemetry to <code>POST /api/telemetry/ingest</code>.
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
                            {k.keyPrefix}... · {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
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
                              description: simDesc,
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
                <CardTitle>Enterprise SSO (OIDC / SAML)</CardTitle>
                <CardDescription>
                  Connect Microsoft Entra ID, Okta, or Google Workspace via environment variables in <code>.env</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between rounded border border-border p-3">
                  <span className="font-medium">SSO Status</span>
                  <Badge variant={ssoConfig.enabled ? "success" : "secondary"}>
                    {ssoConfig.enabled ? `Enabled (${ssoConfig.providerName})` : "Local Auth Only"}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-muted-foreground">
                  <div>
                    <code>SSO_ENABLED</code>: {ssoConfig.enabled ? "true" : "false"}
                  </div>
                  <div>
                    <code>SSO_ISSUER_URL</code>: {ssoConfig.issuerUrl || "Not configured"}
                  </div>
                  <div>
                    <code>SSO_CLIENT_ID</code>: {ssoConfig.clientId || "Not configured"}
                  </div>
                  <div>
                    <code>SSO_CLIENT_SECRET</code>: {ssoConfig.hasClientSecret ? "Configured" : "Not configured"}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, the Sign-In page automatically displays a &ldquo;Sign in with {ssoConfig.providerName}&rdquo;
                  button backed by <code>GET /api/auth/sso?action=login</code>.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "ai-insights" && (
        <Card>
          <CardHeader>
            <CardTitle>Bring Your Own AI Provider (AI Insights)</CardTitle>
            <CardDescription>
              Connect OpenRouter, Google Gemini, Anthropic Claude, OpenAI, or any OpenAI-compatible gateway (Ollama, LiteLLM, vLLM) to power AI Insights on the Executive Dashboard, Shadow AI, and Assurance pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium block mb-1">AI Provider</label>
                <Select
                  disabled={!canEdit}
                  value={aiProvider}
                  onChange={(e) => {
                    const p = e.target.value as MaskedAiConfigProp["provider"];
                    setAiProvider(p);
                    const defaults: Record<MaskedAiConfigProp["provider"], string> = {
                      OPENAI: "gpt-4o-mini",
                      OPENROUTER: "openai/gpt-4o-mini",
                      GEMINI: "gemini-2.5-flash",
                      ANTHROPIC: "claude-3-5-sonnet-latest",
                      CUSTOM_OPENAI: "llama3.1",
                    };
                    setAiModel(defaults[p]);
                  }}
                >
                  <option value="OPENROUTER">OpenRouter (Multi-Model)</option>
                  <option value="GEMINI">Google Gemini</option>
                  <option value="ANTHROPIC">Anthropic Claude</option>
                  <option value="OPENAI">OpenAI</option>
                  <option value="CUSTOM_OPENAI">Custom OpenAI-Compatible (Ollama / vLLM / LiteLLM)</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Model Identifier</label>
                <Input
                  disabled={!canEdit}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="e.g. openai/gpt-4o-mini or gemini-2.5-flash"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">
                  API Key {aiHasKey && <span className="text-muted-foreground">(Saved: {aiMaskedKey})</span>}
                </label>
                <Input
                  disabled={!canEdit}
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={aiHasKey ? "Leave blank to keep existing key" : "Paste provider API key"}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">
                  Custom Base URL {aiProvider !== "CUSTOM_OPENAI" && <span className="text-muted-foreground">(Custom provider only)</span>}
                </label>
                <Input
                  disabled={!canEdit || aiProvider !== "CUSTOM_OPENAI"}
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Temperature (0.0 to 1.5)</label>
                <Input
                  disabled={!canEdit}
                  type="number"
                  step="0.1"
                  min={0}
                  max={1.5}
                  value={aiTemperature}
                  onChange={(e) => setAiTemperature(e.target.value)}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Enable AI Insights across Aegis</span>
                </label>
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    setStatusMsg(null);
                    setErrorMsg(null);
                    const res = await fetch("/api/ai/config", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "SAVE",
                        enabled: aiEnabled,
                        provider: aiProvider,
                        model: aiModel,
                        baseUrl: aiBaseUrl,
                        apiKey: aiApiKey,
                        temperature: Number(aiTemperature) || 0.2,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setAiHasKey(data.config.hasApiKey);
                      setAiMaskedKey(data.config.maskedKey);
                      setAiApiKey("");
                      setStatusMsg(`Saved AI Insights provider (${data.config.provider} / ${data.config.model}).`);
                    } else {
                      setErrorMsg(data.error || "Failed to save AI provider configuration.");
                    }
                  }}
                >
                  Save AI Provider
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={aiTesting}
                  onClick={async () => {
                    setAiTesting(true);
                    setStatusMsg(null);
                    setErrorMsg(null);
                    try {
                      const res = await fetch("/api/ai/config", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "TEST",
                          enabled: true,
                          provider: aiProvider,
                          model: aiModel,
                          baseUrl: aiBaseUrl,
                          apiKey: aiApiKey,
                          temperature: Number(aiTemperature) || 0.2,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setStatusMsg(`Connection verified (${data.provider} / ${data.model}): "${data.reply}"`);
                      } else {
                        setErrorMsg(data.error || "Connection test failed.");
                      }
                    } finally {
                      setAiTesting(false);
                    }
                  }}
                >
                  {aiTesting ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const CONFIG_TITLES: Record<string, string> = {
  RISK_APPETITE: "Risk Appetite Thresholds",
  FINANCIAL_DEFAULTS: "Financial & ROI Defaults",
  GOVERNANCE_CADENCE: "Governance Cadence & Trajectory",
};

function ConfigCard({
  cfg,
  canEdit,
  onSave,
}: {
  cfg: ConfigRow;
  canEdit: boolean;
  onSave: (cfg: ConfigRow, valueJson: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(cfg.valueJson);
  const [fallbackRaw, setFallbackRaw] = useState(JSON.stringify(cfg.valueJson, null, 2));
  const [fallbackErr, setFallbackErr] = useState<string | null>(null);

  function handleSave() {
    setFallbackErr(null);
    if (cfg.key === "RISK_APPETITE" || cfg.key === "FINANCIAL_DEFAULTS" || cfg.key === "GOVERNANCE_CADENCE") {
      onSave(cfg, values);
      return;
    }
    try {
      const parsed = JSON.parse(fallbackRaw);
      onSave(cfg, parsed);
    } catch {
      setFallbackErr("Invalid JSON syntax.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{CONFIG_TITLES[cfg.key] || cfg.key}</CardTitle>
          <CardDescription>{cfg.description}</CardDescription>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={handleSave}>
            Save
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {cfg.key === "RISK_APPETITE" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Appetite Threshold (1 to 25)</label>
              <Input
                type="number"
                min={1}
                max={25}
                disabled={!canEdit}
                value={Number(values.maxAcceptableResidualScore ?? 12)}
                onChange={(e) =>
                  setValues({ ...values, maxAcceptableResidualScore: Math.max(1, Math.min(25, Number(e.target.value))) })
                }
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Residual scores above this trigger breach alerts.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Critical Risk Threshold (1 to 25)</label>
              <Input
                type="number"
                min={1}
                max={25}
                disabled={!canEdit}
                value={Number(values.criticalThreshold ?? 16)}
                onChange={(e) =>
                  setValues({ ...values, criticalThreshold: Math.max(1, Math.min(25, Number(e.target.value))) })
                }
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Scores at or above this are flagged Critical.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Board Escalation Score (1 to 25)</label>
              <Input
                type="number"
                min={1}
                max={25}
                disabled={!canEdit}
                value={Number(values.escalateToBoardScore ?? 20)}
                onChange={(e) =>
                  setValues({ ...values, escalateToBoardScore: Math.max(1, Math.min(25, Number(e.target.value))) })
                }
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Scores at or above this escalate to the Board.
              </p>
            </div>
          </div>
        )}

        {cfg.key === "FINANCIAL_DEFAULTS" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Default Reporting Currency</label>
              <Select
                disabled={!canEdit}
                value={String(values.defaultCurrency ?? "SGD")}
                onChange={(e) =>
                  setValues({
                    ...values,
                    defaultCurrency: e.target.value,
                    supportedCurrencies: ["SGD", "USD"],
                  })
                }
              >
                <option value="SGD">SGD (Singapore Dollar, default)</option>
                <option value="USD">USD (US Dollar)</option>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Supported currencies: SGD and USD.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">USD to SGD Exchange Rate</label>
              <Input
                type="number"
                step="0.01"
                min={0.1}
                disabled={!canEdit}
                value={Number(values.usdToSgdRate ?? 1.34)}
                onChange={(e) => setValues({ ...values, usdToSgdRate: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                1 USD = {Number(values.usdToSgdRate ?? 1.34).toFixed(2)} SGD
              </p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Annual NPV Discount Rate (%)</label>
              <Input
                type="number"
                step="0.5"
                min={0}
                max={50}
                disabled={!canEdit}
                value={Number((Number(values.npvDiscountRate ?? 0.08) * 100).toFixed(2))}
                onChange={(e) =>
                  setValues({ ...values, npvDiscountRate: Number((Number(e.target.value) / 100).toFixed(4)) })
                }
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Used to discount quarterly cashflows in NPV calculations.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">NPV Horizon (Quarters)</label>
              <Input
                type="number"
                min={1}
                max={40}
                disabled={!canEdit}
                value={Number(values.npvHorizonQuarters ?? 12)}
                onChange={(e) => setValues({ ...values, npvHorizonQuarters: Math.max(1, Number(e.target.value)) })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {(Number(values.npvHorizonQuarters ?? 12) / 4).toFixed(1)} years evaluation window.
              </p>
            </div>
          </div>
        )}

        {cfg.key === "GOVERNANCE_CADENCE" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Maximum Role Review Age (Days)</label>
              <Input
                type="number"
                min={1}
                max={730}
                disabled={!canEdit}
                value={Number(values.roleReviewMaxAgeDays ?? 180)}
                onChange={(e) =>
                  setValues({ ...values, roleReviewMaxAgeDays: Math.max(1, Number(e.target.value)) })
                }
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Flags assets with lapsed FRAME role accountability reviews.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">AAEF Trajectory Delta Threshold</label>
              <Input
                type="number"
                step="0.05"
                min={0.05}
                max={2}
                disabled={!canEdit}
                value={Number(values.trajectoryDeltaThreshold ?? 0.25)}
                onChange={(e) => setValues({ ...values, trajectoryDeltaThreshold: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Minimum score change between appraisals to classify Improving or Degrading.
              </p>
            </div>
          </div>
        )}

        {cfg.key !== "RISK_APPETITE" && cfg.key !== "FINANCIAL_DEFAULTS" && cfg.key !== "GOVERNANCE_CADENCE" && (
          <div className="space-y-1">
            <Textarea
              disabled={!canEdit}
              className="font-mono text-xs min-h-[130px]"
              value={fallbackRaw}
              onChange={(e) => setFallbackRaw(e.target.value)}
            />
            {fallbackErr && <p className="text-xs text-red-600">{fallbackErr}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TRAJECTORY_OPTIONS = [
  { value: "IMPROVING", label: "Improving" },
  { value: "STABLE", label: "Stable" },
  { value: "DEGRADING", label: "Degrading" },
];

function ProfileRuleCard({
  profile,
  canEdit,
  onChange,
  onSave,
}: {
  profile: ProfileRow;
  canEdit: boolean;
  onChange: (p: ProfileRow) => void;
  onSave: (p: ProfileRow, ruleConfigJson: Record<string, unknown>) => void;
}) {
  const [rules, setRules] = useState<Record<string, unknown>>(profile.ruleConfigJson);

  const disallowed = Array.isArray(rules.disallowedTrajectories)
    ? (rules.disallowedTrajectories as string[])
    : [];

  function toggleDisallowedTrajectory(traj: string) {
    const next = disallowed.includes(traj)
      ? disallowed.filter((t) => t !== traj)
      : [...disallowed, traj];
    setRules({ ...rules, disallowedTrajectories: next });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>{profile.name}</CardTitle>
            {profile.isPlaceholder && <Badge variant="warning">Placeholder</Badge>}
          </div>
          <CardDescription>{profile.description}</CardDescription>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => onSave(profile, rules)}>
            Save Rule
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium block mb-1">Governance Consequence</label>
          <Input
            disabled={!canEdit}
            value={profile.governanceConsequence}
            onChange={(e) => onChange({ ...profile, governanceConsequence: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Required Action</label>
          <Input
            disabled={!canEdit}
            value={profile.requiredAction}
            onChange={(e) => onChange({ ...profile, requiredAction: e.target.value })}
          />
        </div>

        <div className="rounded-md border border-border bg-surface-muted/30 p-3 space-y-3">
          <div className="text-xs font-semibold text-foreground">Assignment Thresholds</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Minimum Average Score (0 to 4)</label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={4}
                disabled={!canEdit}
                value={Number(rules.minAvgScore ?? 0)}
                onChange={(e) =>
                  setRules({ ...rules, minAvgScore: Math.max(0, Math.min(4, Number(e.target.value))) })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Minimum Any-Dimension Score (0 to 4)</label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={4}
                disabled={!canEdit}
                value={Number(rules.minDimensionScore ?? 0)}
                onChange={(e) =>
                  setRules({ ...rules, minDimensionScore: Math.max(0, Math.min(4, Number(e.target.value))) })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Maximum Open Boundary Breaches</label>
              <Input
                type="number"
                min={0}
                max={999}
                disabled={!canEdit}
                value={Number(rules.maxOpenBreaches ?? 0)}
                onChange={(e) =>
                  setRules({ ...rules, maxOpenBreaches: Math.max(0, Number(e.target.value)) })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Boundary Adherence</label>
              <Select
                disabled={!canEdit}
                value={rules.requireBoundaryPassed ? "true" : "false"}
                onChange={(e) => setRules({ ...rules, requireBoundaryPassed: e.target.value === "true" })}
              >
                <option value="true">Must pass (no breach)</option>
                <option value="false">Allowed even if breached</option>
              </Select>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium block mb-1.5">Disallowed Improvement Trajectories</span>
            <div className="flex flex-wrap gap-3">
              {TRAJECTORY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={disallowed.includes(opt.value)}
                    onChange={() => toggleDisallowedTrajectory(opt.value)}
                    className="rounded border-border"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              An agent with a checked trajectory cannot be assigned this profile.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
