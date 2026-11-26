import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { AuthenticatedUser } from "./provider";
import { hasPermission, Permission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "aegisx_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export interface SessionPayload extends AuthenticatedUser {
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32 && !secret.includes("CHANGE_ME")) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters in production.");
  }
  return "dev-only-insecure-session-secret-do-not-use-in-prod";
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function encodeSession(user: AuthenticatedUser): string {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = sign(body);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
    if (
      !parsed.exp ||
      parsed.exp < Math.floor(Date.now() / 1000) ||
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const decoded = decodeSession(token);
  if (!decoded) return null;

  // Verify the user is still active and reflect any role or BU changes immediately
  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      isActive: true,
      email: true,
      name: true,
      businessUnitId: true,
      role: { select: { code: true } },
    },
  });
  if (!dbUser || !dbUser.isActive) {
    return null;
  }

  return {
    id: decoded.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role.code,
    businessUnitId: dbUser.businessUnitId,
    exp: decoded.exp,
  };
}

export async function setSessionCookie(user: AuthenticatedUser): Promise<void> {
  const cookieStore = await cookies();
  const token = encodeSession(user);
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_HTTP !== "true",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requirePageSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireApiSession(requiredPermission?: Permission): Promise<
  { session: SessionPayload; error?: never } | { session?: never; error: Response }
> {
  const session = await getSession();
  if (!session) {
    return { error: Response.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (requiredPermission && !hasPermission(session.role as RoleCode, requiredPermission)) {
    return { error: Response.json({ error: "Insufficient permissions for this action." }, { status: 403 }) };
  }
  return { session };
}
