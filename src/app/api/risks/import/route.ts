import { NextResponse } from "next/server";
import { FrameDimension, RiskCategory, RiskStatus, RiskTreatment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { parseCsv } from "@/lib/csv";
import { writeAuditLog } from "@/lib/audit";

const VALID_CATEGORIES = new Set(Object.values(RiskCategory));
const VALID_TREATMENTS = new Set(Object.values(RiskTreatment));
const VALID_STATUSES = new Set(Object.values(RiskStatus));

export async function POST(request: Request) {
  const auth = await requireApiSession("risks:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const csvText = String(body.csv || "");
  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV content is empty." }, { status: 400 });
  }
  if (csvText.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "CSV payload exceeds maximum size of 5 MB." }, { status: 400 });
  }

  const { rows } = parseCsv(csvText);
  if (rows.length > 5000) {
    return NextResponse.json({ error: "CSV import is limited to 5,000 rows per request." }, { status: 400 });
  }
  const [assets, users] = await Promise.all([
    prisma.aIAsset.findMany({ select: { id: true, assetCode: true } }),
    prisma.user.findMany({ select: { id: true, email: true } }),
  ]);
  const assetByCode = new Map(assets.map((a) => [a.assetCode.toUpperCase(), a.id]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  const errors: Array<{ row: number; message: string }> = [];
  const validRows: Array<{
    riskCode: string;
    assetId: string;
    frameDimension: FrameDimension | null;
    title: string;
    description: string;
    category: RiskCategory;
    cause: string;
    impactDescription: string;
    inherentLikelihood: number;
    inherentImpact: number;
    residualLikelihood: number;
    residualImpact: number;
    financialExposure: number;
    ownerId: string;
    treatment: RiskTreatment;
    reviewDate: Date;
    status: RiskStatus;
  }> = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const riskCode = r.riskCode?.trim();
    const assetId = assetByCode.get((r.assetCode || "").trim().toUpperCase());
    if (!riskCode || !assetId || !r.title?.trim()) {
      errors.push({ row: rowNum, message: "riskCode, valid assetCode, and title are required." });
      return;
    }

    const category = (r.category?.trim().toUpperCase() || "OPERATIONAL") as RiskCategory;
    const treatment = (r.treatment?.trim().toUpperCase() || "MITIGATE") as RiskTreatment;
    const status = (r.status?.trim().toUpperCase() || "OPEN") as RiskStatus;
    if (!VALID_CATEGORIES.has(category) || !VALID_TREATMENTS.has(treatment) || !VALID_STATUSES.has(status)) {
      errors.push({ row: rowNum, message: "Invalid category, treatment, or status enum value." });
      return;
    }

    const inhL = Math.max(1, Math.min(5, Number(r.inherentLikelihood) || 3));
    const inhI = Math.max(1, Math.min(5, Number(r.inherentImpact) || 3));
    const resL = Math.max(1, Math.min(5, Number(r.residualLikelihood) || 2));
    const resI = Math.max(1, Math.min(5, Number(r.residualImpact) || 2));

    validRows.push({
      riskCode,
      assetId,
      frameDimension: r.frameDimension ? (r.frameDimension.trim().toUpperCase() as FrameDimension) : null,
      title: r.title.trim(),
      description: r.description?.trim() || r.title.trim(),
      category,
      cause: r.cause?.trim() || "Unspecified cause",
      impactDescription: r.impactDescription?.trim() || "Unspecified impact",
      inherentLikelihood: inhL,
      inherentImpact: inhI,
      residualLikelihood: resL,
      residualImpact: resI,
      financialExposure: Number(r.financialExposure) || resL * resI * 10000,
      ownerId: (r.ownerEmail && userByEmail.get(r.ownerEmail.trim().toLowerCase())) || auth.session.id,
      treatment,
      reviewDate: r.reviewDate ? new Date(r.reviewDate) : new Date(Date.now() + 30 * 86400000),
      status,
    });
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV validation errors.", errors }, { status: 400 });
  }

  const importedCount = await prisma.$transaction(async (tx) => {
    for (const item of validRows) {
      await tx.risk.upsert({
        where: { riskCode: item.riskCode },
        update: item,
        create: item,
      });
    }
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "IMPORT_RISKS_CSV",
      entityType: "RISK",
      entityId: "BULK_IMPORT",
      afterState: { importedCount: validRows.length },
    });
    return validRows.length;
  });

  return NextResponse.json({ importedCount });
}
