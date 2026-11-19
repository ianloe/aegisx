import { requirePageSession } from "@/lib/auth/session";
import { UserManualClient } from "@/components/manual/UserManualClient";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  await requirePageSession();

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Aegis User Manual</h1>
        <p className="text-sm text-muted-foreground">
          Practical practitioner guide for operating FRAME, AAEF, risk governance, regulatory readiness, ROI tracking,
          and administration in Aegis.
        </p>
      </div>
      <UserManualClient />
    </div>
  );
}
