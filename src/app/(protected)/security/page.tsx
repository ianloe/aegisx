import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SecuritySettingsClient } from "@/components/auth/SecuritySettingsClient";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Security (MFA &amp; Passkeys)</h1>
        <p className="text-sm text-muted-foreground">
          Manage your Authenticator App two-factor authentication (TOTP) and passwordless WebAuthn Passkeys.
        </p>
      </div>
      <SecuritySettingsClient
        initialMfaEnabled={Boolean(user?.mfaEnabled)}
        initialPasskeys={(user?.webAuthnCredentials ?? []).map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
