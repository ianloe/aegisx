import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const risks = await prisma.risk.findMany({
    include: { asset: true, owner: true },
    orderBy: { riskCode: "asc" },
  });

  const headers = [
    "riskCode",
    "assetCode",
    "frameDimension",
    "title",
    "description",
    "category",
    "cause",
    "impactDescription",
    "inherentLikelihood",
    "inherentImpact",
    "residualLikelihood",
    "residualImpact",
    "financialExposure",
    "ownerEmail",
    "treatment",
    "reviewDate",
    "status",
  ];

  const rows = risks.map((r) => [
    r.riskCode,
    r.asset.assetCode,
    r.frameDimension ?? "",
    r.title,
    r.description,
    r.category,
    r.cause,
    r.impactDescription,
    r.inherentLikelihood,
    r.inherentImpact,
    r.residualLikelihood,
    r.residualImpact,
    r.financialExposure ?? 0,
    r.owner.email,
    r.treatment,
    r.reviewDate.toISOString().slice(0, 10),
    r.status,
  ]);

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="risk-register-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
