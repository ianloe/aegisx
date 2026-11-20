import { Currency, Prisma, RuntimeGateStatus, Severity } from "@prisma/client";
import { dispatchAlert } from "./alerts";

const USD_TO_SGD = 1.35;

export function convertCurrency(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  if (from === "USD" && to === "SGD") return amount * USD_TO_SGD;
  if (from === "SGD" && to === "USD") return amount / USD_TO_SGD;
  return amount;
}

export function evaluateGateFromBreachSeverity(
  current: RuntimeGateStatus,
  severity: Severity,
): RuntimeGateStatus {
  if (severity === Severity.CRITICAL) return RuntimeGateStatus.SUSPENDED;
  if (severity === Severity.HIGH && current === RuntimeGateStatus.ALLOW) {
    return RuntimeGateStatus.RESTRICTED;
  }
  return current;
}

export async function checkQuarterlyBudgetAndAlert(
  tx: Prisma.TransactionClient,
  params: {
    assetId: string;
    assetCode: string;
    quarter: string;
    quarterlyBudgetAmount: number | null;
    quarterlyBudgetCurrency: Currency;
  },
): Promise<{ spent: number; utilizationPct: number | null }> {
  const costs = await tx.costItem.findMany({
    where: { assetId: params.assetId, quarter: params.quarter },
    select: { amount: true, currency: true },
  });

  const spent = costs.reduce(
    (sum, c) => sum + convertCurrency(c.amount, c.currency, params.quarterlyBudgetCurrency),
    0,
  );

  if (!params.quarterlyBudgetAmount || params.quarterlyBudgetAmount <= 0) {
    return { spent, utilizationPct: null };
  }

  const utilizationPct = (spent / params.quarterlyBudgetAmount) * 100;
  if (utilizationPct >= 80) {
    const exceeded = utilizationPct >= 100;
    await dispatchAlert(tx, {
      eventType: "BUDGET_ALERT",
      title: exceeded
        ? `Budget Exceeded on ${params.assetCode} (${params.quarter})`
        : `Budget Warning on ${params.assetCode} (${params.quarter})`,
      message: `${params.assetCode} has reached ${utilizationPct.toFixed(1)}% of its ${params.quarterlyBudgetCurrency} ${params.quarterlyBudgetAmount.toLocaleString()} quarterly budget (${params.quarterlyBudgetCurrency} ${spent.toFixed(2)} spent).`,
      severity: exceeded ? "CRITICAL" : "WARNING",
      entityType: "AI_ASSET",
      entityId: params.assetId,
    });
  }

  return { spent, utilizationPct };
}
