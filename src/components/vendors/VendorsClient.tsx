"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatEnumLabel } from "@/lib/utils";

export interface VendorAssetItem {
  id: string;
  assetCode: string;
  name: string;
  sourcingType: string;
  vendorName: string | null;
  country: string;
  dataSensitivity: string;
  businessUnit: { name: string };
  vendorAssessment: {
    id: string;
    vendorName: string;
    modelName: string | null;
    modelCardUrl: string | null;
    dataResidency: string;
    zeroDataRetention: boolean;
    subProcessors: string | null;
    contractRenewalDate: string | null;
    exitPlanSummary: string | null;
    status: "PENDING" | "APPROVED" | "CONDITIONAL" | "REJECTED";
    notes: string | null;
    lastReviewedAt: string | null;
    reviewer: { name: string } | null;
  } | null;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "secondary"> = {
  APPROVED: "success",
  CONDITIONAL: "warning",
  REJECTED: "danger",
  PENDING: "secondary",
};

export function VendorsClient({
  initialAssets,
  canEdit,
}: {
  initialAssets: VendorAssetItem[];
  canEdit: boolean;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [editingAsset, setEditingAsset] = useState<VendorAssetItem | null>(null);
  const [form, setForm] = useState({
    vendorName: "",
    modelName: "",
    modelCardUrl: "",
    dataResidency: "Singapore",
    zeroDataRetention: false,
    subProcessors: "",
    contractRenewalDate: "",
    exitPlanSummary: "",
    status: "PENDING",
    notes: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function openEditor(asset: VendorAssetItem) {
    const va = asset.vendorAssessment;
    setEditingAsset(asset);
    setForm({
      vendorName: va?.vendorName || asset.vendorName || "",
      modelName: va?.modelName || "",
      modelCardUrl: va?.modelCardUrl || "",
      dataResidency: va?.dataResidency || asset.country,
      zeroDataRetention: va?.zeroDataRetention ?? false,
      subProcessors: va?.subProcessors || "",
      contractRenewalDate: va?.contractRenewalDate ? va.contractRenewalDate.slice(0, 10) : "",
      exitPlanSummary: va?.exitPlanSummary || "",
      status: va?.status || "PENDING",
      notes: va?.notes || "",
    });
  }

  async function saveAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAsset) return;
    setMsg(null);
    setErr(null);

    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: editingAsset.id,
        ...form,
        contractRenewalDate: form.contractRenewalDate || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Failed to save vendor due diligence.");
      return;
    }

    setAssets((prev) =>
      prev.map((a) => (a.id === editingAsset.id ? { ...a, vendorAssessment: data.assessment } : a)),
    );
    setMsg(`Saved vendor due diligence for ${editingAsset.assetCode}.`);
    setEditingAsset(null);
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
          {err}
        </div>
      )}

      {editingAsset && (
        <Card>
          <CardHeader>
            <CardTitle>
              Due Diligence: {editingAsset.assetCode} ({editingAsset.name})
            </CardTitle>
            <CardDescription>
              Record third-party model card, data residency, zero-data-retention guarantees, and exit readiness.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveAssessment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Vendor Name</label>
                  <Input
                    required
                    value={form.vendorName}
                    onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Model / Product Name</label>
                  <Input
                    value={form.modelName}
                    onChange={(e) => setForm({ ...form, modelName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Data Residency</label>
                  <Input
                    required
                    value={form.dataResidency}
                    onChange={(e) => setForm({ ...form, dataResidency: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Model Card / Docs URL</label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={form.modelCardUrl}
                    onChange={(e) => setForm({ ...form, modelCardUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Contract Renewal Date</label>
                  <Input
                    type="date"
                    value={form.contractRenewalDate}
                    onChange={(e) => setForm({ ...form, contractRenewalDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Due Diligence Status</label>
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="CONDITIONAL">Conditional</option>
                    <option value="REJECTED">Rejected</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Sub-Processors</label>
                  <Input
                    value={form.subProcessors}
                    onChange={(e) => setForm({ ...form, subProcessors: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    id="zdr-checkbox"
                    type="checkbox"
                    checked={form.zeroDataRetention}
                    onChange={(e) => setForm({ ...form, zeroDataRetention: e.target.checked })}
                    className="rounded border-border"
                  />
                  <label htmlFor="zdr-checkbox" className="text-xs font-medium">
                    Contractual Zero Data Retention (no training on enterprise prompts/data)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Exit &amp; Portability Plan</label>
                  <Textarea
                    className="min-h-[70px]"
                    value={form.exitPlanSummary}
                    onChange={(e) => setForm({ ...form, exitPlanSummary: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Reviewer Notes &amp; Conditions</label>
                  <Textarea
                    className="min-h-[70px]"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Save Due Diligence</Button>
                <Button type="button" variant="outline" onClick={() => setEditingAsset(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Third-Party &amp; Hybrid AI Assets ({assets.length})</CardTitle>
          <CardDescription>
            Tracks vendor model governance, data residency, zero-data-retention guarantees, and contract renewal dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">Asset</th>
                <th className="py-2.5 px-4 font-medium">Vendor / Model</th>
                <th className="py-2.5 px-4 font-medium">Residency</th>
                <th className="py-2.5 px-4 font-medium">Zero Data Retention</th>
                <th className="py-2.5 px-4 font-medium">Renewal</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                {canEdit && <th className="py-2.5 px-4 font-medium">Action</th>}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const va = a.vendorAssessment;
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-4">
                      <Link href={`/assets/${a.id}`} className="font-medium hover:underline">
                        {a.assetCode}: {a.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {a.businessUnit.name} · {formatEnumLabel(a.sourcingType)} · {formatEnumLabel(a.dataSensitivity)}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium">{va?.vendorName || a.vendorName || "Unspecified"}</div>
                      {va?.modelName && <div className="text-[11px] text-muted-foreground">{va.modelName}</div>}
                    </td>
                    <td className="py-2.5 px-4">{va?.dataResidency || "Not recorded"}</td>
                    <td className="py-2.5 px-4">
                      <Badge variant={va?.zeroDataRetention ? "success" : "warning"}>
                        {va?.zeroDataRetention ? "Verified" : "Unverified / No"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {va?.contractRenewalDate ? new Date(va.contractRenewalDate).toLocaleDateString() : "Not set"}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant={STATUS_VARIANT[va?.status || "PENDING"]}>
                        {formatEnumLabel(va?.status || "PENDING")}
                      </Badge>
                    </td>
                    {canEdit && (
                      <td className="py-2.5 px-4">
                        <Button type="button" size="sm" variant="outline" onClick={() => openEditor(a)}>
                          {va ? "Edit" : "Assess"}
                        </Button>
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
  );
}
