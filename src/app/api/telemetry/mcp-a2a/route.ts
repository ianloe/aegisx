import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ProtocolType, Severity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { dispatchAlert } from "@/lib/governance/alerts";
import { evaluateGateFromBreachSeverity } from "@/lib/governance/budget-and-gate";
import { evaluateA2aCall, evaluateMcpCall } from "@/lib/governance/mcp-a2a";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function authenticateRequest(request: Request): Promise<{
  actorId: string;
  actorEmail: string;
  keyId: string | null;
} | null> {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    const keyHash = hashToken(rawToken);
    const keyRecord = await prisma.telemetryApiKey.findUnique({
      where: { keyHash },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    if (!keyRecord || !keyRecord.isActive) return null;
    return {
      actorId: keyRecord.createdBy.id,
      actorEmail: `telemetry:${keyRecord.keyPrefix}`,
      keyId: keyRecord.id,
    };
  }

  const session = await getSession();
  if (!session || !hasPermission(session.role, "admin:config")) return null;
  return { actorId: session.id, actorEmail: session.email, keyId: null };
}

const singleEventSchema = z.object({
  protocol: z.nativeEnum(ProtocolType),
  assetCode: z.string().min(1),
  targetName: z.string().min(1),
  operation: z.string().min(1),
  hopDepth: z.number().int().min(1).default(1),
  traceId: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

const payloadSchema = z.union([
  singleEventSchema,
  z.object({ events: z.array(singleEventSchema).min(1) }),
]);

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Valid Bearer telemetry API key or Administrator session required." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid MCP/A2A telemetry payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (auth.keyId) {
    await prisma.telemetryApiKey.update({
      where: { id: auth.keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  const events = "events" in parsed.data ? parsed.data.events : [parsed.data];
  const results: Array<{
    protocol: ProtocolType;
    assetCode: string;
    targetName: string;
    operation: string;
    allowed: boolean;
    status: string;
    violationReason: string | null;
    breachId?: string;
  }> = [];

  for (const ev of events) {
    const asset = await prisma.aIAsset.findUnique({
      where: { assetCode: ev.assetCode },
      include: {
        mcpPolicies: true,
        a2aOutboundLinks: true,
      },
    });
    if (!asset) {
      return NextResponse.json({ error: `Asset "${ev.assetCode}" not found.` }, { status: 404 });
    }

    const evaluation =
      ev.protocol === ProtocolType.MCP
        ? evaluateMcpCall(
            asset.mcpPolicies.find((p) => p.serverName.toLowerCase() === ev.targetName.toLowerCase()),
            ev.targetName,
            ev.operation,
          )
        : evaluateA2aCall(
            asset.a2aOutboundLinks.find((l) => l.targetName.toLowerCase() === ev.targetName.toLowerCase()),
            ev.targetName,
            ev.operation,
            ev.hopDepth,
          );

    const txRes = await prisma.$transaction(async (tx) => {
      const now = new Date();

      if (ev.protocol === ProtocolType.MCP) {
        const policy = asset.mcpPolicies.find((p) => p.serverName.toLowerCase() === ev.targetName.toLowerCase());
        if (policy) {
          await tx.mcpServerPolicy.update({
            where: { id: policy.id },
            data: { callCount: { increment: 1 }, lastCalledAt: now },
          });
        }
      } else {
        const link = asset.a2aOutboundLinks.find((l) => l.targetName.toLowerCase() === ev.targetName.toLowerCase());
        if (link) {
          await tx.a2aPeerLink.update({
            where: { id: link.id },
            data: { callCount: { increment: 1 }, lastCalledAt: now },
          });
        }
      }

      const callStatus = evaluation.allowed ? "OK" : "UNAPPROVED";
      await tx.protocolCallEvent.create({
        data: {
          protocol: ev.protocol,
          sourceAssetId: asset.id,
          targetName: ev.targetName,
          operation: ev.operation,
          hopDepth: ev.hopDepth,
          traceId: ev.traceId || null,
          status: callStatus,
          durationMs: ev.durationMs ?? null,
          violationReason: evaluation.reason,
        },
      });

      let breachId: string | undefined;
      if (!evaluation.allowed) {
        const breach = await tx.boundaryBreach.create({
          data: {
            assetId: asset.id,
            occurredAt: now,
            severity: Severity.HIGH,
            description: `[${ev.protocol}] ${evaluation.reason}`,
            remediation: `Review ${ev.protocol} policy for ${asset.assetCode} -> ${ev.targetName} (${ev.operation}).`,
            status: "OPEN",
            reportedById: auth.actorId,
          },
        });
        breachId = breach.id;

        const nextGate = evaluateGateFromBreachSeverity(asset.runtimeGateStatus, Severity.HIGH);
        if (nextGate !== asset.runtimeGateStatus) {
          await tx.aIAsset.update({
            where: { id: asset.id },
            data: {
              runtimeGateStatus: nextGate,
              runtimeGateReason: `Auto-${nextGate.toLowerCase()} by unapproved ${ev.protocol} call (${ev.targetName}:${ev.operation})`,
            },
          });
        }

        await dispatchAlert(tx, {
          eventType: "UNAPPROVED_MCP_OR_A2A",
          title: `Unapproved ${ev.protocol} Call by ${asset.assetCode}`,
          message: evaluation.reason || `${asset.assetCode} called ${ev.targetName}:${ev.operation}`,
          severity: "CRITICAL",
          entityType: "AI_ASSET",
          entityId: asset.id,
        });
      }

      await writeAuditLog(tx, {
        actorId: auth.actorId,
        actorEmail: auth.actorEmail,
        action: evaluation.allowed ? `TELEMETRY_${ev.protocol}_CALL` : `TELEMETRY_${ev.protocol}_VIOLATION`,
        entityType: "AI_ASSET",
        entityId: asset.id,
        afterState: {
          protocol: ev.protocol,
          assetCode: asset.assetCode,
          targetName: ev.targetName,
          operation: ev.operation,
          hopDepth: ev.hopDepth,
          allowed: evaluation.allowed,
          breachId,
        },
      });

      return {
        protocol: ev.protocol,
        assetCode: asset.assetCode,
        targetName: ev.targetName,
        operation: ev.operation,
        allowed: evaluation.allowed,
        status: callStatus,
        violationReason: evaluation.reason,
        breachId,
      };
    });

    results.push(txRes);
  }

  return NextResponse.json(
    {
      status: "ingested",
      processed: results.length,
      violations: results.filter((r) => !r.allowed).length,
      results,
    },
    { status: 201 },
  );
}
