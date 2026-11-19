import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/auth/session";
import { ComplianceClient, ComplianceFrameworkSummary } from "@/components/compliance/ComplianceClient";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  await requirePageSession();

  const frameworks = await prisma.framework.findMany({
    include: {
      requirements: {
        include: {
          mappings: {
            include: {
              control: {
                include: {
                  owner: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { code: "asc" },
      },
    },
    orderBy: { code: "asc" },
  });

  const controlIds = frameworks.flatMap((fw) =>
    fw.requirements.flatMap((req) => req.mappings.map((m) => m.control.id)),
  );
  const evidenceCounts = controlIds.length
    ? await prisma.evidence.groupBy({
        by: ["entityId"],
        where: { entityType: "CONTROL", entityId: { in: Array.from(new Set(controlIds)) } },
        _count: { _all: true },
      })
    : [];
  const evidenceMap = new Map(evidenceCounts.map((e) => [e.entityId, e._count._all]));

  const summary: ComplianceFrameworkSummary[] = frameworks.map((fw) => {
    const reqRows = fw.requirements.map((req) => {
      const controls = req.mappings.map((m) => {
        return {
          id: m.control.id,
          code: m.control.controlCode,
          title: m.control.title,
          ownerName: m.control.owner?.name ?? "Unassigned",
          effectiveness: String(m.control.effectiveness),
          lastTestedAt: m.control.lastTestedAt ? m.control.lastTestedAt.toISOString() : null,
          evidenceCount: evidenceMap.get(m.control.id) ?? 0,
        };
      });
      const hasMapped = controls.length > 0;
      const hasEffective = controls.some((c) => c.effectiveness === "EFFECTIVE");
      const hasIneffective = controls.some((c) => c.effectiveness === "INEFFECTIVE");
      const status = !hasMapped
        ? ("GAP_UNMAPPED" as const)
        : hasIneffective
          ? ("GAP_INEFFECTIVE" as const)
          : hasEffective
            ? ("COVERED" as const)
            : ("PARTIAL_OR_UNTESTED" as const);

      return {
        id: req.id,
        code: req.code,
        title: req.title,
        description: req.description,
        status,
        controls,
      };
    });

    const total = reqRows.length;
    const mapped = reqRows.filter((r) => r.status !== "GAP_UNMAPPED").length;
    const covered = reqRows.filter((r) => r.status === "COVERED").length;

    return {
      id: fw.id,
      code: fw.code,
      name: fw.name,
      version: fw.version,
      jurisdiction: fw.version || "Global",
      totalRequirements: total,
      mappedRequirements: mapped,
      effectiveRequirements: covered,
      coveragePct: total > 0 ? Math.round((mapped / total) * 100) : 0,
      effectivePct: total > 0 ? Math.round((covered / total) * 100) : 0,
      requirements: reqRows,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Regulatory Readiness &amp; Crosswalk</h1>
        <p className="text-sm text-muted-foreground">
          Monitor control coverage, testing effectiveness, and gaps across FRAME, AAEF, ISO/IEC 42001, EU AI Act,
          NIST AI RMF, and Singapore MAS guidelines.
        </p>
      </div>
      <ComplianceClient frameworks={summary} />
    </div>
  );
}
