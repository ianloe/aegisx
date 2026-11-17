import { NextResponse } from "next/server";
import { z } from "zod";
import { BenefitCategory, CostCategory, Currency, ValueConfidence } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

const createRoiEntrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("COST"),
    assetId: z.string().min(1),
    category: z.nativeEnum(CostCategory),
    description: z.string().min(2),
    amount: z.number().nonnegative(),
    currency: z.nativeEnum(Currency).default("SGD"),
    quarter: z.string().min(4),
    isRecurring: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("BENEFIT"),
    assetId: z.string().min(1),
    category: z.nativeEnum(BenefitCategory),
    description: z.string().min(2),
    plannedAmount: z.number().nonnegative(),
    actualAmount: z.number().nonnegative().default(0),
    currency: z.nativeEnum(Currency).default("SGD"),
    quarter: z.string().min(4),
    confidence: z.nativeEnum(ValueConfidence),
    methodologyNote: z.string().optional(),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireApiSession("roi:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createRoiEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ROI entry payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (data.type === "COST") {
    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.costItem.create({
        data: {
          assetId: data.assetId,
          category: data.category,
          description: data.description.trim(),
          amount: data.amount,
          currency: data.currency,
          quarter: data.quarter.trim(),
          isRecurring: data.isRecurring,
        },
      });
      await writeAuditLog(tx, {
        actorId: auth.session.id,
        actorEmail: auth.session.email,
        action: "CREATE_COST_ITEM",
        entityType: "COST_ITEM",
        entityId: item.id,
        afterState: item,
      });
      return item;
    });
    return NextResponse.json({ costItem: created }, { status: 201 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.benefitItem.create({
      data: {
        assetId: data.assetId,
        category: data.category,
        description: data.description.trim(),
        plannedAmount: data.plannedAmount,
        actualAmount: data.actualAmount,
        currency: data.currency,
        quarter: data.quarter.trim(),
        confidence: data.confidence,
        methodologyNote: data.methodologyNote?.trim() || null,
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_BENEFIT_ITEM",
      entityType: "BENEFIT_ITEM",
      entityId: item.id,
      afterState: item,
    });
    return item;
  });

  return NextResponse.json({ benefitItem: created }, { status: 201 });
}
