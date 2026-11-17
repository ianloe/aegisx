import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AssetType,
  AutonomyLevel,
  DataSensitivity,
  LifecycleStage,
  SourcingType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const asset = await prisma.aIAsset.findUnique({
    where: { id },
    include: {
      businessUnit: true,
      owner: { select: { id: true, name: true, email: true } },
      overseer: { select: { id: true, name: true, email: true } },
      frameAssessments: {
        orderBy: { assessedAt: "desc" },
        include: {
          assessor: { select: { id: true, name: true } },
          scores: { include: { criterion: true } },
        },
      },
      authorityRules: { orderBy: [{ version: "desc" }, { createdAt: "desc" }] },
      aaefAppraisals: {
        orderBy: { dueDate: "desc" },
        include: {
          assignedProfile: true,
          overrideProfile: true,
          dimensionScores: true,
        },
      },
      boundaryBreaches: { orderBy: { occurredAt: "desc" } },
      risks: { orderBy: { riskCode: "asc" } },
      incidents: { orderBy: { occurredAt: "desc" } },
      costItems: { orderBy: { quarter: "asc" } },
      benefitItems: { orderBy: { quarter: "asc" } },
      actions: { orderBy: { dueDate: "asc" }, include: { owner: { select: { id: true, name: true } } } },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "AI asset not found." }, { status: 404 });
  }

  return NextResponse.json({ asset });
}

const updateAssetSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().min(4).optional(),
  assetType: z.nativeEnum(AssetType).optional(),
  businessUnitId: z.string().optional(),
  country: z.string().min(2).optional(),
  ownerId: z.string().nullable().optional(),
  overseerId: z.string().nullable().optional(),
  escalationPath: z.string().nullable().optional(),
  rolesLastReviewedAt: z.string().datetime().nullable().optional(),
  lifecycleStage: z.nativeEnum(LifecycleStage).optional(),
  autonomyLevel: z.nativeEnum(AutonomyLevel).optional(),
  dataSensitivity: z.nativeEnum(DataSensitivity).optional(),
  jurisdictions: z.array(z.string()).optional(),
  sourcingType: z.nativeEnum(SourcingType).optional(),
  vendorName: z.string().nullable().optional(),
  isAgent: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession("assets:write");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const before = await prisma.aIAsset.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "AI asset not found." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    const asset = await tx.aIAsset.update({
      where: { id },
      data: {
        ...data,
        rolesLastReviewedAt:
          data.rolesLastReviewedAt !== undefined
            ? data.rolesLastReviewedAt
              ? new Date(data.rolesLastReviewedAt)
              : null
            : before.rolesLastReviewedAt,
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPDATE_ASSET",
      entityType: "AI_ASSET",
      entityId: asset.id,
      beforeState: before,
      afterState: asset,
    });
    return asset;
  });

  return NextResponse.json({ asset: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const before = await prisma.aIAsset.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "AI asset not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.aIAsset.delete({ where: { id } });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "DELETE_ASSET",
      entityType: "AI_ASSET",
      entityId: id,
      beforeState: before,
    });
  });

  return NextResponse.json({ ok: true });
}
