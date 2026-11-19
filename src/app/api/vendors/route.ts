import { NextResponse } from "next/server";
import { z } from "zod";
import { VendorReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const assets = await prisma.aIAsset.findMany({
    where: { sourcingType: "VENDOR" },
    include: {
      businessUnit: { select: { id: true, name: true, code: true } },
      owner: { select: { id: true, name: true } },
      vendorAssessment: {
        include: { reviewer: { select: { id: true, name: true } } },
      },
    },
    orderBy: { assetCode: "asc" },
  });

  return NextResponse.json({ assets });
}

const upsertVendorSchema = z.object({
  assetId: z.string().min(1),
  vendorName: z.string().min(2),
  modelName: z.string().nullable().optional(),
  modelCardUrl: z.string().nullable().optional(),
  dataResidency: z.string().min(2),
  zeroDataRetention: z.boolean(),
  subProcessors: z.string().nullable().optional(),
  contractRenewalDate: z.string().nullable().optional(),
  exitPlanSummary: z.string().nullable().optional(),
  status: z.nativeEnum(VendorReviewStatus),
  notes: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("assets:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = upsertVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vendor assessment.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const saved = await prisma.$transaction(async (tx) => {
    const before = await tx.vendorAssessment.findUnique({ where: { assetId: data.assetId } });
    const assessment = await tx.vendorAssessment.upsert({
      where: { assetId: data.assetId },
      update: {
        vendorName: data.vendorName,
        modelName: data.modelName || null,
        modelCardUrl: data.modelCardUrl || null,
        dataResidency: data.dataResidency,
        zeroDataRetention: data.zeroDataRetention,
        subProcessors: data.subProcessors || null,
        contractRenewalDate: data.contractRenewalDate ? new Date(data.contractRenewalDate) : null,
        exitPlanSummary: data.exitPlanSummary || null,
        status: data.status,
        notes: data.notes || null,
        reviewerId: auth.session.id,
        lastReviewedAt: new Date(),
      },
      create: {
        assetId: data.assetId,
        vendorName: data.vendorName,
        modelName: data.modelName || null,
        modelCardUrl: data.modelCardUrl || null,
        dataResidency: data.dataResidency,
        zeroDataRetention: data.zeroDataRetention,
        subProcessors: data.subProcessors || null,
        contractRenewalDate: data.contractRenewalDate ? new Date(data.contractRenewalDate) : null,
        exitPlanSummary: data.exitPlanSummary || null,
        status: data.status,
        notes: data.notes || null,
        reviewerId: auth.session.id,
        lastReviewedAt: new Date(),
      },
      include: { reviewer: { select: { id: true, name: true } } },
    });

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPSERT_VENDOR_ASSESSMENT",
      entityType: "VENDOR_ASSESSMENT",
      entityId: assessment.id,
      beforeState: before,
      afterState: {
        assetId: assessment.assetId,
        vendorName: assessment.vendorName,
        zeroDataRetention: assessment.zeroDataRetention,
        status: assessment.status,
      },
    });

    return assessment;
  });

  return NextResponse.json({ assessment: saved });
}
