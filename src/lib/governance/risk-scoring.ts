export interface RiskAppetiteThresholds {
  maxAcceptableResidualScore: number;
  criticalThreshold: number;
  escalateToBoardScore: number;
}

export const DEFAULT_RISK_APPETITE: RiskAppetiteThresholds = {
  maxAcceptableResidualScore: 12,
  criticalThreshold: 16,
  escalateToBoardScore: 20,
};

export interface EvaluatedRisk {
  inherentScore: number;
  residualScore: number;
  appetiteBreached: boolean;
  isCritical: boolean;
  requiresBoardEscalation: boolean;
  band: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  isOverdueReview: boolean;
}

export function evaluateRiskPosture(
  input: {
    inherentLikelihood: number;
    inherentImpact: number;
    residualLikelihood: number;
    residualImpact: number;
    reviewDate?: Date | string | null;
    status?: string;
  },
  thresholds: RiskAppetiteThresholds = DEFAULT_RISK_APPETITE,
  now = new Date()
): EvaluatedRisk {
  const inhL = Math.max(1, Math.min(5, input.inherentLikelihood));
  const inhI = Math.max(1, Math.min(5, input.inherentImpact));
  const resL = Math.max(1, Math.min(5, input.residualLikelihood));
  const resI = Math.max(1, Math.min(5, input.residualImpact));

  const inherentScore = inhL * inhI;
  const residualScore = resL * resI;

  const appetiteBreached = residualScore > thresholds.maxAcceptableResidualScore;
  const isCritical = residualScore >= thresholds.criticalThreshold;
  const requiresBoardEscalation = residualScore >= thresholds.escalateToBoardScore;

  let band: EvaluatedRisk["band"] = "LOW";
  if (residualScore >= thresholds.criticalThreshold) {
    band = "CRITICAL";
  } else if (residualScore > thresholds.maxAcceptableResidualScore) {
    band = "HIGH";
  } else if (residualScore >= 6) {
    band = "MODERATE";
  }

  let isOverdueReview = false;
  if (input.reviewDate && input.status !== "CLOSED") {
    const rev = typeof input.reviewDate === "string" ? new Date(input.reviewDate) : input.reviewDate;
    if (rev.getTime() < now.getTime()) {
      isOverdueReview = true;
    }
  }

  return {
    inherentScore,
    residualScore,
    appetiteBreached,
    isCritical,
    requiresBoardEscalation,
    band,
    isOverdueReview,
  };
}

/**
 * Builds a 5x5 matrix (likelihood 5 down to 1, impact 1 to 5) counting risks in each cell.
 */
export function buildRiskHeatmapMatrix<
  T extends { residualLikelihood: number; residualImpact: number; inherentLikelihood: number; inherentImpact: number }
>(risks: T[], mode: "residual" | "inherent" = "residual"): Array<Array<{ likelihood: number; impact: number; score: number; items: T[] }>> {
  const rows: Array<Array<{ likelihood: number; impact: number; score: number; items: T[] }>> = [];
  for (let l = 5; l >= 1; l--) {
    const row: Array<{ likelihood: number; impact: number; score: number; items: T[] }> = [];
    for (let i = 1; i <= 5; i++) {
      const matching = risks.filter((r) =>
        mode === "residual"
          ? r.residualLikelihood === l && r.residualImpact === i
          : r.inherentLikelihood === l && r.inherentImpact === i
      );
      row.push({ likelihood: l, impact: i, score: l * i, items: matching });
    }
    rows.push(row);
  }
  return rows;
}
