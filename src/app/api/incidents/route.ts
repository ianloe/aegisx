import { NextResponse } from "next/server";
import { z } from "zod";
import { IncidentStatus, Severity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") || undefined;

  const incidents = await prisma.incident.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      asset: { select: { id: true, assetCode: true, name: true } },
      risk: { select: { id: true, riskCode: true, title: true } },
      reportedBy: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  return NextResponse.json({ incidents });
}

const createIncidentSchema = z.object({
  assetId: z.string().min(1),
  riskId: z.string().nullable().optional(),
  title: z.string().min(3),
  isNearMiss: z.boolean().default(false),
  severity: z.nativeEnum(Severity),
  description: z.string().min(4),
  rootCause: z.string().optional(),
  lessonsLearned: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("incidents:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid incident input.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const count = await prisma.incident.count();
  const incidentCode = `INC-${String(count + 1).padStart(3, "0")}`;

  const created = await prisma.$transaction(async (tx) => {
    const inc = await tx.incident.create({
      data: {
        incidentCode,
        assetId: data.assetId,
        riskId: data.riskId || null,
        title: data.title.trim(),
        isNearMiss: data.isNearMiss,
        occurredAt: new Date(),
        severity: data.severity,
        description: data.description.trim(),
        rootCause: data.rootCause?.trim() || null,
        lessonsLearned: data.lessonsLearned?.trim() || null,
        status: IncidentStatus.OPEN,
        reportedById: auth.session.id,
      },
      include: {
        asset: { select: { id: true, assetCode: true, name: true } },
        risk: { select: { id: true, riskCode: true, title: true } },
      },
    });

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_INCIDENT",
      entityType: "INCIDENT",
      entityId: inc.id,
      afterState: inc,
    });

    return inc;
  });

  return NextResponse.json({ incident: created }, { status: 201 });
}

const patchIncidentSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(IncidentStatus),
  rootCause: z.string().optional(),
  lessonsLearned: z.string().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiSession("incidents:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = patchIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid incident update." }, { status: 400 });
  }

  const before = await prisma.incident.findUnique({ where: { id: parsed.data.id } });
  if (!before) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const inc = await tx.incident.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        rootCause: parsed.data.rootCause ?? before.rootCause,
        lessonsLearned: parsed.data.lessonsLearned ?? before.lessonsLearned,
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPDATE_INCIDENT",
      entityType: "INCIDENT",
      entityId: inc.id,
      beforeState: before,
      afterState: inc,
    });
    return inc;
  });

  return NextResponse.json({ incident: updated });
}
