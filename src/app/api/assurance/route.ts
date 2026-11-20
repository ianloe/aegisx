import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BomComponentType,
  Currency,
  DataSensitivity,
  DataSourceType,
  EvalType,
  ExceptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { convertCurrency } from "@/lib/governance/budget-and-gate";

function getCurrentQuarter(date = new Date()): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "assets:read")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const quarter = getCurrentQuarter();

  const [assets, exceptions, attestations, incidents] = await Promise.all([
    prisma.aIAsset.findMany({
      include: {
        businessUnit: { select: { name: true } },
        bomComponents: { orderBy: { createdAt: "desc" } },
        dataSources: { orderBy: { createdAt: "desc" } },
        evalScorecards: { orderBy: { evaluatedAt: "desc" } },
        costItems: {
          where: { quarter },
          select: { amount: true, currency: true },
        },
      },
      orderBy: { assetCode: "asc" },
    }),
    prisma.policyException.findMany({
      include: { asset: { select: { id: true, assetCode: true, name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.policyAttestation.findMany({
      orderBy: { attestedAt: "desc" },
    }),
    prisma.incident.findMany({
      include: { asset: { select: { assetCode: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 30,
    }),
  ]);

  const enrichedAssets = assets.map((a) => {
    const quarterlySpend = a.costItems.reduce(
      (sum, c) => sum + convertCurrency(c.amount, c.currency, a.quarterlyBudgetCurrency),
      0,
    );
    return {
      id: a.id,
      assetCode: a.assetCode,
      name: a.name,
      businessUnit: a.businessUnit.name,
      lifecycleStage: a.lifecycleStage,
      autonomyLevel: a.autonomyLevel,
      runtimeGateStatus: a.runtimeGateStatus,
      runtimeGateReason: a.runtimeGateReason,
      quarterlyBudgetAmount: a.quarterlyBudgetAmount,
      quarterlyBudgetCurrency: a.quarterlyBudgetCurrency,
      quarterlySpend: Number(quarterlySpend.toFixed(2)),
      bomComponents: a.bomComponents,
      dataSources: a.dataSources,
      evalScorecards: a.evalScorecards,
    };
  });

  return NextResponse.json({
    quarter,
    assets: enrichedAssets,
    exceptions,
    attestations,
    incidents,
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ADD_BOM_COMPONENT"),
    assetId: z.string().min(1),
    componentType: z.nativeEnum(BomComponentType),
    name: z.string().min(1),
    version: z.string().min(1).default("1.0"),
    provider: z.string().optional(),
    isApproved: z.boolean().default(true),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("ADD_DATA_SOURCE"),
    assetId: z.string().min(1),
    sourceName: z.string().min(1),
    sourceType: z.nativeEnum(DataSourceType),
    classification: z.nativeEnum(DataSensitivity).default(DataSensitivity.INTERNAL),
    piiIncluded: z.boolean().default(false),
    retentionPolicy: z.string().optional(),
  }),
  z.object({
    action: z.literal("ADD_EVAL_SCORECARD"),
    assetId: z.string().min(1),
    suiteName: z.string().min(1),
    evalType: z.nativeEnum(EvalType),
    passRate: z.number().min(0).max(100),
    threshold: z.number().min(0).max(100).default(85),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("ADD_POLICY_EXCEPTION"),
    assetId: z.string().optional().nullable(),
    title: z.string().min(2),
    businessUnit: z.string().min(1),
    justification: z.string().min(4),
    compensatingControls: z.string().min(4),
    expiresAt: z.string().min(4),
  }),
  z.object({
    action: z.literal("ADD_POLICY_ATTESTATION"),
    policyName: z.string().min(2).default("Enterprise Acceptable AI Use Policy"),
    policyVersion: z.string().min(1).default("2026.1"),
    businessUnit: z.string().min(1),
    attestedByName: z.string().min(2),
    attestedByEmail: z.string().email(),
    trainingCompleted: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("SET_BUDGET_CAP"),
    assetId: z.string().min(1),
    quarterlyBudgetAmount: z.number().nonnegative().nullable(),
    quarterlyBudgetCurrency: z.nativeEnum(Currency).default(Currency.SGD),
  }),
  z.object({
    action: z.literal("SET_INCIDENT_TIMER"),
    incidentId: z.string().min(1),
    regulatoryFramework: z.string().min(2),
    hoursUntilDue: z.number().int().min(1).max(720).default(72),
  }),
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!hasPermission(session.role, "assets:write") && !hasPermission(session.role, "admin:config"))) {
    return NextResponse.json({ error: "Write permission required." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.action === "ADD_BOM_COMPONENT") {
    const created = await prisma.aiBomComponent.create({
      data: {
        assetId: data.assetId,
        componentType: data.componentType,
        name: data.name,
        version: data.version,
        provider: data.provider || null,
        isApproved: data.isApproved,
        notes: data.notes || null,
      },
    });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "AI_BOM_COMPONENT_ADDED",
      entityType: "AI_ASSET",
      entityId: data.assetId,
      afterState: { name: created.name, componentType: created.componentType, version: created.version },
    });
    return NextResponse.json({ component: created }, { status: 201 });
  }

  if (data.action === "ADD_DATA_SOURCE") {
    const created = await prisma.dataSourceLink.create({
      data: {
        assetId: data.assetId,
        sourceName: data.sourceName,
        sourceType: data.sourceType,
        classification: data.classification,
        piiIncluded: data.piiIncluded,
        retentionPolicy: data.retentionPolicy || null,
      },
    });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "DATA_SOURCE_LINKED",
      entityType: "AI_ASSET",
      entityId: data.assetId,
      afterState: { sourceName: created.sourceName, classification: created.classification, piiIncluded: created.piiIncluded },
    });
    return NextResponse.json({ dataSource: created }, { status: 201 });
  }

  if (data.action === "ADD_EVAL_SCORECARD") {
    const passed = data.passRate >= data.threshold;
    const created = await prisma.evalScorecard.create({
      data: {
        assetId: data.assetId,
        suiteName: data.suiteName,
        evalType: data.evalType,
        passRate: data.passRate,
        threshold: data.threshold,
        passed,
        notes: data.notes || null,
      },
    });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "EVAL_SCORECARD_RECORDED",
      entityType: "AI_ASSET",
      entityId: data.assetId,
      afterState: { suiteName: created.suiteName, passRate: created.passRate, passed: created.passed },
    });
    return NextResponse.json({ scorecard: created }, { status: 201 });
  }

  if (data.action === "ADD_POLICY_EXCEPTION") {
    if (!hasPermission(session.role, "aaef:signoff") && !hasPermission(session.role, "admin:config")) {
      return NextResponse.json({ error: "Governance Office or Admin approval required for exceptions." }, { status: 403 });
    }
    const created = await prisma.policyException.create({
      data: {
        assetId: data.assetId || null,
        title: data.title,
        businessUnit: data.businessUnit,
        justification: data.justification,
        compensatingControls: data.compensatingControls,
        expiresAt: new Date(data.expiresAt),
        approvedBy: session.name,
      },
      include: { asset: { select: { id: true, assetCode: true, name: true } } },
    });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "POLICY_EXCEPTION_CREATED",
      entityType: "POLICY_EXCEPTION",
      entityId: created.id,
      afterState: { title: created.title, businessUnit: created.businessUnit, expiresAt: created.expiresAt },
    });
    return NextResponse.json({ exception: created }, { status: 201 });
  }

  if (data.action === "ADD_POLICY_ATTESTATION") {
    const created = await prisma.policyAttestation.create({
      data: {
        policyName: data.policyName,
        policyVersion: data.policyVersion,
        businessUnit: data.businessUnit,
        attestedByName: data.attestedByName,
        attestedByEmail: data.attestedByEmail,
        trainingCompleted: data.trainingCompleted,
      },
    });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "POLICY_ATTESTATION_RECORDED",
      entityType: "POLICY_ATTESTATION",
      entityId: created.id,
      afterState: { businessUnit: created.businessUnit, attestedByEmail: created.attestedByEmail },
    });
    return NextResponse.json({ attestation: created }, { status: 201 });
  }

  if (data.action === "SET_BUDGET_CAP") {
    const updated = await prisma.aIAsset.update({
      where: { id: data.assetId },
      data: {
        quarterlyBudgetAmount: data.quarterlyBudgetAmount,
        quarterlyBudgetCurrency: data.quarterlyBudgetCurrency,
      },
    });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "FINOPS_BUDGET_CAP_UPDATED",
      entityType: "AI_ASSET",
      entityId: updated.id,
      afterState: {
        assetCode: updated.assetCode,
        quarterlyBudgetAmount: updated.quarterlyBudgetAmount,
        quarterlyBudgetCurrency: updated.quarterlyBudgetCurrency,
      },
    });
    return NextResponse.json({ asset: updated });
  }

  // SET_INCIDENT_TIMER
  const dueAt = new Date(Date.now() + data.hoursUntilDue * 3600 * 1000);
  const updatedIncident = await prisma.incident.update({
    where: { id: data.incidentId },
    data: {
      regulatoryFramework: data.regulatoryFramework,
      notificationDueAt: dueAt,
    },
    include: { asset: { select: { assetCode: true, name: true } } },
  });
  await writeAuditLog(prisma, {
    actorId: session.id,
    actorEmail: session.email,
    action: "INCIDENT_REGULATORY_TIMER_SET",
    entityType: "INCIDENT",
    entityId: updatedIncident.id,
    afterState: { regulatoryFramework: data.regulatoryFramework, notificationDueAt: dueAt },
  });
  return NextResponse.json({ incident: updatedIncident });
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE_EXCEPTION_STATUS"),
    id: z.string().min(1),
    status: z.nativeEnum(ExceptionStatus),
  }),
  z.object({
    action: z.literal("TOGGLE_BOM_APPROVAL"),
    id: z.string().min(1),
    isApproved: z.boolean(),
  }),
  z.object({
    action: z.literal("MARK_INCIDENT_REPORTED"),
    id: z.string().min(1),
  }),
]);

export async function PATCH(request: Request) {
  const session = await getSession();
  if (
    !session ||
    (!hasPermission(session.role, "aaef:signoff") && !hasPermission(session.role, "admin:config"))
  ) {
    return NextResponse.json({ error: "Governance Office or Administrator access required." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  if (parsed.data.action === "UPDATE_EXCEPTION_STATUS") {
    const updated = await prisma.policyException.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
      include: { asset: { select: { id: true, assetCode: true, name: true } } },
    });
    return NextResponse.json({ exception: updated });
  }

  if (parsed.data.action === "TOGGLE_BOM_APPROVAL") {
    const updated = await prisma.aiBomComponent.update({
      where: { id: parsed.data.id },
      data: { isApproved: parsed.data.isApproved },
    });
    return NextResponse.json({ component: updated });
  }

  const updated = await prisma.incident.update({
    where: { id: parsed.data.id },
    data: { reportedToRegulatorAt: new Date() },
    include: { asset: { select: { assetCode: true, name: true } } },
  });
  return NextResponse.json({ incident: updated });
}
