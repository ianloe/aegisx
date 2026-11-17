import React from "react";
import { requirePageSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();

  return (
    <AppShell
      user={{
        id: session.id,
        email: session.email,
        name: session.name,
        role: session.role,
      }}
    >
      {children}
    </AppShell>
  );
}
