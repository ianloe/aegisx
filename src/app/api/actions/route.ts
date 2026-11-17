import { NextResponse } from "next/server";
import { z } from "zod";
import { ActionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const actions = await prisma.action.findMany({
    include: {
      asset: { select: { id: true, assetCode: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json({ actions });
}

const createActionSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  assetId: z.string().nullable().optional(),
  ownerId: z.string().min(1),
  dueDate: z.string().min(4),
  sourceType: z.string().default("MANUAL"),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("actions:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action input." }, { status: 400 });
  }

  const data = parsed.data;
  const created = await prisma.$transaction(async (tx) => {
    const act = await tx.action.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        assetId: data.assetId || null,
        ownerId: data.ownerId,
        dueDate: new Date(data.dueDate),
        sourceType: data.sourceType,
      },
      include: {
        asset: { select: { id: true, assetCode: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_ACTION",
      entityType: "ACTION",
      entityId: act.id,
      afterState: act,
    });
    return act;
  });

  return NextResponse.json({ action: created }, { status: 201 });
}

const patchActionSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(ActionStatus),
});

export async function PATCH(request: Request) {
  const auth = await requireApiSession("actions:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = patchActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action status update." }, { status: 400 });
  }

  const before = await prisma.action.findUnique({ where: { id: parsed.data.id } });
  if (!before) {
    return NextResponse.json({ error: "Action not found." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const act = await tx.action.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPDATE_ACTION",
      entityType: "ACTION",
      entityId: act.id,
      beforeState: before,
      afterState: act,
    });
    return act;
  });

  return NextResponse.json({ action: updated });
}
