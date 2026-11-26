import { NextResponse } from "next/server";
import {
  AssetType,
  AutonomyLevel,
  DataSensitivity,
  LifecycleStage,
  SourcingType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { parseCsv } from "@/lib/csv";
import { writeAuditLog } from "@/lib/audit";

const VALID_TYPES = new Set(Object.values(AssetType));
const VALID_LIFECYCLE = new Set(Object.values(LifecycleStage));
const VALID_AUTONOMY = new Set(Object.values(AutonomyLevel));
const VALID_SENSITIVITY = new Set(Object.values(DataSensitivity));
const VALID_SOURCING = new Set(Object.values(SourcingType));

export async function POST(request: Request) {
  const auth = await requireApiSession("assets:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const csvText = String(body.csv || "");
  const dryRun = Boolean(body.dryRun);

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV content is empty." }, { status: 400 });
  }
  if (csvText.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "CSV payload exceeds maximum size of 5 MB." }, { status: 400 });
  }

  const { rows } = parseCsv(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows found in CSV." }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: "CSV import is limited to 5,000 rows per request." }, { status: 400 });
  }

  const [businessUnits, users] = await Promise.all([
    prisma.businessUnit.findMany(),
    prisma.user.findMany({ select: { id: true, email: true } }),
  ]);
  const buByCode = new Map(businessUnits.map((b) => [b.code.toUpperCase(), b]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  const errors: Array<{ row: number; message: string }> = [];
  const validRows: Array<{
    assetCode: string;
    name: string;
    description: string;
    assetType: AssetType;
    businessUnitId: string;
    country: string;
    ownerId: string | null;
    overseerId: string | null;
    escalationPath: string | null;
    lifecycleStage: LifecycleStage;
    autonomyLevel: AutonomyLevel;
    dataSensitivity: DataSensitivity;
    jurisdictions: string[];
    sourcingType: SourcingType;
    vendorName: string | null;
    isAgent: boolean;
  }> = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const assetCode = r.assetCode?.trim();
    const name = r.name?.trim();
    const description = r.description?.trim() || name;
    const bu = buByCode.get((r.businessUnitCode || "").trim().toUpperCase());

    if (!assetCode || !name) {
      errors.push({ row: rowNum, message: "assetCode and name are required." });
      return;
    }
    if (!bu) {
      errors.push({ row: rowNum, message: `Unknown businessUnitCode: ${r.businessUnitCode || "(empty)"}` });
      return;
    }

    const assetType = (r.assetType?.trim().toUpperCase() || "COPILOT") as AssetType;
    const lifecycleStage = (r.lifecycleStage?.trim().toUpperCase() || "IDEA") as LifecycleStage;
    const autonomyLevel = (r.autonomyLevel?.trim().toUpperCase() || "ASSISTIVE") as AutonomyLevel;
    const dataSensitivity = (r.dataSensitivity?.trim().toUpperCase() || "INTERNAL") as DataSensitivity;
    const sourcingType = (r.sourcingType?.trim().toUpperCase() || "IN_HOUSE") as SourcingType;

    if (!VALID_TYPES.has(assetType)) {
      errors.push({ row: rowNum, message: `Invalid assetType: ${assetType}` });
      return;
    }
    if (!VALID_LIFECYCLE.has(lifecycleStage)) {
      errors.push({ row: rowNum, message: `Invalid lifecycleStage: ${lifecycleStage}` });
      return;
    }
    if (!VALID_AUTONOMY.has(autonomyLevel)) {
      errors.push({ row: rowNum, message: `Invalid autonomyLevel: ${autonomyLevel}` });
      return;
    }
    if (!VALID_SENSITIVITY.has(dataSensitivity)) {
      errors.push({ row: rowNum, message: `Invalid dataSensitivity: ${dataSensitivity}` });
      return;
    }
    if (!VALID_SOURCING.has(sourcingType)) {
      errors.push({ row: rowNum, message: `Invalid sourcingType: ${sourcingType}` });
      return;
    }

    validRows.push({
      assetCode,
      name,
      description,
      assetType,
      businessUnitId: bu.id,
      country: r.country?.trim() || bu.country,
      ownerId: r.ownerEmail ? userByEmail.get(r.ownerEmail.trim().toLowerCase()) ?? null : null,
      overseerId: r.overseerEmail ? userByEmail.get(r.overseerEmail.trim().toLowerCase()) ?? null : null,
      escalationPath: r.escalationPath?.trim() || null,
      lifecycleStage,
      autonomyLevel,
      dataSensitivity,
      jurisdictions: r.jurisdictions ? r.jurisdictions.split(";").map((s) => s.trim()).filter(Boolean) : [bu.country],
      sourcingType,
      vendorName: sourcingType === "VENDOR" ? r.vendorName?.trim() || null : null,
      isAgent: r.isAgent?.trim().toLowerCase() === "true",
    });
  });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRows: rows.length,
      validCount: validRows.length,
      errors,
      preview: validRows.slice(0, 10),
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV contains validation errors.", errors }, { status: 400 });
  }

  const importedCount = await prisma.$transaction(async (tx) => {
    for (const item of validRows) {
      await tx.aIAsset.upsert({
        where: { assetCode: item.assetCode },
        update: {
          name: item.name,
          description: item.description,
          assetType: item.assetType,
          businessUnitId: item.businessUnitId,
          country: item.country,
          ownerId: item.ownerId,
          overseerId: item.overseerId,
          escalationPath: item.escalationPath,
          lifecycleStage: item.lifecycleStage,
          autonomyLevel: item.autonomyLevel,
          dataSensitivity: item.dataSensitivity,
          jurisdictions: item.jurisdictions,
          sourcingType: item.sourcingType,
          vendorName: item.vendorName,
          isAgent: item.isAgent,
        },
        create: item,
      });
    }
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "IMPORT_ASSETS_CSV",
      entityType: "AI_ASSET",
      entityId: "BULK_IMPORT",
      afterState: { importedCount: validRows.length },
    });
    return validRows.length;
  });

  return NextResponse.json({ importedCount });
}
