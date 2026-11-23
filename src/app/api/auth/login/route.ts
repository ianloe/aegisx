import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authProvider } from "@/lib/auth/provider";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyTotpCode } from "@/lib/auth/mfa";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

const loginSchema = z.union([
  z.object({
    email: z.string().email(),
    password: z.string().min(1),
    mfaCode: z.string().optional(),
  }),
  z.object({
    challengeToken: z.string().min(1),
    mfaCode: z.string().min(6),
  }),
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide valid sign-in credentials." }, { status: 400 });
    }

    if ("challengeToken" in parsed.data) {
      const challengeRow = await prisma.authChallenge.findUnique({
        where: { challenge: parsed.data.challengeToken },
      });
      if (
        !challengeRow ||
        challengeRow.type !== "MFA_PENDING" ||
        challengeRow.expiresAt.getTime() < Date.now() ||
        !challengeRow.userId
      ) {
        return NextResponse.json({ error: "MFA session expired. Please sign in again." }, { status: 401 });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: challengeRow.userId },
        include: { role: { select: { code: true } } },
      });
      if (!dbUser || !dbUser.isActive || !dbUser.mfaEnabled || !dbUser.mfaSecret) {
        return NextResponse.json({ error: "MFA is not active for this account." }, { status: 401 });
      }

      if (!verifyTotpCode(dbUser.mfaSecret, parsed.data.mfaCode)) {
        return NextResponse.json({ error: "Invalid 6-digit authenticator code." }, { status: 401 });
      }

      await prisma.authChallenge.delete({ where: { id: challengeRow.id } });
      const sessionUser = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role.code,
        businessUnitId: dbUser.businessUnitId,
      };
      await setSessionCookie(sessionUser);
      await writeAuditLog(prisma, {
        actorId: sessionUser.id,
        actorEmail: sessionUser.email,
        action: "LOGIN_MFA",
        entityType: "USER",
        entityId: sessionUser.id,
        afterState: { role: sessionUser.role },
      });
      return NextResponse.json({ user: sessionUser });
    }

    const user = await authProvider.authenticateCredentials(parsed.data.email, parsed.data.password);
    if (!user) {
      log("warn", "Failed login attempt", { email: parsed.data.email });
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaEnabled: true, mfaSecret: true },
    });

    if (dbUser?.mfaEnabled && dbUser.mfaSecret) {
      if (!parsed.data.mfaCode) {
        const challengeToken = crypto.randomBytes(24).toString("hex");
        await prisma.authChallenge.create({
          data: {
            challenge: challengeToken,
            userId: user.id,
            type: "MFA_PENDING",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
        return NextResponse.json({ mfaRequired: true, challengeToken });
      }

      if (!verifyTotpCode(dbUser.mfaSecret, parsed.data.mfaCode)) {
        return NextResponse.json({ error: "Invalid 6-digit authenticator code." }, { status: 401 });
      }
    }

    await setSessionCookie(user);
    await writeAuditLog(prisma, {
      actorId: user.id,
      actorEmail: user.email,
      action: dbUser?.mfaEnabled ? "LOGIN_MFA" : "LOGIN",
      entityType: "USER",
      entityId: user.id,
      afterState: { role: user.role },
    });

    log("info", "User signed in", { userId: user.id, role: user.role });
    return NextResponse.json({ user });
  } catch (err) {
    log("error", "Login error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Unable to process sign-in request." }, { status: 500 });
  }
}
