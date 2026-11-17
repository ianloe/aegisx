import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const businessUnits = await prisma.businessUnit.findMany({
    include: { _count: { select: { assets: true, users: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ businessUnits });
}

const createBuSchema = z.object({
  code: z.string().trim().min(2).max(24),
  name: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(80),
  headName: z.string().trim().max(120).nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createBuSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid business unit details.", details: parsed.error.flatten() }, { status: 400 });
  }

  const code = parsed.data.code.toUpperCase();
  const existing = await prisma.businessUnit.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: `A business unit with code "${code}" already exists.` }, { status: 409 });
  }

  const org = await prisma.organisation.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    return NextResponse.json({ error: "Organisation record not found." }, { status: 500 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const bu = await tx.businessUnit.create({
      data: {
        organisationId: org.id,
        code,
        name: parsed.data.name,
        country: parsed.data.country,
        headName: parsed.data.headName || null,
      },
      include: { _count: { select: { assets: true, users: true } } },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_BUSINESS_UNIT",
      entityType: "BUSINESS_UNIT",
      entityId: bu.id,
      afterState: { code: bu.code, name: bu.name, country: bu.country, headName: bu.headName },
    });
    return bu;
  });

  return NextResponse.json({ businessUnit: created }, { status: 201 });
}

const patchBuSchema = z.object({
  id: z.string().min(1),
  code: z.string().trim().min(2).max(24).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  country: z.string().trim().min(2).max(80).optional(),
  headName: z.string().trim().max(120).nullable().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = patchBuSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid business unit update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const before = await prisma.businessUnit.findUnique({ where: { id: parsed.data.id } });
  if (!before) {
    return NextResponse.json({ error: "Business unit not found." }, { status: 404 });
  }

  const nextCode = parsed.data.code ? parsed.data.code.toUpperCase() : before.code;
  if (nextCode !== before.code) {
    const dup = await prisma.businessUnit.findUnique({ where: { code: nextCode } });
    if (dup) {
      return NextResponse.json({ error: `A business unit with code "${nextCode}" already exists.` }, { status: 409 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const bu = await tx.businessUnit.update({
      where: { id: before.id },
      data: {
        code: nextCode,
        name: parsed.data.name ?? before.name,
        country: parsed.data.country ?? before.country,
        headName: parsed.data.headName !== undefined ? (parsed.data.headName || null) : before.headName,
      },
      include: { _count: { select: { assets: true, users: true } } },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPDATE_BUSINESS_UNIT",
      entityType: "BUSINESS_UNIT",
      entityId: bu.id,
      beforeState: { code: before.code, name: before.name, country: before.country, headName: before.headName },
      afterState: { code: bu.code, name: bu.name, country: bu.country, headName: bu.headName },
    });
    return bu;
  });

  return NextResponse.json({ businessUnit: updated });
}

export async function DELETE(request: Request) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  if (!id) {
    try {
      const body = await request.json();
      id = typeof body?.id === "string" ? body.id : null;
    } catch {
      id = null;
    }
  }
  if (!id) {
    return NextResponse.json({ error: "Business unit ID is required." }, { status: 400 });
  }

  const existing = await prisma.businessUnit.findUnique({
    where: { id },
    include: { _count: { select: { assets: true, users: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Business unit not found." }, { status: 404 });
  }
  if (existing._count.assets > 0) {
    return NextResponse.json(
      {
        error: `Cannot remove "${existing.name}" because ${existing._count.assets} AI asset(s) are still assigned to it. Reassign those assets first.`,
      },
      { status: 409 },
    );
  }
  if (existing._count.users > 0) {
    return NextResponse.json(
      {
        error: `Cannot remove "${existing.name}" because ${existing._count.users} user(s) are scoped to it. Reassign those users first.`,
      },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.businessUnit.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "DELETE_BUSINESS_UNIT",
      entityType: "BUSINESS_UNIT",
      entityId: existing.id,
      beforeState: { code: existing.code, name: existing.name, country: existing.country, headName: existing.headName },
    });
  });

  return NextResponse.json({ deletedId: existing.id });
}
