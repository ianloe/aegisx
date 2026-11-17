import { NextResponse } from "next/server";
import { z } from "zod";
import { FrameDimension, RiskCategory, RiskStatus, RiskTreatment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") || undefined;

  const risks = await prisma.risk.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      asset: {
        select: {
          id: true,
          assetCode: true,
          name: true,
          businessUnit: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, name: true } },
      controls: { include: { control: true } },
    },
    orderBy: { riskCode: "asc" },
  });

  return NextResponse.json({ risks });
}

const createRiskSchema = z.object({
  riskCode: z.string().optional(),
  assetId: z.string().min(1),
  frameDimension: z.nativeEnum(FrameDimension).nullable().optional(),
  title: z.string().min(3),
  description: z.string().min(4),
  category: z.nativeEnum(RiskCategory),
  cause: z.string().min(2),
  impactDescription: z.string().min(2),
  inherentLikelihood: z.number().int().min(1).max(5),
  inherentImpact: z.number().int().min(1).max(5),
  residualLikelihood: z.number().int().min(1).max(5),
  residualImpact: z.number().int().min(1).max(5),
  financialExposure: z.number().nonnegative().nullable().optional(),
  ownerId: z.string().min(1),
  treatment: z.nativeEnum(RiskTreatment),
  reviewDate: z.string().min(4),
  status: z.nativeEnum(RiskStatus).default("OPEN"),
  controlIds: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("risks:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createRiskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid risk input.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const count = await prisma.risk.count();
  const riskCode = data.riskCode?.trim() || `RSK-${String(count + 1).padStart(3, "0")}`;

  const created = await prisma.$transaction(async (tx) => {
    const risk = await tx.risk.create({
      data: {
        riskCode,
        assetId: data.assetId,
        frameDimension: data.frameDimension ?? null,
        title: data.title.trim(),
        description: data.description.trim(),
        category: data.category,
        cause: data.cause.trim(),
        impactDescription: data.impactDescription.trim(),
        inherentLikelihood: data.inherentLikelihood,
        inherentImpact: data.inherentImpact,
        residualLikelihood: data.residualLikelihood,
        residualImpact: data.residualImpact,
        financialExposure: data.financialExposure ?? data.residualLikelihood * data.residualImpact * 10000,
        ownerId: data.ownerId,
        treatment: data.treatment,
        reviewDate: new Date(data.reviewDate),
        status: data.status,
        controls: {
          create: data.controlIds.map((controlId) => ({ controlId })),
        },
      },
      include: {
        asset: { select: { id: true, assetCode: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_RISK",
      entityType: "RISK",
      entityId: risk.id,
      afterState: risk,
    });

    return risk;
  });

  return NextResponse.json({ risk: created }, { status: 201 });
}

const patchRiskSchema = z.object({
  id: z.string().min(1),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  status: z.nativeEnum(RiskStatus).optional(),
  treatment: z.nativeEnum(RiskTreatment).optional(),
  financialExposure: z.number().nonnegative().nullable().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiSession("risks:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = patchRiskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid risk update." }, { status: 400 });
  }

  const before = await prisma.risk.findUnique({ where: { id: parsed.data.id } });
  if (!before) {
    return NextResponse.json({ error: "Risk not found." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const risk = await tx.risk.update({
      where: { id: parsed.data.id },
      data: {
        residualLikelihood: parsed.data.residualLikelihood ?? before.residualLikelihood,
        residualImpact: parsed.data.residualImpact ?? before.residualImpact,
        status: parsed.data.status ?? before.status,
        treatment: parsed.data.treatment ?? before.treatment,
        financialExposure:
          parsed.data.financialExposure !== undefined ? parsed.data.financialExposure : before.financialExposure,
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPDATE_RISK",
      entityType: "RISK",
      entityId: risk.id,
      beforeState: before,
      afterState: risk,
    });
    return risk;
  });

  return NextResponse.json({ risk: updated });
}
