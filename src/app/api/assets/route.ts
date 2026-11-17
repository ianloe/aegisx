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

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const businessUnitId = searchParams.get("businessUnitId") || undefined;
  const country = searchParams.get("country") || undefined;
  const lifecycleStage = searchParams.get("lifecycleStage") as LifecycleStage | null;
  const autonomyLevel = searchParams.get("autonomyLevel") as AutonomyLevel | null;
  const sourcingType = searchParams.get("sourcingType") as SourcingType | null;
  const isAgentParam = searchParams.get("isAgent");
  const q = searchParams.get("q")?.trim();

  const assets = await prisma.aIAsset.findMany({
    where: {
      ...(businessUnitId ? { businessUnitId } : {}),
      ...(country ? { country } : {}),
      ...(lifecycleStage ? { lifecycleStage } : {}),
      ...(autonomyLevel ? { autonomyLevel } : {}),
      ...(sourcingType ? { sourcingType } : {}),
      ...(isAgentParam === "true" ? { isAgent: true } : isAgentParam === "false" ? { isAgent: false } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { assetCode: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { vendorName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      businessUnit: { select: { id: true, code: true, name: true, country: true } },
      owner: { select: { id: true, name: true, email: true } },
      overseer: { select: { id: true, name: true, email: true } },
      frameAssessments: { orderBy: { assessedAt: "desc" }, take: 1, select: { id: true, overallScore: true, assessedAt: true } },
      aaefAppraisals: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 1,
        include: { assignedProfile: { select: { code: true, name: true } } },
      },
      _count: { select: { risks: true, incidents: true } },
    },
    orderBy: { assetCode: "asc" },
  });

  return NextResponse.json({ assets });
}

const createAssetSchema = z.object({
  assetCode: z.string().min(2).optional(),
  name: z.string().min(2),
  description: z.string().min(4),
  assetType: z.nativeEnum(AssetType),
  businessUnitId: z.string().min(1),
  country: z.string().min(2),
  ownerId: z.string().nullable().optional(),
  overseerId: z.string().nullable().optional(),
  escalationPath: z.string().nullable().optional(),
  lifecycleStage: z.nativeEnum(LifecycleStage),
  autonomyLevel: z.nativeEnum(AutonomyLevel),
  dataSensitivity: z.nativeEnum(DataSensitivity),
  jurisdictions: z.array(z.string()).default(["Singapore"]),
  sourcingType: z.nativeEnum(SourcingType),
  vendorName: z.string().nullable().optional(),
  isAgent: z.boolean().default(false),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("assets:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI asset input.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const count = await prisma.aIAsset.count();
  const assetCode = data.assetCode?.trim() || `AI-${String(count + 1).padStart(3, "0")}`;

  const existing = await prisma.aIAsset.findUnique({ where: { assetCode } });
  if (existing) {
    return NextResponse.json({ error: `Asset code ${assetCode} already exists.` }, { status: 409 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const asset = await tx.aIAsset.create({
      data: {
        assetCode,
        name: data.name.trim(),
        description: data.description.trim(),
        assetType: data.assetType,
        businessUnitId: data.businessUnitId,
        country: data.country.trim(),
        ownerId: data.ownerId || null,
        overseerId: data.overseerId || null,
        escalationPath: data.escalationPath || null,
        rolesLastReviewedAt: data.ownerId ? new Date() : null,
        lifecycleStage: data.lifecycleStage,
        autonomyLevel: data.autonomyLevel,
        dataSensitivity: data.dataSensitivity,
        jurisdictions: data.jurisdictions,
        sourcingType: data.sourcingType,
        vendorName: data.sourcingType === "VENDOR" ? data.vendorName || null : null,
        isAgent: data.isAgent,
      },
      include: {
        businessUnit: { select: { id: true, code: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_ASSET",
      entityType: "AI_ASSET",
      entityId: asset.id,
      afterState: asset,
    });

    return asset;
  });

  return NextResponse.json({ asset: created }, { status: 201 });
}
