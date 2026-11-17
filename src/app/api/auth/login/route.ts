import { NextResponse } from "next/server";
import { z } from "zod";
import { authProvider } from "@/lib/auth/provider";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid email address and password." }, { status: 400 });
    }

    const user = await authProvider.authenticateCredentials(parsed.data.email, parsed.data.password);
    if (!user) {
      log("warn", "Failed login attempt", { email: parsed.data.email });
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await setSessionCookie(user);
    await writeAuditLog(prisma, {
      actorId: user.id,
      actorEmail: user.email,
      action: "LOGIN",
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
