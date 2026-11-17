"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert, TrendingUp } from "lucide-react";
import { Currency, ValueConfidence } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { RoiChart } from "@/components/roi/RoiChart";
import { calculateGenericRoi, FinancialConfig } from "@/lib/governance/roi-engine";
import { formatCurrency, formatEnumLabel } from "@/lib/utils";

interface CostItemRow {
  id: string;
  assetId: string;
  category: string;
  description: string;
  amount: number;
  currency: Currency;
  quarter: string;
  isRecurring: boolean;
}

interface BenefitItemRow {
  id: string;
  assetId: string;
  category: string;
  description: string;
  plannedAmount: number;
  actualAmount: number;
  currency: Currency;
  quarter: string;
  confidence: ValueConfidence;
  methodologyNote: string | null;
}

interface RiskExposureRow {
  id: string;
  riskCode: string;
  title: string;
  residualLikelihood: number;
  residualImpact: number;
  financialExposure: number | null;
  status: string;
}

interface AssetRoiData {
  id: string;
  assetCode: string;
  name: string;
  businessUnit: { name: string };
  costItems: CostItemRow[];
  benefitItems: BenefitItemRow[];
  risks: RiskExposureRow[];
}

interface ValueModelRow {
  id: string;
  code: string;
  name: string;
  description: string;
  isPlaceholder: boolean;
}

export function RoiClient({
  assets,
  valueModels,
  financialConfig,
  canWrite,
}: {
  assets: AssetRoiData[];
  valueModels: ValueModelRow[];
  financialConfig: FinancialConfig;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>(financialConfig.defaultCurrency || "SGD");
  const [selectedModelCode, setSelectedModelCode] = useState<string>("GENERIC");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [entryType, setEntryType] = useState<"COST" | "BENEFIT">("BENEFIT");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add entry state
  const [formAssetId, setFormAssetId] = useState(assets[0]?.id || "");
  const [costCategory, setCostCategory] = useState("BUILD");
  const [benefitCategory, setBenefitCategory] = useState("COST_AVOIDED");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(25000);
  const [plannedAmount, setPlannedAmount] = useState(40000);
  const [actualAmount, setActualAmount] = useState(35000);
  const [entryCurrency, setEntryCurrency] = useState<Currency>("SGD");
  const [quarter, setQuarter] = useState("2026-Q3");
  const [confidence, setConfidence] = useState<ValueConfidence>("MEASURED");
  const [methodologyNote, setMethodologyNote] = useState("");

  const scopedAssets = useMemo(
    () => (selectedAssetId ? assets.filter((a) => a.id === selectedAssetId) : assets),
    [assets, selectedAssetId]
  );

  const summary = useMemo(() => {
    const allCosts = scopedAssets.flatMap((a) => a.costItems);
    const allBenefits = scopedAssets.flatMap((a) => a.benefitItems);
    const allRisks = scopedAssets.flatMap((a) => a.risks);
    return calculateGenericRoi(allCosts, allBenefits, allRisks, currency, financialConfig);
  }, [scopedAssets, currency, financialConfig]);

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);

    const payload =
      entryType === "COST"
        ? {
            type: "COST",
            assetId: formAssetId,
            category: costCategory,
            description,
            amount,
            currency: entryCurrency,
            quarter,
            isRecurring: false,
          }
        : {
            type: "BENEFIT",
            assetId: formAssetId,
            category: benefitCategory,
            description,
            plannedAmount,
            actualAmount,
            currency: entryCurrency,
            quarter,
            confidence,
            methodologyNote,
          };

    const res = await fetch("/api/roi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to record ROI entry.");
      return;
    }

    setStatusMsg(`Recorded ${entryType.toLowerCase()} entry for ${quarter}.`);
    setDescription("");
    setShowAddForm(false);
    router.refresh();
  }

  function confidenceBadge(c: ValueConfidence) {
    if (c === "MEASURED") return <Badge variant="success">Measured (Verified)</Badge>;
    if (c === "ESTIMATED") return <Badge variant="info">Estimated</Badge>;
    return <Badge variant="warning">Assumed (Unverified)</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ROI, Value Realisation &amp; Value-at-Risk</h1>
          <p className="text-sm text-muted-foreground">
            Separating verified measured value from estimated or assumed projections, adjusted for residual risk
            exposure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-56"
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
          >
            <option value="">All AI Assets (Portfolio)</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetCode} · {a.name}
              </option>
            ))}
          </Select>

          <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
            {(["SGD", "USD"] as Currency[]).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setCurrency(curr)}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  currency === curr ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {curr}
              </button>
            ))}
          </div>

          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Log Cost / Benefit
            </Button>
          )}
        </div>
      </div>

      {/* Pluggable ROI Model Selector */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {valueModels.map((vm) => (
          <Button
            key={vm.code}
            type="button"
            size="sm"
            variant={selectedModelCode === vm.code ? "primary" : "outline"}
            onClick={() => setSelectedModelCode(vm.code)}
          >
            <span>{vm.name}</span>
            {vm.isPlaceholder && <Badge variant="warning">TODO</Badge>}
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

      {selectedModelCode !== "GENERIC" ? (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="warning">Extension Point Placeholder</Badge>
              <CardTitle>
                {valueModels.find((v) => v.code === selectedModelCode)?.name}
              </CardTitle>
            </div>
            <CardDescription>
              Reserved extension point for Ian Loe&apos;s proprietary valuation methodology (Tactics Solutions, CC BY-NC
              4.0)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <p>
              <strong>TODO:</strong> Supply the official calculation formulas and parameter definitions for{" "}
              <strong>{valueModels.find((v) => v.code === selectedModelCode)?.name}</strong> in{" "}
              <code>src/lib/governance/roi-engine.ts</code> and <code>GovernanceConfig</code>.
            </p>
            <p className="text-muted-foreground">
              Per your working rules, no methodology has been invented for this model. Switch back to the{" "}
              <strong>Generic Enterprise AI ROI Model</strong> tab to view active TCO, NPV, Measured vs Assumed value,
              and Value-at-Risk calculations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {showAddForm && canWrite && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Record Investment Cost or Realised Benefit</CardTitle>
                  <CardDescription>
                    Every benefit entry requires an explicit confidence tier (Measured, Estimated, or Assumed)
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={entryType === "BENEFIT" ? "primary" : "outline"}
                    onClick={() => setEntryType("BENEFIT")}
                  >
                    Benefit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={entryType === "COST" ? "primary" : "outline"}
                    onClick={() => setEntryType("COST")}
                  >
                    Cost
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddEntry} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">AI Asset</label>
                      <Select value={formAssetId} onChange={(e) => setFormAssetId(e.target.value)}>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.assetCode} · {a.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Category</label>
                      {entryType === "COST" ? (
                        <Select value={costCategory} onChange={(e) => setCostCategory(e.target.value)}>
                          <option value="BUILD">Build</option>
                          <option value="LICENCE">Licence</option>
                          <option value="INFERENCE_COMPUTE">Inference &amp; Compute</option>
                          <option value="PEOPLE">People</option>
                          <option value="CHANGE_MANAGEMENT">Change Management</option>
                          <option value="GOVERNANCE">Governance Cost</option>
                        </Select>
                      ) : (
                        <Select value={benefitCategory} onChange={(e) => setBenefitCategory(e.target.value)}>
                          <option value="COST_AVOIDED">Cost Avoided</option>
                          <option value="REVENUE_UPLIFT">Revenue Uplift</option>
                          <option value="PRODUCTIVITY_HOURS">Productivity Hours Released</option>
                          <option value="RISK_REDUCTION">Risk Reduction</option>
                          <option value="QUALITY_IMPROVEMENT">Quality Improvement</option>
                        </Select>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Quarter</label>
                      <Input value={quarter} onChange={(e) => setQuarter(e.target.value)} placeholder="2026-Q3" />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Currency</label>
                      <Select
                        value={entryCurrency}
                        onChange={(e) => setEntryCurrency(e.target.value as Currency)}
                      >
                        <option value="SGD">SGD (Default)</option>
                        <option value="USD">USD</option>
                      </Select>
                    </div>
                  </div>

                  {entryType === "COST" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        required
                        placeholder="Cost description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                      <Input
                        type="number"
                        min="0"
                        required
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Input
                        required
                        placeholder="Benefit description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                      <div>
                        <label className="text-[11px] font-medium block mb-1">Planned Amount</label>
                        <Input
                          type="number"
                          min="0"
                          value={plannedAmount}
                          onChange={(e) => setPlannedAmount(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium block mb-1">Actual Amount</label>
                        <Input
                          type="number"
                          min="0"
                          value={actualAmount}
                          onChange={(e) => setActualAmount(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium block mb-1">Evidence Confidence</label>
                        <Select
                          value={confidence}
                          onChange={(e) => setConfidence(e.target.value as ValueConfidence)}
                        >
                          <option value="MEASURED">Measured (Verified Ledger)</option>
                          <option value="ESTIMATED">Estimated (Pilot Sample)</option>
                          <option value="ASSUMED">Assumed (Business Case)</option>
                        </Select>
                      </div>
                    </div>
                  )}

                  {entryType === "BENEFIT" && (
                    <Input
                      placeholder="Methodology / source evidence note..."
                      value={methodologyNote}
                      onChange={(e) => setMethodologyNote(e.target.value)}
                    />
                  )}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm">
                      Save Entry
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-3.5 space-y-1">
                <div className="text-[11px] text-muted-foreground">Total Cost of Ownership</div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatCurrency(summary.totalCost, currency)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Cost/Outcome: {formatCurrency(summary.costPerOutcome, currency)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-300 dark:border-emerald-800">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Measured Benefit</span>
                  <Badge variant="success">Verified</Badge>
                </div>
                <div className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(summary.measuredBenefit, currency)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Measured-only ROI: {summary.measuredOnlyRoiPercent}%
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-300 dark:border-amber-800">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Estimated + Assumed</span>
                  <Badge variant="warning">Unverified</Badge>
                </div>
                <div className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {formatCurrency(summary.estimatedBenefit + summary.assumedBenefit, currency)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Est: {formatCurrency(summary.estimatedBenefit, currency)} · Assumed:{" "}
                  {formatCurrency(summary.assumedBenefit, currency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3.5 space-y-1">
                <div className="text-[11px] text-muted-foreground">Net Benefit &amp; Total ROI</div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatCurrency(summary.netBenefit, currency)} ({summary.roiPercent}%)
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Payback: {summary.paybackMonths !== null ? `${summary.paybackMonths} mos` : "N/A"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3.5 space-y-1">
                <div className="text-[11px] text-muted-foreground">
                  NPV ({financialConfig.npvHorizonQuarters}Q @ {(financialConfig.npvDiscountRate * 100).toFixed(0)}%)
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatCurrency(summary.npv, currency)}
                </div>
                <div className="text-[11px] text-muted-foreground">Discounted cash flow</div>
              </CardContent>
            </Card>

            <Card className="border-red-300 dark:border-red-900">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Risk-Adjusted Return</span>
                  <ShieldAlert className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatCurrency(summary.riskAdjustedNetBenefit, currency)} ({summary.riskAdjustedRoiPercent}%)
                </div>
                <div className="text-[11px] text-red-700 dark:text-red-400">
                  Value-at-Risk: -{formatCurrency(summary.valueAtRisk, currency)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart & Per-Asset Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Card className="lg:col-span-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Quarterly Benefit Realisation ({currency})</CardTitle>
                </div>
                <CardDescription>
                  Visibly separating Measured (Verified) benefits from Estimated and Assumed projections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RoiChart data={summary.quarterlySeries} currency={currency} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-6">
              <CardHeader>
                <CardTitle>Per-Asset Return &amp; Value-at-Risk Breakdown</CardTitle>
                <CardDescription>
                  Linked to open residual risks in the Risk Register
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                      <th className="py-2 px-3 font-medium">Asset</th>
                      <th className="py-2 px-3 font-medium text-right">TCO</th>
                      <th className="py-2 px-3 font-medium text-right">Measured</th>
                      <th className="py-2 px-3 font-medium text-right">Est / Assumed</th>
                      <th className="py-2 px-3 font-medium text-right">VaR</th>
                      <th className="py-2 px-3 font-medium text-right">Risk-Adj ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedAssets.map((a) => {
                      const calc = calculateGenericRoi(
                        a.costItems,
                        a.benefitItems,
                        a.risks,
                        currency,
                        financialConfig
                      );
                      return (
                        <tr key={a.id} className="border-b border-border last:border-0">
                          <td className="py-2 px-3">
                            <Link href={`/assets/${a.id}`} className="font-mono text-primary hover:underline mr-1">
                              {a.assetCode}
                            </Link>
                            <span className="font-medium">{a.name}</span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatCurrency(calc.totalCost, currency)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                            {formatCurrency(calc.measuredBenefit, currency)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                            {formatCurrency(calc.estimatedBenefit + calc.assumedBenefit, currency)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-red-700 dark:text-red-400">
                            -{formatCurrency(calc.valueAtRisk, currency)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold">
                            {calc.riskAdjustedRoiPercent}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Benefit Ledger showing Measured vs Assumed */}
          <Card>
            <CardHeader>
              <CardTitle>Benefit Realisation Ledger (Planned vs Actual with Confidence Tier)</CardTitle>
              <CardDescription>
                Every benefit item carries an explicit confidence classification
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Asset</th>
                    <th className="py-2.5 px-4 font-medium">Quarter</th>
                    <th className="py-2.5 px-4 font-medium">Category &amp; Description</th>
                    <th className="py-2.5 px-4 font-medium">Confidence Tier</th>
                    <th className="py-2.5 px-4 font-medium text-right">Planned</th>
                    <th className="py-2.5 px-4 font-medium text-right">Actual</th>
                    <th className="py-2.5 px-4 font-medium">Methodology / Source Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedAssets.flatMap((a) =>
                    a.benefitItems.map((b) => (
                      <tr key={b.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-4 font-mono">{a.assetCode}</td>
                        <td className="py-2.5 px-4">{b.quarter}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium">{formatEnumLabel(b.category)}</div>
                          <div className="text-[11px] text-muted-foreground">{b.description}</div>
                        </td>
                        <td className="py-2.5 px-4">{confidenceBadge(b.confidence)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {formatCurrency(b.plannedAmount, b.currency)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                          {formatCurrency(b.actualAmount, b.currency)}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {b.methodologyNote || "Standard quarterly review"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
