import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiSession("assets:read");
  if (auth.error) return auth.error;
  if (auth.session.role !== "ADMIN" && auth.session.role !== "GOVERNANCE_OFFICE") {
    return NextResponse.json({ error: "Governance Office or Administrator access required." }, { status: 403 });
  }

  const [users, roles, businessUnits] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, code: true, name: true } },
        businessUnit: { select: { id: true, code: true, name: true, country: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ users, roles, businessUnits });
}

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  roleId: z.string().min(1),
  businessUnitId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user input.", details: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: parsed.data.name.trim(),
        passwordHash: hashPassword(parsed.data.password),
        roleId: parsed.data.roleId,
        businessUnitId: parsed.data.businessUnitId ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        role: { select: { id: true, code: true, name: true } },
        businessUnit: { select: { id: true, code: true, name: true } },
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "CREATE_USER",
      entityType: "USER",
      entityId: user.id,
      afterState: { email: user.email, name: user.name, role: user.role.code },
    });
    return user;
  });

  return NextResponse.json({ user: created }, { status: 201 });
}

const patchUserSchema = z.object({
  id: z.string().min(1),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
  businessUnitId: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiSession("admin:config");
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  if (parsed.data.id === auth.session.id && parsed.data.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own active administrator account." }, { status: 400 });
  }

  const before = await prisma.user.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, email: true, roleId: true, isActive: true, businessUnitId: true },
  });
  if (!before) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: parsed.data.id },
      data: {
        roleId: parsed.data.roleId ?? before.roleId,
        isActive: parsed.data.isActive ?? before.isActive,
        businessUnitId: parsed.data.businessUnitId !== undefined ? parsed.data.businessUnitId : before.businessUnitId,
        ...(parsed.data.password ? { passwordHash: hashPassword(parsed.data.password) } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        role: { select: { id: true, code: true, name: true } },
        businessUnit: { select: { id: true, code: true, name: true } },
      },
    });
    await writeAuditLog(tx, {
      actorId: auth.session.id,
      actorEmail: auth.session.email,
      action: "UPDATE_USER",
      entityType: "USER",
      entityId: u.id,
      beforeState: before,
      afterState: {
        roleId: u.role.id,
        isActive: u.isActive,
        businessUnitId: u.businessUnit?.id ?? null,
        passwordReset: Boolean(parsed.data.password),
      },
    });
    return u;
  });

  return NextResponse.json({ user: updated });
}
