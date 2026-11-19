import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function GET() {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const keys = await prisma.telemetryApiKey.findMany({
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

const createKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid key name." }, { status: 400 });
  }

  const rawSecret = `aegis_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = rawSecret.slice(0, 14);
  const keyHash = hashToken(rawSecret);

  const created = await prisma.$transaction(async (tx) => {
    const key = await tx.telemetryApiKey.create({
      data: {
        name: parsed.data.name,
        keyPrefix,
        keyHash,
        createdById: auth.session.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_TELEMETRY_KEY",
      entityType: "TELEMETRY_API_KEY",
      entityId: key.id,
      afterState: { name: key.name, keyPrefix: key.keyPrefix },
    });
    return key;
  });

  return NextResponse.json({ key: created, plaintextToken: rawSecret }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Key ID is required." }, { status: 400 });
  }

  const existing = await prisma.telemetryApiKey.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.telemetryApiKey.update({
      where: { id },
      data: { isActive: false },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "REVOKE_TELEMETRY_KEY",
      entityType: "TELEMETRY_API_KEY",
      entityId: id,
      beforeState: { isActive: existing.isActive },
      afterState: { isActive: false },
    });
  });

  return NextResponse.json({ revokedId: id });
}
