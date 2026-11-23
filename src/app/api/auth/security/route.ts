import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from "@/lib/auth/mfa";
import { generateWebAuthnChallenge, getRpInfo } from "@/lib/auth/passkey";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      mfaEnabled: true,
      webAuthnCredentials: {
        select: { id: true, credentialId: true, deviceName: true, createdAt: true, lastUsedAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json({
    mfaEnabled: Boolean(user?.mfaEnabled),
    passkeys: user?.webAuthnCredentials ?? [],
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SETUP_MFA") }),
  z.object({ action: z.literal("ENABLE_MFA"), secret: z.string().min(16), code: z.string().min(6) }),
  z.object({ action: z.literal("DISABLE_MFA"), code: z.string().min(6) }),
  z.object({ action: z.literal("PASSKEY_REGISTER_OPTIONS") }),
  z.object({
    action: z.literal("PASSKEY_REGISTER_VERIFY"),
    challenge: z.string().min(1),
    credentialId: z.string().min(1),
    publicKeySpki: z.string().min(16),
    algorithm: z.number().int().default(-7),
    deviceName: z.string().min(1).max(80).default("Passkey"),
  }),
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid security request" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.action === "SETUP_MFA") {
    const secret = generateTotpSecret();
    const otpauthUri = buildOtpAuthUri(session.email, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });
    return NextResponse.json({ secret, otpauthUri, qrDataUrl });
  }

  if (data.action === "ENABLE_MFA") {
    if (!verifyTotpCode(data.secret, data.code)) {
      return NextResponse.json({ error: "Invalid 6-digit authenticator code." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: session.id },
      data: { mfaEnabled: true, mfaSecret: data.secret },
    });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "USER_MFA_ENABLED",
      entityType: "USER",
      entityId: session.id,
    });
    return NextResponse.json({ mfaEnabled: true });
  }

  if (data.action === "DISABLE_MFA") {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { mfaSecret: true },
    });
    if (!user?.mfaSecret || !verifyTotpCode(user.mfaSecret, data.code)) {
      return NextResponse.json({ error: "Invalid 6-digit authenticator code." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: session.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    await writeAuditLog(prisma, {
      actorId: session.id,
      actorEmail: session.email,
      action: "USER_MFA_DISABLED",
      entityType: "USER",
      entityId: session.id,
    });
    return NextResponse.json({ mfaEnabled: false });
  }

  if (data.action === "PASSKEY_REGISTER_OPTIONS") {
    const { rpId } = getRpInfo(request);
    const challenge = generateWebAuthnChallenge();
    await prisma.authChallenge.create({
      data: {
        challenge,
        userId: session.id,
        type: "WEBAUTHN_REG",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    return NextResponse.json({
      challenge,
      rp: { name: "Aegis AI Governance Platform", id: rpId },
      user: {
        id: Buffer.from(session.id, "utf8").toString("base64url"),
        name: session.email,
        displayName: session.name,
      },
    });
  }

  // PASSKEY_REGISTER_VERIFY
  const ch = await prisma.authChallenge.findUnique({ where: { challenge: data.challenge } });
  if (!ch || ch.type !== "WEBAUTHN_REG" || ch.userId !== session.id || ch.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Passkey registration challenge expired." }, { status: 400 });
  }

  await prisma.authChallenge.delete({ where: { id: ch.id } });
  const cred = await prisma.webAuthnCredential.create({
    data: {
      userId: session.id,
      credentialId: data.credentialId,
      publicKeySpki: data.publicKeySpki,
      algorithm: data.algorithm,
      deviceName: data.deviceName,
    },
  });

  await writeAuditLog(prisma, {
    actorId: session.id,
    actorEmail: session.email,
    action: "USER_PASSKEY_REGISTERED",
    entityType: "USER",
    entityId: session.id,
    afterState: { deviceName: cred.deviceName, credentialId: cred.credentialId },
  });

  return NextResponse.json({ passkey: cred }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Passkey id required" }, { status: 400 });

  await prisma.webAuthnCredential.deleteMany({
    where: { id, userId: session.id },
  });

  return NextResponse.json({ deleted: true });
}
