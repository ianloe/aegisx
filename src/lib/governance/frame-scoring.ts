import { FrameDimension, MetricClassification } from "@prisma/client";

export interface FrameScoreInput {
  dimension: FrameDimension;
  score: number;
  metricClassification?: MetricClassification;
}

export interface FrameSummary {
  dimensions: Record<FrameDimension, number>;
  overallScore: number;
  activityOnlyWarning: boolean;
}

const ALL_DIMENSIONS: FrameDimension[] = ["FOCUS", "ROLES", "AUTHORITY", "METRICS", "EVALUATION"];

/**
 * Computes per-dimension averages (0..4), overall FRAME maturity score,
 * and flags when an asset's Metrics dimension only reports ACTIVITY metrics.
 */
export function computeFrameSummary(scores: FrameScoreInput[]): FrameSummary {
  const buckets: Record<FrameDimension, number[]> = {
    FOCUS: [],
    ROLES: [],
    AUTHORITY: [],
    METRICS: [],
    EVALUATION: [],
  };

  let hasActivityMetric = false;
  let hasOutcomeMetric = false;

  for (const s of scores) {
    const clamped = Math.max(0, Math.min(4, s.score));
    buckets[s.dimension].push(clamped);
    if (s.dimension === "METRICS") {
      if (s.metricClassification === "ACTIVITY") hasActivityMetric = true;
      if (s.metricClassification === "OUTCOME" || s.metricClassification === "BOTH") {
        hasOutcomeMetric = true;
      }
    }
  }

  const dimensions = {} as Record<FrameDimension, number>;
  let sumOfDimAverages = 0;
  let populatedDims = 0;

  for (const dim of ALL_DIMENSIONS) {
    const vals = buckets[dim];
    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      dimensions[dim] = Number(avg.toFixed(2));
      sumOfDimAverages += dimensions[dim];
      populatedDims++;
    } else {
      dimensions[dim] = 0;
    }
  }

  const overallScore = populatedDims > 0 ? Number((sumOfDimAverages / populatedDims).toFixed(2)) : 0;

  return {
    dimensions,
    overallScore,
    activityOnlyWarning: hasActivityMetric && !hasOutcomeMetric,
  };
}

export interface RoleHealthResult {
  isComplete: boolean;
  isLapsed: boolean;
  flags: string[];
}

export function evaluateRoleHealth(
  asset: {
    ownerId: string | null;
    overseerId: string | null;
    escalationPath: string | null;
    rolesLastReviewedAt: Date | null;
  },
  maxAgeDays = 180,
  now = new Date()
): RoleHealthResult {
  const flags: string[] = [];
  if (!asset.ownerId) flags.push("Missing accountable owner");
  if (!asset.overseerId) flags.push("Missing human overseer");
  if (!asset.escalationPath || !asset.escalationPath.trim()) flags.push("Missing escalation path");

  let isLapsed = false;
  if (!asset.rolesLastReviewedAt) {
    isLapsed = true;
    flags.push("Roles never reviewed");
  } else {
    const ageDays = (now.getTime() - new Date(asset.rolesLastReviewedAt).getTime()) / 86400000;
    if (ageDays > maxAgeDays) {
      isLapsed = true;
      flags.push(`Roles review lapsed (${Math.floor(ageDays)} days > ${maxAgeDays}d)`);
    }
  }

  return {
    isComplete: Boolean(asset.ownerId && asset.overseerId && asset.escalationPath?.trim()),
    isLapsed,
    flags,
  };
}
