import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const assets = await prisma.aIAsset.findMany({
    include: {
      businessUnit: true,
      owner: true,
      overseer: true,
    },
    orderBy: { assetCode: "asc" },
  });

  const headers = [
    "assetCode",
    "name",
    "description",
    "assetType",
    "businessUnitCode",
    "country",
    "ownerEmail",
    "overseerEmail",
    "escalationPath",
    "lifecycleStage",
    "autonomyLevel",
    "dataSensitivity",
    "jurisdictions",
    "sourcingType",
    "vendorName",
    "isAgent",
  ];

  const rows = assets.map((a) => [
    a.assetCode,
    a.name,
    a.description,
    a.assetType,
    a.businessUnit.code,
    a.country,
    a.owner?.email ?? "",
    a.overseer?.email ?? "",
    a.escalationPath ?? "",
    a.lifecycleStage,
    a.autonomyLevel,
    a.dataSensitivity,
    a.jurisdictions.join(";"),
    a.sourcingType,
    a.vendorName ?? "",
    a.isAgent ? "true" : "false",
  ]);

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ai-asset-register-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
