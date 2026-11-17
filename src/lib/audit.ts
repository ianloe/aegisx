import { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface AuditInput {
  actorId?: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
}

/**
 * Records an immutable audit log entry. Pass the active Prisma transaction
 * client when called inside `$transaction` so the audit entry commits atomically.
 */
export async function writeAuditLog(db: DbClient, input: AuditInput) {
  return db.auditLogEntry.create({
    data: {
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.beforeState !== undefined ? (input.beforeState as Prisma.InputJsonValue) : Prisma.JsonNull,
      afterState: input.afterState !== undefined ? (input.afterState as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}
