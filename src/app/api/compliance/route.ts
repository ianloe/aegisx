import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const frameworkCode = searchParams.get("framework") || undefined;
  const format = searchParams.get("format") || "json";

  const frameworks = await prisma.framework.findMany({
    where: frameworkCode ? { code: frameworkCode } : undefined,
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

  const summary = frameworks.map((fw) => {
    const reqRows = fw.requirements.map((req) => {
      const controls = req.mappings.map((m) => {
        return {
          id: m.control.id,
          code: m.control.controlCode,
          title: m.control.title,
          ownerName: m.control.owner?.name ?? "Unassigned",
          effectiveness: m.control.effectiveness,
          lastTestedAt: m.control.lastTestedAt ?? null,
          evidenceCount: evidenceMap.get(m.control.id) ?? 0,
        };
      });
      const hasMapped = controls.length > 0;
      const hasEffective = controls.some((c) => c.effectiveness === "EFFECTIVE");
      const hasIneffective = controls.some((c) => c.effectiveness === "INEFFECTIVE");
      const status = !hasMapped
        ? "GAP_UNMAPPED"
        : hasIneffective
          ? "GAP_INEFFECTIVE"
          : hasEffective
            ? "COVERED"
            : "PARTIAL_OR_UNTESTED";

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
    const coveragePct = total > 0 ? Math.round((mapped / total) * 100) : 0;
    const effectivePct = total > 0 ? Math.round((covered / total) * 100) : 0;

    return {
      id: fw.id,
      code: fw.code,
      name: fw.name,
      version: fw.version,
      jurisdiction: fw.version || "Global",
      totalRequirements: total,
      mappedRequirements: mapped,
      effectiveRequirements: covered,
      coveragePct,
      effectivePct,
      requirements: reqRows,
    };
  });

  if (format === "csv") {
    const headers = [
      "frameworkCode",
      "frameworkName",
      "jurisdiction",
      "requirementCode",
      "requirementTitle",
      "postureStatus",
      "mappedControls",
      "controlEffectiveness",
      "evidenceCount",
    ];
    const rows: unknown[][] = [];
    for (const fw of summary) {
      for (const req of fw.requirements) {
        rows.push([
          fw.code,
          fw.name,
          fw.jurisdiction || "Global",
          req.code,
          req.title,
          req.status,
          req.controls.map((c) => c.code).join("; ") || "NONE",
          req.controls.map((c) => `${c.code}:${c.effectiveness}`).join("; ") || "UNTESTED",
          req.controls.reduce((acc, c) => acc + c.evidenceCount, 0),
        ]);
      }
    }
    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aegis-compliance-posture-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ frameworks: summary });
}
