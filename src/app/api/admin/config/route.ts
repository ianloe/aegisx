import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const [configs, frameCriteria, performanceProfiles, frameworks, valueModels] = await Promise.all([
    prisma.governanceConfig.findMany({ orderBy: { key: "asc" } }),
    prisma.frameCriterion.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.performanceProfile.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.framework.findMany({
      include: { requirements: { orderBy: { code: "asc" } } },
      orderBy: { code: "asc" },
    }),
    prisma.valueModel.findMany({ orderBy: { code: "asc" } }),
  ]);

  return NextResponse.json({
    configs,
    frameCriteria,
    performanceProfiles,
    frameworks,
    valueModels,
  });
}

const patchConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("GOVERNANCE_CONFIG"),
    key: z.string(),
    valueJson: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("FRAME_CRITERION"),
    id: z.string(),
    title: z.string().min(2),
    description: z.string().min(2),
    rubricJson: z.record(z.string(), z.string()),
    isPlaceholder: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("PERFORMANCE_PROFILE"),
    id: z.string(),
    governanceConsequence: z.string().min(2),
    requiredAction: z.string().min(2),
    ruleConfigJson: z.record(z.string(), z.unknown()),
    isPlaceholder: z.boolean().optional(),
  }),
]);

export async function PATCH(request: Request) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = patchConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid configuration payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    if (data.type === "GOVERNANCE_CONFIG") {
      const before = await tx.governanceConfig.findUnique({ where: { key: data.key } });
      if (!before) return null;
      const updated = await tx.governanceConfig.update({
        where: { key: data.key },
        data: {
          valueJson: data.valueJson as Prisma.InputJsonValue,
          updatedById: auth.session.id,
        },
      });
      await writeAuditLog(tx, {
        actorId: auth.session.id,
        actorEmail: auth.session.email,
        action: "UPDATE_GOVERNANCE_CONFIG",
        entityType: "GOVERNANCE_CONFIG",
        entityId: updated.id,
        beforeState: before,
        afterState: updated,
      });
      return updated;
    }

    if (data.type === "FRAME_CRITERION") {
      const before = await tx.frameCriterion.findUnique({ where: { id: data.id } });
      if (!before) return null;
      const updated = await tx.frameCriterion.update({
        where: { id: data.id },
        data: {
          title: data.title,
          description: data.description,
          rubricJson: data.rubricJson as Prisma.InputJsonValue,
          isPlaceholder: data.isPlaceholder ?? before.isPlaceholder,
          isActive: data.isActive ?? before.isActive,
        },
      });
      await writeAuditLog(tx, {
        actorId: auth.session.id,
        actorEmail: auth.session.email,
        action: "UPDATE_FRAME_CRITERION",
        entityType: "FRAME_CRITERION",
        entityId: updated.id,
        beforeState: before,
        afterState: updated,
      });
      return updated;
    }

    const before = await tx.performanceProfile.findUnique({ where: { id: data.id } });
    if (!before) return null;
    const updated = await tx.performanceProfile.update({
      where: { id: data.id },
      data: {
        governanceConsequence: data.governanceConsequence,
        requiredAction: data.requiredAction,
        ruleConfigJson: data.ruleConfigJson as Prisma.InputJsonValue,
        isPlaceholder: data.isPlaceholder ?? before.isPlaceholder,
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPDATE_PERFORMANCE_PROFILE",
      entityType: "PERFORMANCE_PROFILE",
      entityId: updated.id,
      beforeState: before,
      afterState: updated,
    });
    return updated;
  });

  if (!result) {
    return NextResponse.json({ error: "Configuration record not found." }, { status: 404 });
  }

  return NextResponse.json({ updated: result });
}
