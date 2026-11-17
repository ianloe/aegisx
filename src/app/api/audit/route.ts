import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const auth = await requireApiSession("audit:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") || undefined;
  const action = searchParams.get("action") || undefined;
  const limit = Math.min(200, Math.max(10, Number(searchParams.get("limit") || 50)));

  const entries = await prisma.auditLogEntry.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ entries });
}
