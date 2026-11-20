import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { dispatchAlert } from "@/lib/governance/alerts";
import { normalizeDiscoveryPayload } from "@/lib/governance/shadow-ai";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function authenticateDiscoveryRequest(request: Request): Promise<{
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
  return {
    actorId: session.id,
    actorEmail: session.email,
    keyId: null,
  };
}

export async function POST(request: Request) {
  const auth = await authenticateDiscoveryRequest(request);
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

  const events = normalizeDiscoveryPayload(body);
  if (events.length === 0) {
    return NextResponse.json(
      { error: "No valid discovery events found. Provide at least `domain` (or `events: [{ domain, ... }]`)." },
      { status: 400 },
    );
  }

  if (auth.keyId) {
    await prisma.telemetryApiKey.update({
      where: { id: auth.keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  let createdCount = 0;
  let updatedCount = 0;
  let alertsTriggered = 0;
  const results: Array<{
    id: string;
    domain: string;
    providerName: string;
    source: string;
    businessUnit: string;
    status: string;
    requestCount: number;
  }> = [];

  for (const ev of events) {
    const existing = await prisma.shadowAiCandidate.findUnique({
      where: {
        domain_businessUnit_source: {
          domain: ev.domain,
          businessUnit: ev.businessUnit,
          source: ev.source,
        },
      },
    });

    const record = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let saved;
      let shouldAlert = false;
      let alertTitle = "";
      let alertSeverity: "INFO" | "WARNING" | "CRITICAL" = "WARNING";

      if (!existing) {
        saved = await tx.shadowAiCandidate.create({
          data: {
            domain: ev.domain,
            providerName: ev.providerName,
            category: ev.category,
            source: ev.source,
            businessUnit: ev.businessUnit,
            requestCount: ev.requestCount,
            bytesUploaded: ev.bytesUploaded,
            uniqueUsers: ev.uniqueUsers,
            status: "DETECTED",
            firstSeenAt: now,
            lastSeenAt: now,
          },
        });
        createdCount += 1;
        shouldAlert = true;
        alertTitle = `Shadow AI Detected: ${ev.providerName} (${ev.domain})`;
      } else {
        saved = await tx.shadowAiCandidate.update({
          where: { id: existing.id },
          data: {
            providerName: ev.providerName,
            category: ev.category,
            requestCount: { increment: ev.requestCount },
            bytesUploaded: { increment: ev.bytesUploaded },
            uniqueUsers: Math.max(existing.uniqueUsers, ev.uniqueUsers),
            lastSeenAt: now,
          },
        });
        updatedCount += 1;
        if (existing.status === "BLOCKED") {
          shouldAlert = true;
          alertTitle = `Blocked AI Domain Traffic: ${ev.domain}`;
          alertSeverity = "CRITICAL";
        }
      }

      if (shouldAlert) {
        const mb = (ev.bytesUploaded / (1024 * 1024)).toFixed(2);
        await dispatchAlert(tx, {
          eventType: "SHADOW_AI_DETECTED",
          title: alertTitle,
          message: `Source: ${ev.source} | Business Unit: ${ev.businessUnit} | Requests: ${ev.requestCount} | Uploaded: ${mb} MB | Users: ${ev.uniqueUsers}`,
          severity: alertSeverity,
          entityType: "SHADOW_AI",
          entityId: saved.id,
        });
        alertsTriggered += 1;
      }

      await writeAuditLog(tx, {
        actorId: auth.actorId,
        actorEmail: auth.actorEmail,
        action: "DISCOVERY_SHADOW_AI_INGEST",
        entityType: "SHADOW_AI",
        entityId: saved.id,
        afterState: {
          domain: ev.domain,
          providerName: ev.providerName,
          source: ev.source,
          businessUnit: ev.businessUnit,
          requestCount: saved.requestCount,
          status: saved.status,
        },
      });

      return saved;
    });

    results.push({
      id: record.id,
      domain: record.domain,
      providerName: record.providerName,
      source: record.source,
      businessUnit: record.businessUnit,
      status: record.status,
      requestCount: record.requestCount,
    });
  }

  return NextResponse.json(
    {
      status: "ingested",
      processed: results.length,
      created: createdCount,
      updated: updatedCount,
      alertsTriggered,
      results,
    },
    { status: 201 },
  );
}
