import { AppraisalStatus, ProfileCode, Severity, Trajectory } from "@prisma/client";

export interface ProfileRuleConfig {
  evaluationOrder?: number;
  minAvgScore: number;
  minDimensionScore: number;
  requireBoundaryPassed: boolean;
  maxOpenBreaches: number;
  disallowedTrajectories?: string[];
  isFallbackSevere?: boolean;
}

export interface ProfileDefinition {
  id: string;
  code: ProfileCode;
  name: string;
  governanceConsequence: string;
  requiredAction: string;
  ruleConfigJson: ProfileRuleConfig;
}

export interface AppraisalEvaluationInput {
  taskCompetence: number;
  judgementQuality: number;
  collaborationEffectiveness: number;
  boundaryPassed: boolean;
  openBreachCount: number;
  hasCriticalOrHighBreach?: boolean;
  previousAvgScore?: number | null;
  trajectoryDeltaThreshold?: number;
}

export interface TrajectoryResult {
  trajectory: Trajectory;
  trajectoryScore: number;
  delta: number;
}

export function computeImprovementTrajectory(
  currentCoreAvg: number,
  previousCoreAvg: number | null | undefined,
  deltaThreshold = 0.25
): TrajectoryResult {
  if (previousCoreAvg === null || previousCoreAvg === undefined) {
    return { trajectory: "STABLE", trajectoryScore: Number(currentCoreAvg.toFixed(2)), delta: 0 };
  }
  const delta = Number((currentCoreAvg - previousCoreAvg).toFixed(2));
  if (delta >= deltaThreshold) {
    return {
      trajectory: "IMPROVING",
      trajectoryScore: Math.min(4, Number((currentCoreAvg + 0.3).toFixed(2))),
      delta,
    };
  }
  if (delta <= -deltaThreshold) {
    return {
      trajectory: "DEGRADING",
      trajectoryScore: Math.max(0, Number((currentCoreAvg - 0.5).toFixed(2))),
      delta,
    };
  }
  return { trajectory: "STABLE", trajectoryScore: Number(currentCoreAvg.toFixed(2)), delta };
}

export interface ProfileAssignmentResult {
  profile: ProfileDefinition;
  coreAvgScore: number;
  minCoreScore: number;
  trajectory: Trajectory;
  trajectoryScore: number;
  reason: string;
}

/**
 * Evaluates an agent's scores, boundary adherence, and trajectory against
 * the configurable PerformanceProfile ruleset and explains the assignment.
 */
export function assignPerformanceProfile(
  input: AppraisalEvaluationInput,
  profiles: ProfileDefinition[]
): ProfileAssignmentResult {
  const coreScores = [
    input.taskCompetence,
    input.judgementQuality,
    input.collaborationEffectiveness,
  ];
  const coreAvgScore = Number(
    (coreScores.reduce((a, b) => a + b, 0) / coreScores.length).toFixed(2)
  );
  const minCoreScore = Number(Math.min(...coreScores).toFixed(2));

  const traj = computeImprovementTrajectory(
    coreAvgScore,
    input.previousAvgScore,
    input.trajectoryDeltaThreshold ?? 0.25
  );

  const byCode = new Map(profiles.map((p) => [p.code, p]));
  const operational = byCode.get("OPERATIONAL");
  const developing = byCode.get("DEVELOPING");
  const restricted = byCode.get("RESTRICTED");
  const underReview = byCode.get("UNDER_REVIEW") ?? profiles[profiles.length - 1];

  // Severe escalation check first: critical/high boundary breach or severe score collapse
  if (input.hasCriticalOrHighBreach && !input.boundaryPassed && underReview) {
    return {
      profile: underReview,
      coreAvgScore,
      minCoreScore,
      trajectory: traj.trajectory,
      trajectoryScore: traj.trajectoryScore,
      reason: `Assigned ${underReview.name}: severe boundary breach recorded (Boundary Adherence failed) requiring immediate suspension review.`,
    };
  }

  // Evaluate in order: OPERATIONAL -> DEVELOPING -> RESTRICTED -> UNDER_REVIEW
  const orderedCandidates = [operational, developing, restricted].filter(
    (p): p is ProfileDefinition => Boolean(p)
  );

  const failureReasons: string[] = [];

  for (const candidate of orderedCandidates) {
    const rule = candidate.ruleConfigJson;
    const minAvg = Number(rule.minAvgScore ?? 0);
    const minDim = Number(rule.minDimensionScore ?? 0);
    const reqBoundary = Boolean(rule.requireBoundaryPassed);
    const maxBreaches = Number(rule.maxOpenBreaches ?? 999);
    const disallowed = rule.disallowedTrajectories ?? [];

    if (reqBoundary && !input.boundaryPassed) {
      failureReasons.push(`${candidate.name} requires Boundary Adherence pass`);
      continue;
    }
    if (input.openBreachCount > maxBreaches) {
      failureReasons.push(
        `${candidate.name} allows at most ${maxBreaches} open breach(es) (found ${input.openBreachCount})`
      );
      continue;
    }
    if (coreAvgScore < minAvg) {
      failureReasons.push(
        `${candidate.name} requires avg score >= ${minAvg.toFixed(1)} (actual ${coreAvgScore.toFixed(2)})`
      );
      continue;
    }
    if (minCoreScore < minDim) {
      failureReasons.push(
        `${candidate.name} requires minimum dimension >= ${minDim.toFixed(1)} (actual ${minCoreScore.toFixed(2)})`
      );
      continue;
    }
    if (disallowed.includes(traj.trajectory)) {
      failureReasons.push(
        `${candidate.name} disallows ${traj.trajectory.toLowerCase()} trajectory`
      );
      continue;
    }

    const qualificationNote = `Assigned ${candidate.name}: core average ${coreAvgScore.toFixed(2)} (>= ${minAvg.toFixed(1)}), minimum dimension ${minCoreScore.toFixed(2)} (>= ${minDim.toFixed(1)}), Boundary Adherence ${input.boundaryPassed ? "passed" : "failed"}, trajectory ${traj.trajectory.toLowerCase()}.`;
    const contextNote =
      failureReasons.length > 0 ? ` Higher tiers excluded because ${failureReasons.join("; ")}.` : "";

    return {
      profile: candidate,
      coreAvgScore,
      minCoreScore,
      trajectory: traj.trajectory,
      trajectoryScore: traj.trajectoryScore,
      reason: `${qualificationNote}${contextNote}`,
    };
  }

  return {
    profile: underReview,
    coreAvgScore,
    minCoreScore,
    trajectory: traj.trajectory,
    trajectoryScore: traj.trajectoryScore,
    reason: `Assigned ${underReview.name}: agent did not meet thresholds for Operational, Developing, or Restricted (${failureReasons.join("; ")}).`,
  };
}

export function evaluateScheduleStatus(
  dueDate: Date,
  completedAt: Date | null | undefined,
  now = new Date()
): AppraisalStatus {
  if (completedAt) return "COMPLETED";
  const diffDays = (dueDate.getTime() - now.getTime()) / 86400000;
  if (diffDays < 0) return "OVERDUE";
  if (diffDays <= 14) return "DUE";
  return "SCHEDULED";
}

export function isHighSeverityBreach(severity: Severity): boolean {
  return severity === "CRITICAL";
}
