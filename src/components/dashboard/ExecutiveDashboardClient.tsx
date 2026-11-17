"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, ArrowUpRight, AlertTriangle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { calculateGenericRoi, FinancialConfig } from "@/lib/governance/roi-engine";
import { evaluateRiskPosture, RiskAppetiteThresholds } from "@/lib/governance/risk-scoring";
import { formatCurrency, formatDate, formatEnumLabel } from "@/lib/utils";
import { Currency, ValueConfidence } from "@prisma/client";

interface DashboardAsset {
  id: string;
  assetCode: string;
  name: string;
  country: string;
  lifecycleStage: string;
  autonomyLevel: string;
  sourcingType: string;
  vendorName: string | null;
  isAgent: boolean;
  businessUnit: { id: string; code: string; name: string };
  frameAssessments: Array<{ overallScore: number; assessedAt: string }>;
  aaefAppraisals: Array<{
    assignedProfile: { code: string; name: string } | null;
    overrideProfile: { code: string; name: string } | null;
  }>;
  risks: Array<{
    id: string;
    riskCode: string;
    title: string;
    inherentLikelihood: number;
    inherentImpact: number;
    residualLikelihood: number;
    residualImpact: number;
    financialExposure: number | null;
    reviewDate: string;
    status: string;
  }>;
  incidents: Array<{
    id: string;
    incidentCode: string;
    title: string;
    severity: string;
    isNearMiss: boolean;
    occurredAt: string;
    status: string;
  }>;
  costItems: Array<{ amount: number; currency: Currency; quarter: string }>;
  benefitItems: Array<{
    plannedAmount: number;
    actualAmount: number;
    currency: Currency;
    quarter: string;
    confidence: ValueConfidence;
  }>;
  actions: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: string;
    owner: { name: string };
  }>;
}

export function ExecutiveDashboardClient({
  assets,
  businessUnits,
  appetite,
  financialConfig,
}: {
  assets: DashboardAsset[];
  businessUnits: Array<{ id: string; code: string; name: string }>;
  appetite: RiskAppetiteThresholds;
  financialConfig: FinancialConfig;
}) {
  const [buFilter, setBuFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [autonomyFilter, setAutonomyFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");

  const countries = useMemo(
    () => Array.from(new Set(assets.map((a) => a.country))).sort(),
    [assets]
  );
  const vendors = useMemo(
    () =>
      Array.from(
        new Set(assets.map((a) => a.vendorName).filter((v): v is string => Boolean(v)))
      ).sort(),
    [assets]
  );

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (buFilter && a.businessUnit.id !== buFilter) return false;
      if (countryFilter && a.country !== countryFilter) return false;
      if (lifecycleFilter && a.lifecycleStage !== lifecycleFilter) return false;
      if (autonomyFilter && a.autonomyLevel !== autonomyFilter) return false;
      if (vendorFilter && a.vendorName !== vendorFilter) return false;
      return true;
    });
  }, [assets, buFilter, countryFilter, lifecycleFilter, autonomyFilter, vendorFilter]);

  const lifecycleData = useMemo(() => {
    const counts: Record<string, number> = { IDEA: 0, PILOT: 0, PRODUCTION: 0, RETIRED: 0 };
    filteredAssets.forEach((a) => {
      counts[a.lifecycleStage] = (counts[a.lifecycleStage] ?? 0) + 1;
    });
    return [
      { stage: "Idea", count: counts.IDEA },
      { stage: "Pilot", count: counts.PILOT },
      { stage: "Production", count: counts.PRODUCTION },
      { stage: "Retired", count: counts.RETIRED },
    ];
  }, [filteredAssets]);

  const autonomyData = useMemo(() => {
    const counts: Record<string, number> = {
      ASSISTIVE: 0,
      HUMAN_IN_THE_LOOP: 0,
      HUMAN_ON_THE_LOOP: 0,
      AUTONOMOUS: 0,
    };
    filteredAssets.forEach((a) => {
      counts[a.autonomyLevel] = (counts[a.autonomyLevel] ?? 0) + 1;
    });
    return [
      { level: "Assistive", count: counts.ASSISTIVE },
      { level: "Human-in-Loop", count: counts.HUMAN_IN_THE_LOOP },
      { level: "Human-on-Loop", count: counts.HUMAN_ON_THE_LOOP },
      { level: "Autonomous", count: counts.AUTONOMOUS },
    ];
  }, [filteredAssets]);

  const avgFrameMaturity = useMemo(() => {
    const scored = filteredAssets.filter((a) => a.frameAssessments[0]);
    if (scored.length === 0) return 0;
    const sum = scored.reduce((s, a) => s + a.frameAssessments[0].overallScore, 0);
    return Number((sum / scored.length).toFixed(2));
  }, [filteredAssets]);

  const aaefData = useMemo(() => {
    const counts: Record<string, number> = {
      OPERATIONAL: 0,
      DEVELOPING: 0,
      RESTRICTED: 0,
      UNDER_REVIEW: 0,
    };
    filteredAssets.forEach((a) => {
      if (!a.isAgent || !a.aaefAppraisals[0]) return;
      const prof = a.aaefAppraisals[0].overrideProfile || a.aaefAppraisals[0].assignedProfile;
      if (prof) counts[prof.code] = (counts[prof.code] ?? 0) + 1;
    });
    return [
      { profile: "Operational", count: counts.OPERATIONAL, color: "#009E73" },
      { profile: "Developing", count: counts.DEVELOPING, color: "#0072B2" },
      { profile: "Restricted", count: counts.RESTRICTED, color: "#E69F00" },
      { profile: "Under Review", count: counts.UNDER_REVIEW, color: "#D55E00" },
    ];
  }, [filteredAssets]);

  const allRisks = useMemo(
    () =>
      filteredAssets.flatMap((a) =>
        a.risks.map((r) => ({
          ...r,
          assetId: a.id,
          assetCode: a.assetCode,
          assetName: a.name,
          posture: evaluateRiskPosture(r, appetite),
        }))
      ),
    [filteredAssets, appetite]
  );

  const breachedRisks = useMemo(
    () => allRisks.filter((r) => r.posture.appetiteBreached),
    [allRisks]
  );

  const portfolioRoi = useMemo(() => {
    const costs = filteredAssets.flatMap((a) => a.costItems);
    const benefits = filteredAssets.flatMap((a) => a.benefitItems);
    return calculateGenericRoi(costs, benefits, allRisks, "SGD", financialConfig);
  }, [filteredAssets, allRisks, financialConfig]);

  const overdueActions = useMemo(
    () =>
      filteredAssets
        .flatMap((a) =>
          a.actions.map((act) => ({ ...act, assetCode: a.assetCode, assetId: a.id }))
        )
        .filter((act) => act.status !== "DONE" && new Date(act.dueDate).getTime() < Date.now()),
    [filteredAssets]
  );

  const recentIncidents = useMemo(
    () =>
      filteredAssets
        .flatMap((a) =>
          a.incidents.map((inc) => ({ ...inc, assetCode: a.assetCode, assetId: a.id }))
        )
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 6),
    [filteredAssets]
  );

  const pdfExportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (buFilter) params.set("businessUnitId", buFilter);
    if (countryFilter) params.set("country", countryFilter);
    if (lifecycleFilter) params.set("lifecycleStage", lifecycleFilter);
    if (autonomyFilter) params.set("autonomyLevel", autonomyFilter);
    if (vendorFilter) params.set("vendorName", vendorFilter);
    const qs = params.toString();
    return `/api/board-pack/pdf${qs ? `?${qs}` : ""}`;
  }, [buFilter, countryFilter, lifecycleFilter, autonomyFilter, vendorFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Executive &amp; Board Command Centre</h1>
          <p className="text-sm text-muted-foreground">
            Evidence-based portfolio view across FRAME governance maturity, AAEF agent appraisals, risk appetite, and
            realised value.
          </p>
        </div>

        <a href={pdfExportUrl}>
          <Button type="button" size="sm">
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Export Board Pack (A4 PDF)
          </Button>
        </a>
      </div>

      {/* Global Portfolio Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <Select value={buFilter} onChange={(e) => setBuFilter(e.target.value)} aria-label="Filter by business unit">
              <option value="">All Business Units</option>
              {businessUnits.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} aria-label="Filter by country">
              <option value="">All Countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              aria-label="Filter by lifecycle stage"
            >
              <option value="">All Lifecycle Stages</option>
              <option value="IDEA">Idea</option>
              <option value="PILOT">Pilot</option>
              <option value="PRODUCTION">Production</option>
              <option value="RETIRED">Retired</option>
            </Select>
            <Select
              value={autonomyFilter}
              onChange={(e) => setAutonomyFilter(e.target.value)}
              aria-label="Filter by autonomy level"
            >
              <option value="">All Autonomy Levels</option>
              <option value="ASSISTIVE">Assistive</option>
              <option value="HUMAN_IN_THE_LOOP">Human in the Loop</option>
              <option value="HUMAN_ON_THE_LOOP">Human on the Loop</option>
              <option value="AUTONOMOUS">Autonomous</option>
            </Select>
            <Select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} aria-label="Filter by vendor">
              <option value="">All Vendors &amp; In-House</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Top Drill-Down KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Link href="/assets" className="block group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardContent className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>AI Assets</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <div className="text-2xl font-semibold tabular-nums">{filteredAssets.length}</div>
              <div className="text-[11px] text-muted-foreground">
                {filteredAssets.filter((a) => a.isAgent).length} AI Agents
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/frame" className="block group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardContent className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Avg FRAME Maturity</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <div className="text-2xl font-semibold tabular-nums">{avgFrameMaturity.toFixed(2)} / 4.0</div>
              <div className="text-[11px] text-muted-foreground">5-Dimension Envelope</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/aaef" className="block group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardContent className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>AAEF Agent Status</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {aaefData.find((d) => d.profile === "Operational")?.count ?? 0} Op
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400">
                {(aaefData.find((d) => d.profile === "Restricted")?.count ?? 0) +
                  (aaefData.find((d) => d.profile === "Under Review")?.count ?? 0)}{" "}
                Restricted / Review
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/risks" className="block group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardContent className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Risks vs Appetite</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <div className="text-2xl font-semibold tabular-nums text-red-600">
                {breachedRisks.length} Breached
              </div>
              <div className="text-[11px] text-muted-foreground">
                of {allRisks.length} total risks (&gt;{appetite.maxAcceptableResidualScore})
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/roi" className="block group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardContent className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Portfolio ROI (SGD)</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <div className="text-2xl font-semibold tabular-nums">{portfolioRoi.roiPercent}%</div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Measured: {formatCurrency(portfolioRoi.measuredBenefit, "SGD")}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/evidence" className="block group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardContent className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Overdue Actions</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
              </div>
              <div className="text-2xl font-semibold tabular-nums text-amber-600">
                {overdueActions.length}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {recentIncidents.length} recent incident(s)
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts Row: Lifecycle, Autonomy, and AAEF Profile Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Assets by Lifecycle Stage</CardTitle>
            <CardDescription>Drill down via AI Asset Register</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lifecycleData} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: "12px" }} />
                <Bar dataKey="count" name="Assets" fill="#0072B2" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="count" position="top" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets by Autonomy Level</CardTitle>
            <CardDescription>Decision-rights distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={autonomyData} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: "12px" }} />
                <Bar dataKey="count" name="Assets" fill="#56B4E9" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="count" position="top" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AAEF Agent Profile Distribution</CardTitle>
            <CardDescription>Colour-blind-safe Okabe-Ito palette with labels</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aaefData} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis dataKey="profile" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: "12px" }} />
                <Bar dataKey="count" name="Agents" radius={[3, 3, 0, 0]}>
                  {aaefData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                  <LabelList dataKey="count" position="top" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down tables: Top Risks, ROI Value Split, Overdue Actions & Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Top Risks Versus Appetite</CardTitle>
              <CardDescription>Threshold: {appetite.maxAcceptableResidualScore}</CardDescription>
            </div>
            <Link href="/risks" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {[...allRisks]
              .sort((a, b) => b.posture.residualScore - a.posture.residualScore)
              .slice(0, 5)
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-border last:border-0 pb-2">
                  <div className="min-w-0 pr-2">
                    <Link href={`/assets/${r.assetId}`} className="font-mono text-primary hover:underline mr-1.5">
                      {r.riskCode}
                    </Link>
                    <span className="font-medium">{r.title}</span>
                    <div className="text-[11px] text-muted-foreground">{r.assetCode} · {r.assetName}</div>
                  </div>
                  <Badge variant={r.posture.appetiteBreached ? "danger" : "outline"}>
                    {r.posture.residualScore}
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Portfolio Value &amp; Risk Adjustment</CardTitle>
              <CardDescription>Measured vs Assumed Value (SGD)</CardDescription>
            </div>
            <Link href="/roi" className="text-xs text-primary hover:underline">
              Drill down
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">Total Cost of Ownership (TCO)</span>
              <span className="font-semibold tabular-nums">{formatCurrency(portfolioRoi.totalCost, "SGD")}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="flex items-center gap-1.5">
                <Badge variant="success">Measured</Badge>
                <span>Verified Benefit</span>
              </span>
              <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatCurrency(portfolioRoi.measuredBenefit, "SGD")}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="flex items-center gap-1.5">
                <Badge variant="warning">Assumed / Est</Badge>
                <span>Projected Benefit</span>
              </span>
              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {formatCurrency(portfolioRoi.estimatedBenefit + portfolioRoi.assumedBenefit, "SGD")}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-red-700 dark:text-red-400">Value-at-Risk (Residual Risk)</span>
              <span className="font-semibold tabular-nums text-red-700 dark:text-red-400">
                -{formatCurrency(portfolioRoi.valueAtRisk, "SGD")}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold">Risk-Adjusted Net Benefit (ROI)</span>
              <span className="font-bold tabular-nums">
                {formatCurrency(portfolioRoi.riskAdjustedNetBenefit, "SGD")} ({portfolioRoi.riskAdjustedRoiPercent}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Overdue Actions &amp; Recent Incidents</CardTitle>
              <CardDescription>Items requiring immediate oversight</CardDescription>
            </div>
            <Link href="/evidence" className="text-xs text-primary hover:underline">
              Action Tracker
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {overdueActions.map((act) => (
              <div key={act.id} className="rounded border border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/40 p-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden="true" />
                    {act.title}
                  </span>
                  <Badge variant="danger">Due {formatDate(act.dueDate)}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Owner: {act.owner.name} · Asset: {act.assetCode}
                </div>
              </div>
            ))}
            {recentIncidents.slice(0, 3).map((inc) => (
              <div key={inc.id} className="flex items-center justify-between border-b border-border last:border-0 pb-1.5">
                <div className="truncate pr-2">
                  <Link href={`/assets/${inc.assetId}`} className="font-mono text-primary hover:underline mr-1">
                    {inc.incidentCode}
                  </Link>
                  <span>{inc.title}</span>
                </div>
                <Badge variant={inc.severity === "HIGH" || inc.severity === "CRITICAL" ? "danger" : "warning"}>
                  {formatEnumLabel(inc.severity)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
