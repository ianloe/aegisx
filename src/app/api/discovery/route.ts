import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AssetType,
  AutonomyLevel,
  DataSensitivity,
  DiscoveryStatus,
  LifecycleStage,
  SourcingType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE_STATUS"),
    id: z.string().min(1),
    status: z.nativeEnum(DiscoveryStatus),
    notes: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("PROMOTE_TO_ASSET"),
    id: z.string().min(1),
    assetName: z.string().min(2).optional(),
    businessUnit: z.string().min(1).optional(),
  }),
]);

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "assets:read")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const candidates = await prisma.shadowAiCandidate.findMany({
    include: {
      matchedAsset: {
        select: { id: true, assetCode: true, name: true, lifecycleStage: true },
      },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  return NextResponse.json({ candidates });
}

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
    return NextResponse.json({ error: "Invalid request payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action === "UPDATE_STATUS") {
    const existing = await prisma.shadowAiCandidate.findUnique({ where: { id: parsed.data.id } });
    if (!existing) {
      return NextResponse.json({ error: "Shadow AI candidate not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const candidate = await tx.shadowAiCandidate.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.action === "UPDATE_STATUS" ? parsed.data.status : existing.status,
          notes: parsed.data.action === "UPDATE_STATUS" ? (parsed.data.notes ?? existing.notes) : existing.notes,
        },
        include: {
          matchedAsset: { select: { id: true, assetCode: true, name: true, lifecycleStage: true } },
        },
      });

      await writeAuditLog(tx, {
        actorId: session.id,
        actorEmail: session.email,
        action: "SHADOW_AI_STATUS_UPDATED",
        entityType: "SHADOW_AI",
        entityId: candidate.id,
        beforeState: { status: existing.status },
        afterState: { status: candidate.status, domain: candidate.domain },
      });

      return candidate;
    });

    return NextResponse.json({ candidate: updated });
  }

  // PROMOTE_TO_ASSET
  const existing = await prisma.shadowAiCandidate.findUnique({ where: { id: parsed.data.id } });
  if (!existing) {
    return NextResponse.json({ error: "Shadow AI candidate not found" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingAssets = await tx.aIAsset.findMany({ select: { assetCode: true } });
    const maxNum = existingAssets.reduce((max, a) => {
      const m = a.assetCode.match(/AI-(\d+)/i);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    const nextAssetCode = `AI-${String(maxNum + 1).padStart(3, "0")}`;

    const assetName =
      parsed.data.action === "PROMOTE_TO_ASSET" && parsed.data.assetName
        ? parsed.data.assetName
        : `${existing.providerName} (${existing.businessUnit})`;
    const buName =
      parsed.data.action === "PROMOTE_TO_ASSET" && parsed.data.businessUnit
        ? parsed.data.businessUnit
        : existing.businessUnit;
    const buRecord =
      (await tx.businessUnit.findFirst({
        where: { name: { equals: buName, mode: "insensitive" } },
      })) ?? (await tx.businessUnit.findFirstOrThrow());

    const asset = await tx.aIAsset.create({
      data: {
        assetCode: nextAssetCode,
        name: assetName,
        description: `Promoted from Shadow AI discovery (${existing.source} traffic to ${existing.domain}; ${existing.requestCount} requests observed for ${buName}).`,
        businessUnitId: buRecord.id,
        country: "Singapore",
        assetType: AssetType.VENDOR_FEATURE,
        sourcingType: SourcingType.VENDOR,
        autonomyLevel: AutonomyLevel.ASSISTIVE,
        dataSensitivity: DataSensitivity.INTERNAL,
        lifecycleStage: LifecycleStage.IDEA,
        jurisdictions: ["Singapore"],
        ownerId: session.id,
        vendorName: existing.providerName,
      },
    });

    const candidate = await tx.shadowAiCandidate.update({
      where: { id: existing.id },
      data: {
        status: "SANCTIONED",
        matchedAssetId: asset.id,
        notes: existing.notes
          ? `${existing.notes}\nPromoted to ${asset.assetCode}.`
          : `Promoted to ${asset.assetCode}.`,
      },
      include: {
        matchedAsset: { select: { id: true, assetCode: true, name: true, lifecycleStage: true } },
      },
    });

    await writeAuditLog(tx, {
      actorId: session.id,
      actorEmail: session.email,
      action: "SHADOW_AI_PROMOTED_TO_ASSET",
      entityType: "AI_ASSET",
      entityId: asset.id,
      afterState: {
        assetCode: asset.assetCode,
        domain: existing.domain,
        source: existing.source,
        businessUnit: buName,
      },
    });

    return { candidate, asset };
  });

  return NextResponse.json(result, { status: 201 });
}
