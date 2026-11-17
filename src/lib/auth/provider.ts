import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "./password";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  businessUnitId: string | null;
}

/**
 * Pluggable authentication provider interface.
 * Implement this interface to add SAML 2.0 or OIDC SSO without modifying routes.
 */
export interface AuthProvider {
  readonly id: string;
  authenticateCredentials(email: string, password: string): Promise<AuthenticatedUser | null>;
}

export class LocalPasswordAuthProvider implements AuthProvider {
  readonly id = "local-password";

  async authenticateCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
    const normalisedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalisedEmail },
      include: { role: true },
    });

    if (!user || !user.isActive) return null;
    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.code,
      businessUnitId: user.businessUnitId,
    };
  }
}

export const authProvider: AuthProvider = new LocalPasswordAuthProvider();
