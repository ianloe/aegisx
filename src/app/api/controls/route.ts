import { NextResponse } from "next/server";
import { z } from "zod";
import { ControlEffectiveness, MappingCoverage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const [controls, frameworks] = await Promise.all([
    prisma.control.findMany({
      include: {
        owner: { select: { id: true, name: true } },
        mappings: {
          include: {
            requirement: { include: { framework: true } },
          },
        },
        risks: { include: { risk: { select: { id: true, riskCode: true, title: true } } } },
      },
      orderBy: { controlCode: "asc" },
    }),
    prisma.framework.findMany({
      include: { requirements: { orderBy: { code: "asc" } } },
      orderBy: { code: "asc" },
    }),
  ]);

  return NextResponse.json({ controls, frameworks });
}

const postControlSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("CREATE_CONTROL"),
    title: z.string().min(3),
    description: z.string().min(4),
    testFrequency: z.string().default("QUARTERLY"),
  }),
  z.object({
    mode: z.literal("ADD_MAPPING"),
    controlId: z.string().min(1),
    requirementId: z.string().min(1),
    coverage: z.nativeEnum(MappingCoverage).default("FULL"),
    notes: z.string().optional(),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireApiSession("controls:test");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = postControlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid control or mapping payload." }, { status: 400 });
  }

  const data = parsed.data;
  if (data.mode === "CREATE_CONTROL") {
    const count = await prisma.control.count();
    const controlCode = `CTL-${String(count + 1).padStart(3, "0")}`;
    const created = await prisma.$transaction(async (tx) => {
      const ctrl = await tx.control.create({
        data: {
          controlCode,
          title: data.title.trim(),
          description: data.description.trim(),
          ownerId: auth.session.id,
          testFrequency: data.testFrequency,
        },
      });
      await writeAuditLog(tx, {
        actorId: auth.session.id,
        actorEmail: auth.session.email,
        action: "CREATE_CONTROL",
        entityType: "CONTROL",
        entityId: ctrl.id,
        afterState: ctrl,
      });
      return ctrl;
    });
    return NextResponse.json({ control: created }, { status: 201 });
  }

  const mapping = await prisma.$transaction(async (tx) => {
    const m = await tx.controlMapping.upsert({
      where: {
        controlId_requirementId: {
          controlId: data.controlId,
          requirementId: data.requirementId,
        },
      },
      update: {
        coverage: data.coverage,
        notes: data.notes || null,
      },
      create: {
        controlId: data.controlId,
        requirementId: data.requirementId,
        coverage: data.coverage,
        notes: data.notes || null,
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPSERT_CONTROL_MAPPING",
      entityType: "CONTROL_MAPPING",
      entityId: m.id,
      afterState: m,
    });
    return m;
  });

  return NextResponse.json({ mapping }, { status: 201 });
}

const testControlSchema = z.object({
  id: z.string().min(1),
  effectiveness: z.nativeEnum(ControlEffectiveness),
  testNotes: z.string().min(2),
});

export async function PATCH(request: Request) {
  const auth = await requireApiSession("controls:test");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = testControlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid control test input." }, { status: 400 });
  }

  const before = await prisma.control.findUnique({ where: { id: parsed.data.id } });
  if (!before) {
    return NextResponse.json({ error: "Control not found." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const ctrl = await tx.control.update({
      where: { id: parsed.data.id },
      data: {
        effectiveness: parsed.data.effectiveness,
        testNotes: parsed.data.testNotes.trim(),
        lastTestedAt: new Date(),
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "TEST_CONTROL",
      entityType: "CONTROL",
      entityId: ctrl.id,
      beforeState: before,
      afterState: ctrl,
    });
    return ctrl;
  });

  return NextResponse.json({ control: updated });
}
