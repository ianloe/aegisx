"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Download } from "lucide-react";

export interface ComplianceControlRow {
  id: string;
  code: string;
  title: string;
  ownerName: string;
  effectiveness: string;
  lastTestedAt: string | null;
  evidenceCount: number;
}

export interface ComplianceRequirementRow {
  id: string;
  code: string;
  title: string;
  description: string;
  status: "COVERED" | "PARTIAL_OR_UNTESTED" | "GAP_INEFFECTIVE" | "GAP_UNMAPPED";
  controls: ComplianceControlRow[];
}

export interface ComplianceFrameworkSummary {
  id: string;
  code: string;
  name: string;
  version: string | null;
  jurisdiction: string | null;
  totalRequirements: number;
  mappedRequirements: number;
  effectiveRequirements: number;
  coveragePct: number;
  effectivePct: number;
  requirements: ComplianceRequirementRow[];
}

const STATUS_BADGE: Record<ComplianceRequirementRow["status"], { label: string; variant: "success" | "warning" | "danger" }> = {
  COVERED: { label: "Covered & Effective", variant: "success" },
  PARTIAL_OR_UNTESTED: { label: "Mapped (Untested / Partial)", variant: "warning" },
  GAP_INEFFECTIVE: { label: "Gap: Ineffective Control", variant: "danger" },
  GAP_UNMAPPED: { label: "Gap: Unmapped", variant: "danger" },
};

export function ComplianceClient({ frameworks }: { frameworks: ComplianceFrameworkSummary[] }) {
  const [selectedCode, setSelectedCode] = useState<string>(frameworks[0]?.code || "ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const activeFrameworks = useMemo(
    () => (selectedCode === "ALL" ? frameworks : frameworks.filter((f) => f.code === selectedCode)),
    [frameworks, selectedCode],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {frameworks.map((fw) => (
          <button
            key={fw.id}
            type="button"
            onClick={() => setSelectedCode(fw.code)}
            className={`text-left rounded-lg border p-4 transition-colors ${
              selectedCode === fw.code
                ? "border-primary bg-primary/5"
                : "border-border bg-surface hover:bg-surface-muted/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{fw.name}</span>
              <Badge variant="outline">{fw.jurisdiction || "Global"}</Badge>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold">{fw.coveragePct}%</span>
              <span className="text-[11px] text-muted-foreground">
                {fw.mappedRequirements}/{fw.totalRequirements} mapped · {fw.effectivePct}% effective
              </span>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Framework Crosswalk &amp; Gap Analysis</CardTitle>
            <CardDescription>
              Trace regulatory requirements to Aegis controls, effectiveness test results, and attached evidence.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by framework"
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="w-52"
            >
              <option value="ALL">All Frameworks</option>
              {frameworks.map((fw) => (
                <option key={fw.id} value={fw.code}>
                  {fw.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by posture status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48"
            >
              <option value="ALL">All Statuses</option>
              <option value="GAP_UNMAPPED">Gaps: Unmapped Only</option>
              <option value="GAP_INEFFECTIVE">Gaps: Ineffective Only</option>
              <option value="PARTIAL_OR_UNTESTED">Untested / Partial</option>
              <option value="COVERED">Covered &amp; Effective</option>
            </Select>
            <a
              href={`/api/compliance?format=csv${selectedCode !== "ALL" ? `&framework=${encodeURIComponent(selectedCode)}` : ""}`}
            >
              <Button type="button" size="sm" variant="outline">
                <Download className="h-3.5 w-3.5" />
                <span>Export Evidence Pack (CSV)</span>
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeFrameworks.map((fw) => {
            const filteredReqs = fw.requirements.filter(
              (r) => statusFilter === "ALL" || r.status === statusFilter,
            );
            return (
              <div key={fw.id} className="space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {fw.name} {fw.version ? `(${fw.version})` : ""}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {fw.mappedRequirements} of {fw.totalRequirements} requirements mapped ({fw.coveragePct}%),{" "}
                      {fw.effectiveRequirements} verified effective ({fw.effectivePct}%).
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                        <th className="py-2 px-3 font-medium">Req Code</th>
                        <th className="py-2 px-3 font-medium">Requirement</th>
                        <th className="py-2 px-3 font-medium">Posture</th>
                        <th className="py-2 px-3 font-medium">Mapped Controls &amp; Effectiveness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReqs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">
                            No requirements match this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredReqs.map((req) => {
                          const badge = STATUS_BADGE[req.status];
                          return (
                            <tr key={req.id} className="border-b border-border last:border-0 align-top">
                              <td className="py-2.5 px-3 font-mono font-medium whitespace-nowrap">{req.code}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium">{req.title}</div>
                                <div className="text-[11px] text-muted-foreground">{req.description}</div>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <Badge variant={badge.variant}>{badge.label}</Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                {req.controls.length === 0 ? (
                                  <span className="text-red-600 font-medium">No control mapped</span>
                                ) : (
                                  <div className="space-y-1">
                                    {req.controls.map((c) => (
                                      <div key={c.id} className="flex flex-wrap items-center gap-1.5">
                                        <Badge variant="outline">{c.code}</Badge>
                                        <span>{c.title}</span>
                                        <Badge
                                          variant={
                                            c.effectiveness === "EFFECTIVE"
                                              ? "success"
                                              : c.effectiveness === "INEFFECTIVE"
                                                ? "danger"
                                                : "warning"
                                          }
                                        >
                                          {c.effectiveness}
                                        </Badge>
                                        <span className="text-[11px] text-muted-foreground">
                                          ({c.evidenceCount} evidence)
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
