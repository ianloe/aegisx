import { Currency, ValueConfidence } from "@prisma/client";

export interface FinancialConfig {
  defaultCurrency: Currency;
  usdToSgdRate: number;
  npvDiscountRate: number;
  npvHorizonQuarters: number;
}

export const DEFAULT_FINANCIAL_CONFIG: FinancialConfig = {
  defaultCurrency: "SGD",
  usdToSgdRate: 1.34,
  npvDiscountRate: 0.08,
  npvHorizonQuarters: 12,
};

export interface CostEntryInput {
  amount: number;
  currency: Currency;
  quarter: string;
  category?: string;
}

export interface BenefitEntryInput {
  plannedAmount: number;
  actualAmount: number;
  currency: Currency;
  quarter: string;
  confidence: ValueConfidence;
  category?: string;
}

export interface LinkedRiskExposureInput {
  residualLikelihood: number;
  residualImpact: number;
  financialExposure?: number | null;
  status?: string;
}

export interface RoiCalculationSummary {
  currency: Currency;
  totalCost: number;
  measuredBenefit: number;
  estimatedBenefit: number;
  assumedBenefit: number;
  totalBenefit: number;
  totalPlannedBenefit: number;
  totalActualBenefit: number;
  netBenefit: number;
  measuredOnlyNetBenefit: number;
  roiPercent: number;
  measuredOnlyRoiPercent: number;
  paybackMonths: number | null;
  npv: number;
  costPerOutcome: number;
  valueAtRisk: number;
  riskAdjustedNetBenefit: number;
  riskAdjustedRoiPercent: number;
  quarterlySeries: Array<{
    quarter: string;
    cost: number;
    plannedBenefit: number;
    actualBenefit: number;
    measuredBenefit: number;
    assumedOrEstimatedBenefit: number;
  }>;
}

export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  usdToSgdRate = 1.34
): number {
  if (from === to) return amount;
  if (from === "USD" && to === "SGD") return amount * usdToSgdRate;
  if (from === "SGD" && to === "USD") return amount / (usdToSgdRate || 1.34);
  return amount;
}

/**
 * Calculates TCO, Measured vs Estimated vs Assumed benefits, Net Benefit, ROI %,
 * Payback Period, NPV, Cost per Outcome, and Risk-Adjusted Return (Value-at-Risk).
 */
export function calculateGenericRoi(
  costs: CostEntryInput[],
  benefits: BenefitEntryInput[],
  risks: LinkedRiskExposureInput[] = [],
  targetCurrency: Currency = "SGD",
  config: FinancialConfig = DEFAULT_FINANCIAL_CONFIG
): RoiCalculationSummary {
  const rate = config.usdToSgdRate || 1.34;

  let totalCost = 0;
  let measuredBenefit = 0;
  let estimatedBenefit = 0;
  let assumedBenefit = 0;
  let totalPlannedBenefit = 0;
  let totalActualBenefit = 0;

  const quarterMap = new Map<
    string,
    {
      cost: number;
      plannedBenefit: number;
      actualBenefit: number;
      measuredBenefit: number;
      assumedOrEstimatedBenefit: number;
    }
  >();

  const ensureQuarter = (q: string) => {
    if (!quarterMap.has(q)) {
      quarterMap.set(q, {
        cost: 0,
        plannedBenefit: 0,
        actualBenefit: 0,
        measuredBenefit: 0,
        assumedOrEstimatedBenefit: 0,
      });
    }
    return quarterMap.get(q)!;
  };

  for (const c of costs) {
    const val = convertCurrency(c.amount, c.currency, targetCurrency, rate);
    totalCost += val;
    const qEntry = ensureQuarter(c.quarter || "2026-Q1");
    qEntry.cost += val;
  }

  for (const b of benefits) {
    const planned = convertCurrency(b.plannedAmount, b.currency, targetCurrency, rate);
    const actual = convertCurrency(b.actualAmount, b.currency, targetCurrency, rate);
    const effective = actual > 0 ? actual : planned;

    totalPlannedBenefit += planned;
    totalActualBenefit += actual;

    const qEntry = ensureQuarter(b.quarter || "2026-Q1");
    qEntry.plannedBenefit += planned;
    qEntry.actualBenefit += actual;

    if (b.confidence === "MEASURED") {
      measuredBenefit += effective;
      qEntry.measuredBenefit += effective;
    } else if (b.confidence === "ESTIMATED") {
      estimatedBenefit += effective;
      qEntry.assumedOrEstimatedBenefit += effective;
    } else {
      assumedBenefit += effective;
      qEntry.assumedOrEstimatedBenefit += effective;
    }
  }

  const totalBenefit = measuredBenefit + estimatedBenefit + assumedBenefit;
  const netBenefit = totalBenefit - totalCost;
  const measuredOnlyNetBenefit = measuredBenefit - totalCost;

  const roiPercent = totalCost > 0 ? Number(((netBenefit / totalCost) * 100).toFixed(1)) : 0;
  const measuredOnlyRoiPercent =
    totalCost > 0 ? Number(((measuredOnlyNetBenefit / totalCost) * 100).toFixed(1)) : 0;

  const sortedQuarters = Array.from(quarterMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, vals]) => ({
      quarter,
      cost: Math.round(vals.cost),
      plannedBenefit: Math.round(vals.plannedBenefit),
      actualBenefit: Math.round(vals.actualBenefit),
      measuredBenefit: Math.round(vals.measuredBenefit),
      assumedOrEstimatedBenefit: Math.round(vals.assumedOrEstimatedBenefit),
    }));

  // Payback period in months based on average monthly benefit
  const numQuarters = Math.max(1, sortedQuarters.length);
  const monthlyBenefit = totalBenefit / (numQuarters * 3);
  const paybackMonths =
    totalCost > 0 && monthlyBenefit > 0 ? Number((totalCost / monthlyBenefit).toFixed(1)) : null;

  // NPV over configured horizon (quarterly discount rate = (1 + annual)^(1/4) - 1)
  const annualDiscount = config.npvDiscountRate ?? 0.08;
  const quarterlyDiscount = Math.pow(1 + annualDiscount, 0.25) - 1;
  const horizon = Math.max(1, config.npvHorizonQuarters ?? 12);

  let npv = 0;
  const avgQuarterlyNet =
    sortedQuarters.length > 0
      ? (totalBenefit - totalCost) / sortedQuarters.length
      : 0;

  for (let t = 1; t <= horizon; t++) {
    const qData = sortedQuarters[t - 1];
    const cashFlow = qData
      ? qData.measuredBenefit + qData.assumedOrEstimatedBenefit - qData.cost
      : avgQuarterlyNet;
    npv += cashFlow / Math.pow(1 + quarterlyDiscount, t);
  }

  const outcomeCount = Math.max(1, benefits.length);
  const costPerOutcome = Math.round(totalCost / outcomeCount);

  // Value-at-Risk from open linked risks
  let valueAtRisk = 0;
  for (const r of risks) {
    if (r.status === "CLOSED") continue;
    const residualScore = Math.max(1, Math.min(25, r.residualLikelihood * r.residualImpact));
    if (r.financialExposure && r.financialExposure > 0) {
      const convertedExp = convertCurrency(r.financialExposure, "SGD", targetCurrency, rate);
      // Probability-weighted exposure based on residual likelihood (1..5 -> 10%..50%)
      valueAtRisk += convertedExp * (r.residualLikelihood * 0.1);
    } else {
      valueAtRisk += totalBenefit * (residualScore / 100);
    }
  }

  const riskAdjustedNetBenefit = netBenefit - valueAtRisk;
  const riskAdjustedRoiPercent =
    totalCost > 0 ? Number(((riskAdjustedNetBenefit / totalCost) * 100).toFixed(1)) : 0;

  return {
    currency: targetCurrency,
    totalCost: Math.round(totalCost),
    measuredBenefit: Math.round(measuredBenefit),
    estimatedBenefit: Math.round(estimatedBenefit),
    assumedBenefit: Math.round(assumedBenefit),
    totalBenefit: Math.round(totalBenefit),
    totalPlannedBenefit: Math.round(totalPlannedBenefit),
    totalActualBenefit: Math.round(totalActualBenefit),
    netBenefit: Math.round(netBenefit),
    measuredOnlyNetBenefit: Math.round(measuredOnlyNetBenefit),
    roiPercent,
    measuredOnlyRoiPercent,
    paybackMonths,
    npv: Math.round(npv),
    costPerOutcome,
    valueAtRisk: Math.round(valueAtRisk),
    riskAdjustedNetBenefit: Math.round(riskAdjustedNetBenefit),
    riskAdjustedRoiPercent,
    quarterlySeries: sortedQuarters,
  };
}

/**
 * Extension point for Ian Loe's Agentic P&L Framework.
 * TODO: Supply official Agentic P&L methodology from Ian Loe (Tactics Solutions).
 */
export interface AgenticPnLInput {
  assetId: string;
  currency: Currency;
  // TODO: Add Agentic P&L specific parameters once supplied by Ian Loe
}

/**
 * Extension point for Ian Loe's Capability Capitalisation Model.
 * TODO: Supply official Capability Capitalisation methodology from Ian Loe (Tactics Solutions).
 */
export interface CapabilityCapitalisationInput {
  assetId: string;
  currency: Currency;
  // TODO: Add Capability Capitalisation amortisation & reuse parameters once supplied by Ian Loe
}
