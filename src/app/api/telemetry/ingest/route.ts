import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BenefitCategory, CostCategory, Currency, Severity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { assignPerformanceProfile, ProfileRuleConfig } from "@/lib/governance/aaef-engine";
import { dispatchAlert } from "@/lib/governance/alerts";
import { checkQuarterlyBudgetAndAlert, evaluateGateFromBreachSeverity } from "@/lib/governance/budget-and-gate";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const ingestSchema = z.discriminatedUnion("eventType", [
  z.object({
    eventType: z.literal("BOUNDARY_BREACH"),
    assetCode: z.string().min(1),
    severity: z.nativeEnum(Severity),
    description: z.string().min(4),
    remediation: z.string().optional(),
    occurredAt: z.string().optional(),
  }),
  z.object({
    eventType: z.literal("ROI_METRIC"),
    assetCode: z.string().min(1),
    metricType: z.enum(["COST", "BENEFIT"]),
    category: z.string().min(1),
    description: z.string().min(2),
    amount: z.number().nonnegative(),
    currency: z.nativeEnum(Currency).default("SGD"),
    quarter: z.string().min(4),
  }),
  z.object({
    eventType: z.literal("GUARDRAIL_EVENT"),
    assetCode: z.string().min(1),
    gateway: z.string().min(1).default("AI Gateway"),
    violationType: z.enum(["PROMPT_INJECTION", "PII_LEAK", "TOXICITY", "DATA_EXFILTRATION", "OTHER"]).default("OTHER"),
    blocked: z.boolean().default(true),
    severity: z.nativeEnum(Severity).default(Severity.MEDIUM),
    description: z.string().min(4),
  }),
]);

export async function POST(request: Request) {
  let actorId: string | null = null;
  let actorEmail = "telemetry@aegis";
  let keyId: string | null = null;

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    const keyHash = hashToken(rawToken);
    const keyRecord = await prisma.telemetryApiKey.findUnique({
      where: { keyHash },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    if (!keyRecord || !keyRecord.isActive) {
      return NextResponse.json({ error: "Invalid or revoked telemetry API key." }, { status: 401 });
    }
    keyId = keyRecord.id;
    actorId = keyRecord.createdBy.id;
    actorEmail = `telemetry:${keyRecord.keyPrefix}`;
  } else {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "admin:config")) {
      return NextResponse.json({ error: "Bearer token or Administrator session required." }, { status: 401 });
    }
    actorId = session.id;
    actorEmail = session.email;
  }

  const body = await request.json();
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid telemetry payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const asset = await prisma.aIAsset.findUnique({ where: { assetCode: parsed.data.assetCode } });
  if (!asset) {
    return NextResponse.json({ error: `Asset "${parsed.data.assetCode}" not found.` }, { status: 404 });
  }

  if (keyId) {
    await prisma.telemetryApiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  if (parsed.data.eventType === "BOUNDARY_BREACH") {
    const payload = parsed.data;
    const [latestAppraisal, profiles, openBreaches] = await Promise.all([
      prisma.aaefAppraisal.findFirst({
        where: { assetId: asset.id },
        include: { dimensionScores: true, assignedProfile: true },
        orderBy: { dueDate: "desc" },
      }),
      prisma.performanceProfile.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.boundaryBreach.findMany({ where: { assetId: asset.id, status: "OPEN" } }),
    ]);

    const result = await prisma.$transaction(async (tx) => {
      const breach = await tx.boundaryBreach.create({
        data: {
          assetId: asset.id,
          appraisalId: latestAppraisal?.id ?? null,
          occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
          severity: payload.severity,
          description: payload.description,
          remediation: payload.remediation ?? "Automated telemetry alert: awaiting investigation.",
          status: "OPEN",
          reportedById: actorId!,
        },
      });

      let reassignedProfileName: string | null = null;

      if (latestAppraisal) {
        const byDim = new Map(latestAppraisal.dimensionScores.map((d) => [d.dimension, d.score]));
        const hasSevere =
          payload.severity === "CRITICAL" ||
          payload.severity === "HIGH" ||
          openBreaches.some((b) => b.severity === "CRITICAL" || b.severity === "HIGH");

        const evalResult = assignPerformanceProfile(
          {
            taskCompetence: byDim.get("TASK_COMPETENCE") ?? 2,
            judgementQuality: byDim.get("JUDGEMENT_QUALITY") ?? 2,
            collaborationEffectiveness: byDim.get("COLLABORATION_EFFECTIVENESS") ?? 2,
            boundaryPassed: false,
            openBreachCount: openBreaches.length + 1,
            hasCriticalOrHighBreach: hasSevere,
          },
          profiles.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            governanceConsequence: p.governanceConsequence,
            requiredAction: p.requiredAction,
            ruleConfigJson: p.ruleConfigJson as unknown as ProfileRuleConfig,
          })),
        );

        await tx.aaefAppraisal.update({
          where: { id: latestAppraisal.id },
          data: {
            assignedProfileId: evalResult.profile.id,
            assignmentReason: `${evalResult.reason} (Triggered by telemetry breach ${breach.id})`,
          },
        });
        await tx.aaefDimensionScore.updateMany({
          where: { appraisalId: latestAppraisal.id, dimension: "BOUNDARY_ADHERENCE" },
          data: { score: 0 },
        });
        reassignedProfileName = evalResult.profile.name;
      }

      await writeAuditLog(tx, {
        actorId,
        actorEmail,
        action: "TELEMETRY_BOUNDARY_BREACH",
        entityType: "BOUNDARY_BREACH",
        entityId: breach.id,
        afterState: {
          assetCode: asset.assetCode,
          severity: breach.severity,
          reassignedProfileName,
        },
      });

      await dispatchAlert(tx, {
        eventType: "AAEF_PROFILE_DOWNGRADE",
        title: `Telemetry Breach on ${asset.assetCode}`,
        message: `${payload.severity} boundary breach ingested: ${payload.description}${reassignedProfileName ? `. Profile updated to ${reassignedProfileName}.` : ""}`,
        severity: payload.severity === "CRITICAL" || payload.severity === "HIGH" ? "CRITICAL" : "WARNING",
        entityType: "AI_ASSET",
        entityId: asset.id,
      });

      const nextGate = evaluateGateFromBreachSeverity(asset.runtimeGateStatus, payload.severity);
      if (nextGate !== asset.runtimeGateStatus) {
        await tx.aIAsset.update({
          where: { id: asset.id },
          data: {
            runtimeGateStatus: nextGate,
            runtimeGateReason: `Auto-${nextGate.toLowerCase()} by ${payload.severity} telemetry breach ${breach.id}`,
          },
        });
      }

      return { breach, reassignedProfileName, runtimeGateStatus: nextGate };
    });

    return NextResponse.json({ status: "ingested", ...result }, { status: 201 });
  }

  if (parsed.data.eventType === "GUARDRAIL_EVENT") {
    const payload = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      let breachId: string | null = null;
      if (!payload.blocked || payload.severity === "CRITICAL" || payload.severity === "HIGH") {
        const breach = await tx.boundaryBreach.create({
          data: {
            assetId: asset.id,
            occurredAt: new Date(),
            severity: payload.severity,
            description: `[Guardrail: ${payload.gateway} / ${payload.violationType}] ${payload.description}`,
            remediation: payload.blocked
              ? "Request blocked by AI Gateway; monitor for repeat attempts."
              : "Unblocked guardrail violation; immediate review required.",
            status: "OPEN",
            reportedById: actorId!,
          },
        });
        breachId = breach.id;
      }

      await writeAuditLog(tx, {
        actorId,
        actorEmail,
        action: "TELEMETRY_GUARDRAIL_EVENT",
        entityType: "AI_ASSET",
        entityId: asset.id,
        afterState: {
          assetCode: asset.assetCode,
          gateway: payload.gateway,
          violationType: payload.violationType,
          blocked: payload.blocked,
          severity: payload.severity,
          breachId,
        },
      });

      await dispatchAlert(tx, {
        eventType: "GUARDRAIL_VIOLATION",
        title: `${payload.gateway} ${payload.blocked ? "Blocked" : "Flagged"} ${payload.violationType} on ${asset.assetCode}`,
        message: payload.description,
        severity: payload.severity === "CRITICAL" || !payload.blocked ? "CRITICAL" : "WARNING",
        entityType: "AI_ASSET",
        entityId: asset.id,
      });

      return { guardrailEvent: true, breachId, blocked: payload.blocked };
    });

    return NextResponse.json({ status: "ingested", ...result }, { status: 201 });
  }

  // ROI_METRIC ingestion (always marked MEASURED)
  const payload = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    if (payload.metricType === "COST") {
      const category = (Object.values(CostCategory).includes(payload.category as CostCategory)
        ? payload.category
        : "INFERENCE_COMPUTE") as CostCategory;

      const cost = await tx.costItem.create({
        data: {
          assetId: asset.id,
          category,
          description: `[Telemetry] ${payload.description}`,
          amount: payload.amount,
          currency: payload.currency,
          quarter: payload.quarter,
          isRecurring: false,
        },
      });
      await writeAuditLog(tx, {
        actorId,
        actorEmail,
        action: "TELEMETRY_ROI_COST",
        entityType: "COST_ITEM",
        entityId: cost.id,
        afterState: { assetCode: asset.assetCode, amount: cost.amount, currency: cost.currency, quarter: cost.quarter },
      });
      const budgetCheck = await checkQuarterlyBudgetAndAlert(tx, {
        assetId: asset.id,
        assetCode: asset.assetCode,
        quarter: payload.quarter,
        quarterlyBudgetAmount: asset.quarterlyBudgetAmount,
        quarterlyBudgetCurrency: asset.quarterlyBudgetCurrency,
      });
      return { costItem: cost, budgetCheck };
    }

    const category = (Object.values(BenefitCategory).includes(payload.category as BenefitCategory)
      ? payload.category
      : "PRODUCTIVITY_HOURS") as BenefitCategory;

    const benefit = await tx.benefitItem.create({
      data: {
        assetId: asset.id,
        category,
        description: `[Telemetry] ${payload.description}`,
        plannedAmount: payload.amount,
        actualAmount: payload.amount,
        currency: payload.currency,
        quarter: payload.quarter,
        confidence: "MEASURED",
        methodologyNote: "Automatically ingested as Measured telemetry.",
      },
    });
    await writeAuditLog(tx, {
      actorId,
      actorEmail,
      action: "TELEMETRY_ROI_BENEFIT",
      entityType: "BENEFIT_ITEM",
      entityId: benefit.id,
      afterState: {
        assetCode: asset.assetCode,
        actualAmount: benefit.actualAmount,
        currency: benefit.currency,
        confidence: "MEASURED",
      },
    });
    return { benefitItem: benefit };
  });

  return NextResponse.json({ status: "ingested", ...result }, { status: 201 });
}
