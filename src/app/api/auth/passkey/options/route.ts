import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWebAuthnChallenge, getRpInfo } from "@/lib/auth/passkey";

export async function POST(request: Request) {
  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: string };
    email = typeof body?.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : undefined;
  } catch {
    email = undefined;
  }

  const { rpId } = getRpInfo(request);
  const challenge = generateWebAuthnChallenge();

  await prisma.authChallenge.create({
    data: {
      challenge,
      type: "WEBAUTHN_AUTH",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  let allowCredentials: Array<{ id: string; type: "public-key" }> = [];
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { webAuthnCredentials: { select: { credentialId: true } } },
    });
    if (user) {
      allowCredentials = user.webAuthnCredentials.map((c) => ({
        id: c.credentialId,
        type: "public-key" as const,
      }));
    }
  }

  return NextResponse.json({ challenge, rpId, allowCredentials });
}
