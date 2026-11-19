import { describe, expect, it } from "vitest";
import { computeFrameSummary, evaluateRoleHealth } from "../governance/frame-scoring";
import {
  assignPerformanceProfile,
  computeImprovementTrajectory,
  evaluateScheduleStatus,
  ProfileDefinition,
} from "../governance/aaef-engine";
import { buildRiskHeatmapMatrix, evaluateRiskPosture } from "../governance/risk-scoring";
import { calculateGenericRoi, convertCurrency } from "../governance/roi-engine";
import { parseCsv, toCsv } from "../csv";
import { generateBoardPackPdfBuffer } from "../pdf/board-pack-pdf";
import { evaluateStageGateReadiness } from "../governance/stage-gates";

const SAMPLE_PROFILES: ProfileDefinition[] = [
  {
    id: "p-op",
    code: "OPERATIONAL",
    name: "Operational",
    governanceConsequence: "Standard oversight",
    requiredAction: "Continue quarterly appraisal",
    ruleConfigJson: {
      minAvgScore: 3.0,
      minDimensionScore: 2.5,
      requireBoundaryPassed: true,
      maxOpenBreaches: 0,
      disallowedTrajectories: ["DEGRADING"],
    },
  },
  {
    id: "p-dev",
    code: "DEVELOPING",
    name: "Developing",
    governanceConsequence: "Enhanced oversight",
    requiredAction: "Schedule 30-day review",
    ruleConfigJson: {
      minAvgScore: 2.2,
      minDimensionScore: 1.5,
      requireBoundaryPassed: true,
      maxOpenBreaches: 0,
      disallowedTrajectories: ["DEGRADING"],
    },
  },
  {
    id: "p-res",
    code: "RESTRICTED",
    name: "Restricted",
    governanceConsequence: "Restricted autonomy",
    requiredAction: "Restrict decision rights",
    ruleConfigJson: {
      minAvgScore: 1.5,
      minDimensionScore: 1.0,
      requireBoundaryPassed: false,
      maxOpenBreaches: 1,
      disallowedTrajectories: [],
    },
  },
  {
    id: "p-ur",
    code: "UNDER_REVIEW",
    name: "Under Review",
    governanceConsequence: "Suspend autonomous operation",
    requiredAction: "Immediate suspension",
    ruleConfigJson: {
      minAvgScore: 0,
      minDimensionScore: 0,
      requireBoundaryPassed: false,
      maxOpenBreaches: 999,
      disallowedTrajectories: [],
    },
  },
];

describe("FRAME Governance Scoring & Roles Health", () => {
  it("computes dimension averages and warns when only activity metrics are reported", () => {
    const summary = computeFrameSummary([
      { dimension: "FOCUS", score: 3 },
      { dimension: "ROLES", score: 4 },
      { dimension: "AUTHORITY", score: 3 },
      { dimension: "METRICS", score: 2, metricClassification: "ACTIVITY" },
      { dimension: "EVALUATION", score: 3 },
    ]);

    expect(summary.dimensions.FOCUS).toBe(3);
    expect(summary.overallScore).toBe(3);
    expect(summary.activityOnlyWarning).toBe(true);
  });

  it("clears activity-only warning when outcome metrics are included", () => {
    const summary = computeFrameSummary([
      { dimension: "METRICS", score: 3, metricClassification: "ACTIVITY" },
      { dimension: "METRICS", score: 4, metricClassification: "OUTCOME" },
    ]);

    expect(summary.dimensions.METRICS).toBe(3.5);
    expect(summary.activityOnlyWarning).toBe(false);
  });

  it("flags missing roles and lapsed reviews accurately", () => {
    const now = new Date("2026-11-17T00:00:00Z");
    const lapsedDate = new Date("2026-01-01T00:00:00Z");
    const health = evaluateRoleHealth(
      {
        ownerId: "u1",
        overseerId: null,
        escalationPath: "CRO",
        rolesLastReviewedAt: lapsedDate,
      },
      180,
      now
    );

    expect(health.isComplete).toBe(false);
    expect(health.isLapsed).toBe(true);
    expect(health.flags).toContain("Missing human overseer");
  });
});

describe("AAEF Appraisal Trajectory & Profile Assignment Engine", () => {
  it("computes improving, stable, and degrading trajectories", () => {
    expect(computeImprovementTrajectory(3.4, 2.8, 0.25).trajectory).toBe("IMPROVING");
    expect(computeImprovementTrajectory(3.0, 2.9, 0.25).trajectory).toBe("STABLE");
    expect(computeImprovementTrajectory(2.1, 2.9, 0.25).trajectory).toBe("DEGRADING");
  });

  it("assigns Operational when all thresholds and boundary adherence are met", () => {
    const res = assignPerformanceProfile(
      {
        taskCompetence: 3.4,
        judgementQuality: 3.2,
        collaborationEffectiveness: 3.3,
        boundaryPassed: true,
        openBreachCount: 0,
        previousAvgScore: 2.9,
      },
      SAMPLE_PROFILES
    );

    expect(res.profile.code).toBe("OPERATIONAL");
    expect(res.trajectory).toBe("IMPROVING");
    expect(res.reason).toContain("Assigned Operational");
  });

  it("downgrades from Operational to Restricted when a boundary breach occurs", () => {
    const res = assignPerformanceProfile(
      {
        taskCompetence: 3.5,
        judgementQuality: 3.4,
        collaborationEffectiveness: 3.3,
        boundaryPassed: false,
        openBreachCount: 1,
        hasCriticalOrHighBreach: false,
        previousAvgScore: 3.3,
      },
      SAMPLE_PROFILES
    );

    expect(res.profile.code).toBe("RESTRICTED");
    expect(res.reason).toContain("requires Boundary Adherence pass");
  });

  it("assigns Under Review immediately on a critical boundary breach", () => {
    const res = assignPerformanceProfile(
      {
        taskCompetence: 3.5,
        judgementQuality: 3.5,
        collaborationEffectiveness: 3.5,
        boundaryPassed: false,
        openBreachCount: 1,
        hasCriticalOrHighBreach: true,
      },
      SAMPLE_PROFILES
    );

    expect(res.profile.code).toBe("UNDER_REVIEW");
  });

  it("changes assigned profile when Admin rule threshold is modified without code changes", () => {
    const stricterProfiles = SAMPLE_PROFILES.map((p) =>
      p.code === "OPERATIONAL"
        ? { ...p, ruleConfigJson: { ...p.ruleConfigJson, minAvgScore: 3.8 } }
        : p
    );

    const res = assignPerformanceProfile(
      {
        taskCompetence: 3.4,
        judgementQuality: 3.2,
        collaborationEffectiveness: 3.3,
        boundaryPassed: true,
        openBreachCount: 0,
      },
      stricterProfiles
    );

    expect(res.profile.code).toBe("DEVELOPING");
  });

  it("evaluates due and overdue appraisal schedule statuses", () => {
    const now = new Date("2026-11-17T00:00:00Z");
    expect(evaluateScheduleStatus(new Date("2026-11-10T00:00:00Z"), null, now)).toBe("OVERDUE");
    expect(evaluateScheduleStatus(new Date("2026-11-25T00:00:00Z"), null, now)).toBe("DUE");
    expect(evaluateScheduleStatus(new Date("2026-12-25T00:00:00Z"), null, now)).toBe("SCHEDULED");
  });
});

describe("Risk Posture & 5x5 Heatmap", () => {
  it("detects risk appetite breaches and builds a 5x5 matrix", () => {
    const posture = evaluateRiskPosture(
      {
        inherentLikelihood: 5,
        inherentImpact: 4,
        residualLikelihood: 4,
        residualImpact: 4,
      },
      { maxAcceptableResidualScore: 12, criticalThreshold: 16, escalateToBoardScore: 20 }
    );

    expect(posture.inherentScore).toBe(20);
    expect(posture.residualScore).toBe(16);
    expect(posture.appetiteBreached).toBe(true);
    expect(posture.isCritical).toBe(true);

    const matrix = buildRiskHeatmapMatrix([
      { inherentLikelihood: 5, inherentImpact: 4, residualLikelihood: 4, residualImpact: 4 },
    ]);
    expect(matrix.length).toBe(5);
    expect(matrix[1][3].items.length).toBe(1);
  });
});

describe("ROI, Measured vs Assumed Separation, Currency Conversion & Value-at-Risk", () => {
  it("converts between SGD and USD accurately", () => {
    expect(convertCurrency(100, "USD", "SGD", 1.34)).toBeCloseTo(134);
    expect(convertCurrency(134, "SGD", "USD", 1.34)).toBeCloseTo(100);
  });

  it("separates Measured, Estimated, and Assumed benefits and computes Risk-Adjusted ROI", () => {
    const roi = calculateGenericRoi(
      [{ amount: 100000, currency: "SGD", quarter: "2026-Q1" }],
      [
        {
          plannedAmount: 80000,
          actualAmount: 90000,
          currency: "SGD",
          quarter: "2026-Q1",
          confidence: "MEASURED",
        },
        {
          plannedAmount: 60000,
          actualAmount: 0,
          currency: "SGD",
          quarter: "2026-Q2",
          confidence: "ASSUMED",
        },
      ],
      [
        {
          residualLikelihood: 3,
          residualImpact: 4,
          financialExposure: 100000,
          status: "OPEN",
        },
      ],
      "SGD"
    );

    expect(roi.totalCost).toBe(100000);
    expect(roi.measuredBenefit).toBe(90000);
    expect(roi.assumedBenefit).toBe(60000);
    expect(roi.totalBenefit).toBe(150000);
    expect(roi.netBenefit).toBe(50000);
    expect(roi.roiPercent).toBe(50);
    expect(roi.measuredOnlyNetBenefit).toBe(-10000);
    expect(roi.valueAtRisk).toBe(30000); // 100,000 * (3 * 0.1)
    expect(roi.riskAdjustedNetBenefit).toBe(20000);
    expect(roi.riskAdjustedRoiPercent).toBe(20);
  });
});

describe("CSV Import/Export & A4 PDF Board Pack Generator", () => {
  it("round-trips CSV and neutralises formula injection", () => {
    const csv = toCsv(["code", "formula"], [["AI-001", "=SUM(A1:A2)"]]);
    expect(csv).toContain("'=SUM(A1:A2)");
    const parsed = parseCsv(csv);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].code).toBe("AI-001");
  });

  it("generates a valid A4 PDF buffer with British English headers and attribution", () => {
    const buf = generateBoardPackPdfBuffer({
      generatedDate: "17 Nov 2026",
      organisationName: "Meridian Group",
      filterSummary: "All Business Units",
      totalAssets: 12,
      agentAssets: 4,
      lifecycleCounts: { IDEA: 1, PILOT: 3, PRODUCTION: 7, RETIRED: 1 },
      autonomyCounts: { ASSISTIVE: 4, HUMAN_IN_THE_LOOP: 4, HUMAN_ON_THE_LOOP: 2, AUTONOMOUS: 2 },
      averageFrameScore: 2.85,
      aaefDistribution: { OPERATIONAL: 2, DEVELOPING: 1, RESTRICTED: 1, UNDER_REVIEW: 0 },
      totalCostSgd: 600000,
      measuredBenefitSgd: 450000,
      assumedOrEstimatedSgd: 350000,
      netBenefitSgd: 200000,
      roiPercent: 33.3,
      valueAtRiskSgd: 80000,
      riskAdjustedRoiPercent: 20.0,
      appetiteBreachCount: 2,
      overdueActionsCount: 1,
      topRisks: [{ code: "RSK-001", title: "Sample risk", assetCode: "AI-001", residualScore: 16, breached: true }],
      recentIncidents: [{ code: "INC-001", title: "Sample incident", assetCode: "AI-001", severity: "HIGH", date: "10 Nov 2026" }],
    });

    const str = buf.toString("utf-8");
    expect(str.startsWith("%PDF-1.4")).toBe(true);
    expect(str).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(str).toContain("FRAME and AAEF by Ian Loe, Tactics Solutions, licensed CC BY-NC 4.0.");
  });
});

describe("Lifecycle Stage-Gate Readiness", () => {
  it("passes when all FRAME, Risk, and AAEF criteria are satisfied", () => {
    const res = evaluateStageGateReadiness({
      targetLifecycleStage: "PRODUCTION",
      targetAutonomyLevel: "AUTONOMOUS",
      isAgent: true,
      hasOwner: true,
      hasOverseer: true,
      rolesLapsed: false,
      authorityRuleCount: 3,
      latestFrameAvg: 3.1,
      highRiskBreachCount: 0,
      latestAaefProfileCode: "OPERATIONAL",
      openBreachCount: 0,
    });
    expect(res.passed).toBe(true);
    expect(res.checks.every((c) => c.passed)).toBe(true);
  });

  it("fails when an autonomous agent has open boundary breaches or lapsed roles", () => {
    const res = evaluateStageGateReadiness({
      targetLifecycleStage: "PRODUCTION",
      targetAutonomyLevel: "AUTONOMOUS",
      isAgent: true,
      hasOwner: true,
      hasOverseer: true,
      rolesLapsed: true,
      authorityRuleCount: 2,
      latestFrameAvg: 2.8,
      highRiskBreachCount: 1,
      latestAaefProfileCode: "RESTRICTED",
      openBreachCount: 1,
    });
    expect(res.passed).toBe(false);
    expect(res.checks.find((c) => c.key === "ROLES")?.passed).toBe(false);
    expect(res.checks.find((c) => c.key === "RISK_APPETITE")?.passed).toBe(false);
    expect(res.checks.find((c) => c.key === "AAEF_PROFILE")?.passed).toBe(false);
  });
});
