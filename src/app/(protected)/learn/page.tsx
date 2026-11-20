import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TrainingPortalClient } from "@/components/learn/TrainingPortalClient";

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isTrainerEligible = session.role === "ADMIN" || session.role === "GOVERNANCE_OFFICE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aegis Online Training Academy</h1>
        <p className="text-sm text-muted-foreground">
          Interactive role-based training, hands-on labs, knowledge check quiz, and facilitator guide for operationalising FRAME, AAEF, Shadow AI, and Runtime Controls.
        </p>
      </div>
      <TrainingPortalClient
        userName={session.name}
        userRole={session.role}
        isTrainerEligible={isTrainerEligible}
      />
    </div>
  );
}
