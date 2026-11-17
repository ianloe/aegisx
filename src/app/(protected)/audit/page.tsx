import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { RoleCode } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; action?: string }>;
}) {
  const session = await requirePageSession();
  if (!hasPermission(session.role as RoleCode, "audit:read")) {
    redirect("/");
  }

  const sp = await searchParams;
  const entityType = sp.entityType?.trim() || undefined;
  const action = sp.action?.trim() || undefined;

  const entries = await prisma.auditLogEntry.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Immutable Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Append-only record of every governance, configuration, assessment, and user mutation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Entries (Latest 100)</CardTitle>
          <CardDescription>Showing actor, action, target entity, and before/after snapshots</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">Timestamp</th>
                <th className="py-2.5 px-4 font-medium">Actor</th>
                <th className="py-2.5 px-4 font-medium">Action</th>
                <th className="py-2.5 px-4 font-medium">Entity</th>
                <th className="py-2.5 px-4 font-medium">Before / After</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2.5 px-4 whitespace-nowrap tabular-nums text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="py-2.5 px-4 font-medium">{entry.actorEmail}</td>
                  <td className="py-2.5 px-4">
                    <Badge variant="outline">{entry.action}</Badge>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px]">
                    {entry.entityType}
                    <div className="text-muted-foreground">{entry.entityId}</div>
                  </td>
                  <td className="py-2.5 px-4 max-w-md">
                    {entry.beforeState && (
                      <div className="mb-1">
                        <span className="font-semibold text-muted-foreground">Before: </span>
                        <code className="text-[10px] break-all">{JSON.stringify(entry.beforeState)}</code>
                      </div>
                    )}
                    {entry.afterState && (
                      <div>
                        <span className="font-semibold text-muted-foreground">After: </span>
                        <code className="text-[10px] break-all">{JSON.stringify(entry.afterState)}</code>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No audit entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
