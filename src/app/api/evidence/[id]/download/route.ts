import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const item = await prisma.evidence.findUnique({ where: { id } });
  if (!item || item.type !== "FILE" || !item.filePath) {
    return NextResponse.json({ error: "File evidence not found." }, { status: 404 });
  }

  const safeName = path.basename(item.filePath);
  const fullPath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, safeName);

  try {
    const fileBuffer = await fs.readFile(/*turbopackIgnore: true*/ fullPath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": item.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${(item.originalFilename || safeName).replace(/"/g, "")}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Stored file missing from volume." }, { status: 404 });
  }
}
