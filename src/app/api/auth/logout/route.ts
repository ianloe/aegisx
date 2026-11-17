import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (session) {
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "LOGOUT",
      entityType: "USER",
      entityId: session.id,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
