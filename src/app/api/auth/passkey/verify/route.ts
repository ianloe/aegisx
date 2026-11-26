import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getRpInfo, verifyWebAuthnAssertion } from "@/lib/auth/passkey";
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit";

const verifySchema = z.object({
  challenge: z.string().min(1),
  credentialId: z.string().min(1),
  authenticatorData: z.string().min(1),
  clientDataJSON: z.string().min(1),
  signature: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`passkey:${ip}`, 10, 5 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many passkey attempts. Try again in ${rate.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await request.json();
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid passkey assertion payload." }, { status: 400 });
  }

  const challengeRow = await prisma.authChallenge.findUnique({
    where: { challenge: parsed.data.challenge },
  });
  if (
    !challengeRow ||
    challengeRow.type !== "WEBAUTHN_AUTH" ||
    challengeRow.expiresAt.getTime() < Date.now()
  ) {
    return NextResponse.json({ error: "Passkey challenge expired. Please try again." }, { status: 401 });
  }

  const cred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: parsed.data.credentialId },
    include: {
      user: {
        include: { role: { select: { code: true } } },
      },
    },
  });

  if (!cred || !cred.user.isActive) {
    return NextResponse.json({ error: "Passkey not recognised or user disabled." }, { status: 401 });
  }

  const { rpId, origin } = getRpInfo(request);
  const check = verifyWebAuthnAssertion({
    publicKeySpkiBase64: cred.publicKeySpki,
    authenticatorDataB64Url: parsed.data.authenticatorData,
    clientDataJsonB64Url: parsed.data.clientDataJSON,
    signatureB64Url: parsed.data.signature,
    expectedChallenge: parsed.data.challenge,
    expectedRpId: rpId,
    expectedOrigin: origin,
  });

  if (!check.valid) {
    return NextResponse.json({ error: check.error || "Passkey verification failed." }, { status: 401 });
  }

  if (cred.counter > 0 && check.newCounter <= cred.counter) {
    return NextResponse.json(
      { error: "Passkey signature counter rollback detected (possible cloned authenticator)." },
      { status: 401 },
    );
  }

  await Promise.all([
    prisma.authChallenge.delete({ where: { id: challengeRow.id } }),
    prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter: check.newCounter, lastUsedAt: new Date() },
    }),
  ]);

  const sessionUser = {
    id: cred.user.id,
    email: cred.user.email,
    name: cred.user.name,
    role: cred.user.role.code,
    businessUnitId: cred.user.businessUnitId,
  };

  await setSessionCookie(sessionUser);
  await writeAuditLog(prisma, {
    actorId: sessionUser.id,
    actorEmail: sessionUser.email,
    action: "LOGIN_PASSKEY",
    entityType: "USER",
    entityId: sessionUser.id,
    afterState: { credentialId: cred.credentialId, deviceName: cred.deviceName },
  });

  return NextResponse.json({ user: sessionUser });
}
