import crypto from "crypto";
import { NextResponse } from "next/server";
import { CostCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { assignPerformanceProfile, ProfileRuleConfig } from "@/lib/governance/aaef-engine";
import { dispatchAlert } from "@/lib/governance/alerts";
import { normalizePydanticTelemetry } from "@/lib/governance/pydantic-telemetry";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function authenticateTelemetryRequest(request: Request): Promise<{
  actorId: string;
  actorEmail: string;
  keyId: string | null;
} | null> {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    const keyHash = hashToken(rawToken);
    const keyRecord = await prisma.telemetryApiKey.findUnique({
      where: { keyHash },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    if (!keyRecord || !keyRecord.isActive) return null;
    return {
      actorId: keyRecord.createdBy.id,
      actorEmail: `telemetry:${keyRecord.keyPrefix}`,
      keyId: keyRecord.id,
    };
  }

  const session = await getSession();
  if (!session || !hasPermission(session.role, "admin:config")) return null;
  return {
    actorId: session.id,
    actorEmail: session.email,
    keyId: null,
  };
}

export async function POST(request: Request) {
  const auth = await authenticateTelemetryRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Valid Bearer telemetry API key or Administrator session required." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const url = new URL(request.url);
  const queryAssetCode = url.searchParams.get("assetCode");
  const events = normalizePydanticTelemetry(body, queryAssetCode);

  if (events.length === 0) {
    return NextResponse.json(
      {
        error:
          "No valid PydanticAI or OTLP telemetry events found. Provide assetCode in the payload, aegis.asset_code in OTLP attributes, or ?assetCode= in the query string.",
      },
      { status: 400 },
    );
  }

  if (auth.keyId) {
    await prisma.telemetryApiKey.update({
      where: { id: auth.keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  const profiles = await prisma.performanceProfile.findMany({ orderBy: { sortOrder: "asc" } });
  const results: Array<{
    assetCode: string;
    agentName: string;
    status: "ok" | "breach";
    costItemId?: string;
    breachId?: string;
    reassignedProfileName?: string | null;
  }> = [];
  const missingAssets: string[] = [];

  for (const ev of events) {
    const asset = await prisma.aIAsset.findUnique({ where: { assetCode: ev.assetCode } });
    if (!asset) {
      missingAssets.push(ev.assetCode);
      continue;
    }

    const [latestAppraisal, openBreaches] = await Promise.all([
      prisma.aaefAppraisal.findFirst({
        where: { assetId: asset.id },
        include: { dimensionScores: true },
        orderBy: { dueDate: "desc" },
      }),
      ev.status === "breach"
        ? prisma.boundaryBreach.findMany({ where: { assetId: asset.id, status: "OPEN" } })
        : Promise.resolve([]),
    ]);

    const txResult = await prisma.$transaction(async (tx) => {
      let costItemId: string | undefined;
      let breachId: string | undefined;
      let reassignedProfileName: string | null = null;

      if (ev.costAmount != null && ev.costAmount > 0) {
        const cost = await tx.costItem.create({
          data: {
            assetId: asset.id,
            category: CostCategory.INFERENCE_COMPUTE,
            description: `[Telemetry: ${ev.source}] ${ev.agentName} (${ev.model || "unknown model"}, ${ev.totalTokens} tokens)`,
            amount: ev.costAmount,
            currency: ev.currency,
            quarter: ev.quarter,
            isRecurring: false,
          },
        });
        costItemId = cost.id;
      }

      if (ev.status === "breach") {
        const breach = await tx.boundaryBreach.create({
          data: {
            assetId: asset.id,
            appraisalId: latestAppraisal?.id ?? null,
            occurredAt: new Date(),
            severity: ev.breachSeverity,
            description: ev.breachReason || `Pydantic agent ${ev.agentName} reported a boundary/runtime error.`,
            remediation: `Automated ${ev.source} telemetry alert (${ev.agentName}): awaiting investigation.`,
            status: "OPEN",
            reportedById: auth.actorId,
          },
        });
        breachId = breach.id;

        if (latestAppraisal) {
          const byDim = new Map(latestAppraisal.dimensionScores.map((d) => [d.dimension, d.score]));
          const hasSevere =
            ev.breachSeverity === "CRITICAL" ||
            ev.breachSeverity === "HIGH" ||
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
              assignmentReason: `${evalResult.reason} (Triggered by ${ev.source} breach ${breach.id})`,
            },
          });
          await tx.aaefDimensionScore.updateMany({
            where: { appraisalId: latestAppraisal.id, dimension: "BOUNDARY_ADHERENCE" },
            data: { score: 0 },
          });
          reassignedProfileName = evalResult.profile.name;
        }

        await dispatchAlert(tx, {
          eventType: "AAEF_PROFILE_DOWNGRADE",
          title: `Pydantic Telemetry Breach on ${asset.assetCode}`,
          message: `${ev.breachSeverity} event from ${ev.agentName}: ${ev.breachReason}${reassignedProfileName ? `. Profile updated to ${reassignedProfileName}.` : ""}`,
          severity: ev.breachSeverity === "CRITICAL" || ev.breachSeverity === "HIGH" ? "CRITICAL" : "WARNING",
          entityType: "AI_ASSET",
          entityId: asset.id,
        });
      }

      await writeAuditLog(tx, {
        actorId: auth.actorId,
        actorEmail: auth.actorEmail,
        action: ev.status === "breach" ? "TELEMETRY_PYDANTIC_BREACH" : "TELEMETRY_PYDANTIC_RUN",
        entityType: "AI_ASSET",
        entityId: asset.id,
        afterState: {
          source: ev.source,
          assetCode: asset.assetCode,
          agentName: ev.agentName,
          model: ev.model,
          requests: ev.requests,
          requestTokens: ev.requestTokens,
          responseTokens: ev.responseTokens,
          totalTokens: ev.totalTokens,
          costAmount: ev.costAmount,
          currency: ev.currency,
          durationMs: ev.durationMs,
          toolCalls: ev.toolCalls,
          breachId,
          costItemId,
          reassignedProfileName,
        },
      });

      return {
        assetCode: asset.assetCode,
        agentName: ev.agentName,
        status: ev.status,
        costItemId,
        breachId,
        reassignedProfileName,
      };
    });

    results.push(txResult);
  }

  if (results.length === 0 && missingAssets.length > 0) {
    return NextResponse.json(
      { error: `Asset "${missingAssets[0]}" not found.`, missingAssets },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      status: "ingested",
      processed: results.length,
      breachesCreated: results.filter((r) => Boolean(r.breachId)).length,
      costItemsCreated: results.filter((r) => Boolean(r.costItemId)).length,
      missingAssets,
      results,
    },
    { status: 201 },
  );
}
