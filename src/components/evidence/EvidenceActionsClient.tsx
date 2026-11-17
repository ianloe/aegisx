"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileUp, Link2, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatDate, formatEnumLabel } from "@/lib/utils";

interface ActionRow {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  sourceType: string;
  asset: { id: string; assetCode: string; name: string } | null;
  owner: { id: string; name: string };
}

interface EvidenceRow {
  id: string;
  title: string;
  type: "LINK" | "FILE";
  url: string | null;
  originalFilename: string | null;
  entityType: string;
  entityId: string;
  createdAt: string;
  uploadedBy: { name: string };
}

interface OptionItem {
  id: string;
  name: string;
  assetCode?: string;
}

export function EvidenceActionsClient({
  actions,
  evidenceItems,
  assets,
  users,
  canWriteActions,
  canWriteEvidence,
}: {
  actions: ActionRow[];
  evidenceItems: EvidenceRow[];
  assets: OptionItem[];
  users: OptionItem[];
  canWriteActions: boolean;
  canWriteEvidence: boolean;
}) {
  const router = useRouter();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Action form
  const [actTitle, setActTitle] = useState("");
  const [actDesc, setActDesc] = useState("");
  const [actAssetId, setActAssetId] = useState(assets[0]?.id || "");
  const [actOwnerId, setActOwnerId] = useState(users[0]?.id || "");
  const [actDueDate, setActDueDate] = useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );

  // Evidence form
  const [evMode, setEvMode] = useState<"LINK" | "FILE">("LINK");
  const [evTitle, setEvTitle] = useState("");
  const [evUrl, setEvUrl] = useState("");
  const [evAssetId, setEvAssetId] = useState(assets[0]?.id || "");
  const [evFile, setEvFile] = useState<File | null>(null);

  async function handleCreateAction(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: actTitle,
        description: actDesc,
        assetId: actAssetId || null,
        ownerId: actOwnerId,
        dueDate: actDueDate,
        sourceType: "MANUAL",
      }),
    });
    if (res.ok) {
      setStatusMsg("Created governance action.");
      setActTitle("");
      setActDesc("");
      router.refresh();
    } else {
      setErrorMsg("Failed to create action.");
    }
  }

  async function handleUpdateActionStatus(id: string, status: ActionRow["status"]) {
    const res = await fetch("/api/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setStatusMsg("Updated action status.");
      router.refresh();
    }
  }

  async function handleAddEvidence(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);

    if (evMode === "FILE") {
      if (!evFile) {
        setErrorMsg("Please select a file to upload.");
        return;
      }
      const fd = new FormData();
      fd.append("title", evTitle);
      fd.append("entityType", "ASSET");
      fd.append("entityId", evAssetId);
      fd.append("file", evFile);

      const res = await fetch("/api/evidence", { method: "POST", body: fd });
      if (!res.ok) {
        setErrorMsg("File upload failed.");
        return;
      }
    } else {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: evTitle,
          url: evUrl,
          entityType: "ASSET",
          entityId: evAssetId,
        }),
      });
      if (!res.ok) {
        setErrorMsg("Failed to attach evidence link.");
        return;
      }
    }

    setStatusMsg("Stored evidence item in repository.");
    setEvTitle("");
    setEvUrl("");
    setEvFile(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Evidence Store &amp; Governance Action Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Traceable repository of uploaded files, verification links, and remediations generated from assessments,
          appraisals, risks, and incidents.
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Tracker */}
        <div className="space-y-4">
          {canWriteActions && (
            <Card>
              <CardHeader>
                <CardTitle>Create Governance Action</CardTitle>
                <CardDescription>Assign remediation to an owner with a target due date</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateAction} className="space-y-3">
                  <Input
                    required
                    placeholder="Action title..."
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                  />
                  <Input
                    placeholder="Action description / acceptance criteria..."
                    value={actDesc}
                    onChange={(e) => setActDesc(e.target.value)}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Select value={actAssetId} onChange={(e) => setActAssetId(e.target.value)}>
                      <option value="">Portfolio-wide</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.assetCode} · {a.name}
                        </option>
                      ))}
                    </Select>
                    <Select value={actOwnerId} onChange={(e) => setActOwnerId(e.target.value)}>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="date"
                      required
                      value={actDueDate}
                      onChange={(e) => setActDueDate(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add Action
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Action Tracker ({actions.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              {actions.map((act) => {
                const isOverdue =
                  act.status !== "DONE" && new Date(act.dueDate).getTime() < Date.now();
                return (
                  <div key={act.id} className="rounded border border-border p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{act.title}</div>
                        {act.description && <p className="text-muted-foreground">{act.description}</p>}
                      </div>
                      <Badge
                        variant={
                          act.status === "DONE"
                            ? "success"
                            : isOverdue
                            ? "danger"
                            : act.status === "IN_PROGRESS"
                            ? "info"
                            : "warning"
                        }
                      >
                        {isOverdue ? "Overdue" : formatEnumLabel(act.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
                      <span>
                        Owner: <strong>{act.owner.name}</strong> · Due: <strong>{formatDate(act.dueDate)}</strong>
                        {act.asset && ` · ${act.asset.assetCode}`}
                      </span>
                      {canWriteActions && act.status !== "DONE" && (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateActionStatus(act.id, "IN_PROGRESS")}
                          >
                            In Progress
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => handleUpdateActionStatus(act.id, "DONE")}
                          >
                            Complete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Evidence Store */}
        <div className="space-y-4">
          {canWriteEvidence && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Attach Evidence</CardTitle>
                  <CardDescription>Store file in persistent volume or attach reference link</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={evMode === "LINK" ? "primary" : "outline"}
                    onClick={() => setEvMode("LINK")}
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={evMode === "FILE" ? "primary" : "outline"}
                    onClick={() => setEvMode("FILE")}
                  >
                    <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                    File
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddEvidence} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      required
                      placeholder="Evidence title..."
                      value={evTitle}
                      onChange={(e) => setEvTitle(e.target.value)}
                    />
                    <Select value={evAssetId} onChange={(e) => setEvAssetId(e.target.value)}>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.assetCode} · {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {evMode === "LINK" ? (
                    <Input
                      type="url"
                      required
                      placeholder="https://..."
                      value={evUrl}
                      onChange={(e) => setEvUrl(e.target.value)}
                    />
                  ) : (
                    <Input
                      type="file"
                      required
                      onChange={(e) => setEvFile(e.target.files?.[0] || null)}
                    />
                  )}
                  <Button type="submit" size="sm">
                    Save Evidence
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Evidence Repository ({evidenceItems.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {evidenceItems.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between rounded border border-border p-3"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {ev.type} · Uploaded by {ev.uploadedBy.name} on {formatDate(ev.createdAt)}
                    </div>
                  </div>
                  {ev.type === "LINK" && ev.url ? (
                    <a href={ev.url} target="_blank" rel="noreferrer">
                      <Button type="button" size="sm" variant="outline">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open
                      </Button>
                    </a>
                  ) : (
                    <a href={`/api/evidence/${ev.id}/download`}>
                      <Button type="button" size="sm" variant="outline">
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Download
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
