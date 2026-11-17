import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthorityDecisionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") || undefined;

  const rules = await prisma.authorityRule.findMany({
    where: assetId ? { assetId } : undefined,
    include: {
      asset: { select: { id: true, assetCode: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ version: "desc" }, { decisionType: "asc" }],
  });

  return NextResponse.json({ rules });
}

const publishAuthoritySchema = z.object({
  assetId: z.string().min(1),
  rules: z
    .array(
      z.object({
        decisionType: z.nativeEnum(AuthorityDecisionType),
        scopeDescription: z.string().min(2),
        conditions: z.string().optional(),
      })
    )
    .min(1),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("authority:write");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = publishAuthoritySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid authority matrix payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const latest = await prisma.authorityRule.findFirst({
    where: { assetId: parsed.data.assetId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    await tx.authorityRule.updateMany({
      where: { assetId: parsed.data.assetId, isActive: true },
      data: { isActive: false },
    });

    const rules = [];
    for (const r of parsed.data.rules) {
      const rule = await tx.authorityRule.create({
        data: {
          assetId: parsed.data.assetId,
          version: nextVersion,
          decisionType: r.decisionType,
          scopeDescription: r.scopeDescription.trim(),
          conditions: r.conditions?.trim() || null,
          isActive: true,
          createdById: auth.session.id,
        },
      });
      rules.push(rule);
    }

    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "PUBLISH_AUTHORITY_MATRIX",
      entityType: "AUTHORITY_RULE",
      entityId: `${parsed.data.assetId}:v${nextVersion}`,
      afterState: { version: nextVersion, ruleCount: rules.length },
    });

    return rules;
  });

  return NextResponse.json({ version: nextVersion, rules: created }, { status: 201 });
}
