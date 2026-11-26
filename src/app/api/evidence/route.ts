import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { validateSafeHttpUrl } from "@/lib/security/url-guard";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

export async function GET(request: Request) {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") || undefined;
  const entityId = searchParams.get("entityId") || undefined;

  const items = await prisma.evidence.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireApiSession("evidence:write");
  if (auth.error) return auth.error;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const entityType = String(formData.get("entityType") || "ASSET").trim();
    const entityId = String(formData.get("entityId") || "").trim();
    const file = formData.get("file");

    if (!title || !entityId || !(file instanceof File)) {
      return NextResponse.json({ error: "Title, target record, and file are required." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File exceeds maximum size of 15 MB." }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, "");
    const storedName = `${randomUUID()}${ext}`;
    const fullPath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, storedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(fullPath, buffer);

    const created = await prisma.$transaction(async (tx) => {
      const ev = await tx.evidence.create({
        data: {
          title,
          type: "FILE",
          filePath: storedName,
          originalFilename: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          entityType,
          entityId,
          uploadedById: auth.session.id,
        },
      });
      await writeAuditLog(tx, {
        actorId: auth.session.id,
        actorEmail: auth.session.email,
        action: "UPLOAD_EVIDENCE",
        entityType: "EVIDENCE",
        entityId: ev.id,
        afterState: { title: ev.title, filename: ev.originalFilename, target: `${entityType}:${entityId}` },
      });
      return ev;
    });

    return NextResponse.json({ evidence: created }, { status: 201 });
  }

  const body = await request.json();
  const title = String(body.title || "").trim();
  const url = String(body.url || "").trim();
  const entityType = String(body.entityType || "ASSET").trim();
  const entityId = String(body.entityId || "").trim();

  if (!title || !url || !entityId) {
    return NextResponse.json({ error: "Title, URL, and target record are required." }, { status: 400 });
  }
  const urlCheck = validateSafeHttpUrl(url, { allowPrivateNetwork: true });
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.error || "Only http:// and https:// URLs are allowed." }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const ev = await tx.evidence.create({
      data: {
        title,
        type: "LINK",
        url,
        entityType,
        entityId,
        uploadedById: auth.session.id,
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "ATTACH_EVIDENCE_LINK",
      entityType: "EVIDENCE",
      entityId: ev.id,
      afterState: { title: ev.title, url: ev.url, target: `${entityType}:${entityId}` },
    });
    return ev;
  });

  return NextResponse.json({ evidence: created }, { status: 201 });
}
