import { AutonomyLevel, LifecycleStage } from "@prisma/client";

export interface StageGateCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface StageGateReadinessInput {
  targetLifecycleStage: LifecycleStage;
  targetAutonomyLevel: AutonomyLevel;
  isAgent: boolean;
  hasOwner: boolean;
  hasOverseer: boolean;
  rolesLapsed: boolean;
  authorityRuleCount: number;
  latestFrameAvg: number | null;
  highRiskBreachCount: number;
  latestAaefProfileCode: string | null;
  openBreachCount: number;
}

export interface StageGateReadinessResult {
  passed: boolean;
  checks: StageGateCheck[];
}

export function evaluateStageGateReadiness(input: StageGateReadinessInput): StageGateReadinessResult {
  const checks: StageGateCheck[] = [
    {
      key: "ROLES",
      label: "Named Accountable Owner & Human Overseer",
      passed: input.hasOwner && input.hasOverseer && !input.rolesLapsed,
      detail:
        !input.hasOwner || !input.hasOverseer
          ? "Missing Accountable Owner or Human Overseer."
          : input.rolesLapsed
            ? "Role accountability review has lapsed."
            : "Accountable Owner and Human Overseer are active and current.",
    },
    {
      key: "AUTHORITY",
      label: "FRAME Authority Matrix Defined",
      passed: input.authorityRuleCount > 0,
      detail:
        input.authorityRuleCount > 0
          ? `${input.authorityRuleCount} decision-right rule(s) recorded.`
          : "No decision-right rules defined in the Authority Matrix.",
    },
    {
      key: "RISK_APPETITE",
      label: "No Open Risks Above Appetite",
      passed: input.highRiskBreachCount === 0,
      detail:
        input.highRiskBreachCount === 0
          ? "All open risks are within Risk Appetite."
          : `${input.highRiskBreachCount} open risk(s) currently breach Risk Appetite.`,
    },
  ];

  if (input.targetLifecycleStage === "PRODUCTION" || input.targetLifecycleStage === "PILOT") {
    const minFrame = input.targetLifecycleStage === "PRODUCTION" ? 2.0 : 1.5;
    const frameOk = input.latestFrameAvg !== null && input.latestFrameAvg >= minFrame;
    checks.push({
      key: "FRAME_MATURITY",
      label: `Minimum FRAME Maturity (${minFrame.toFixed(1)} / 4.0)`,
      passed: frameOk,
      detail:
        input.latestFrameAvg === null
          ? "No FRAME assessment recorded yet."
          : `Latest FRAME average is ${input.latestFrameAvg.toFixed(2)} / 4.00 (required >= ${minFrame.toFixed(1)}).`,
    });
  }

  if (input.isAgent && (input.targetAutonomyLevel === "AUTONOMOUS" || input.targetLifecycleStage === "PRODUCTION")) {
    const allowedProfiles =
      input.targetAutonomyLevel === "AUTONOMOUS" ? ["OPERATIONAL"] : ["OPERATIONAL", "DEVELOPING"];
    const profileOk =
      input.latestAaefProfileCode !== null &&
      allowedProfiles.includes(input.latestAaefProfileCode) &&
      input.openBreachCount === 0;
    checks.push({
      key: "AAEF_PROFILE",
      label:
        input.targetAutonomyLevel === "AUTONOMOUS"
          ? "AAEF Profile Operational with Zero Open Breaches"
          : "AAEF Profile Operational or Developing",
      passed: profileOk,
      detail:
        input.latestAaefProfileCode === null
          ? "No AAEF appraisal recorded yet."
          : `Current profile: ${input.latestAaefProfileCode}, Open boundary breaches: ${input.openBreachCount}.`,
    });
  }

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}
