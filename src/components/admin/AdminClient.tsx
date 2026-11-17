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
  canEdit,
}: {
  initialConfigs: ConfigRow[];
  initialCriteria: CriterionRow[];
  initialProfiles: ProfileRow[];
  initialUsers: UserRow[];
  roles: RoleRow[];
  businessUnits: BusinessUnitRow[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"params" | "frame" | "aaef" | "users">("params");
  const [configs, setConfigs] = useState(initialConfigs);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [users, setUsers] = useState(initialUsers);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New user state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoleId, setNewRoleId] = useState(roles[0]?.id || "");
  const [newBuId, setNewBuId] = useState("");

  async function saveGovernanceConfig(cfg: ConfigRow, rawJson: string) {
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const parsed = JSON.parse(rawJson);
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GOVERNANCE_CONFIG", key: cfg.key, valueJson: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save configuration.");
      setConfigs((prev) => prev.map((c) => (c.key === cfg.key ? { ...c, valueJson: parsed } : c)));
      setStatusMsg(`Saved ${cfg.key} configuration.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid JSON.");
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

  async function saveProfile(p: ProfileRow, rawRules: string) {
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const parsedRules = JSON.parse(rawRules);
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PERFORMANCE_PROFILE",
          id: p.id,
          governanceConsequence: p.governanceConsequence,
          requiredAction: p.requiredAction,
          ruleConfigJson: parsedRules,
          isPlaceholder: p.isPlaceholder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile.");
      setProfiles((prev) => prev.map((row) => (row.id === p.id ? { ...p, ruleConfigJson: parsedRules } : row)));
      setStatusMsg(`Saved AAEF profile rule for ${p.name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid JSON.");
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
          { id: "frame", label: "FRAME Criteria & Rubrics" },
          { id: "aaef", label: "AAEF Profile Rules" },
          { id: "users", label: "Users & Roles" },
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
                      {businessUnits.map((b) => (
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
                            {businessUnits.map((b) => (
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
    </div>
  );
}

function ConfigCard({
  cfg,
  canEdit,
  onSave,
}: {
  cfg: ConfigRow;
  canEdit: boolean;
  onSave: (cfg: ConfigRow, rawJson: string) => void;
}) {
  const [raw, setRaw] = useState(JSON.stringify(cfg.valueJson, null, 2));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{cfg.key}</CardTitle>
          <CardDescription>{cfg.description}</CardDescription>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => onSave(cfg, raw)}>
            Save
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Textarea
          disabled={!canEdit}
          className="font-mono text-xs min-h-[130px]"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </CardContent>
    </Card>
  );
}

function ProfileRuleCard({
  profile,
  canEdit,
  onChange,
  onSave,
}: {
  profile: ProfileRow;
  canEdit: boolean;
  onChange: (p: ProfileRow) => void;
  onSave: (p: ProfileRow, rawRules: string) => void;
}) {
  const [rawRules, setRawRules] = useState(JSON.stringify(profile.ruleConfigJson, null, 2));
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
          <Button type="button" size="sm" onClick={() => onSave(profile, rawRules)}>
            Save Rule
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div>
          <label className="text-xs font-medium block mb-1">Rule Configuration (JSON)</label>
          <Textarea
            disabled={!canEdit}
            className="font-mono text-xs min-h-[120px]"
            value={rawRules}
            onChange={(e) => setRawRules(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
