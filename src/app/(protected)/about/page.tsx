import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AboutPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">About &amp; Governance Frameworks</h1>
        <p className="text-sm text-muted-foreground">
          Methodology, licensing attribution, and configuration governance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Framework Attribution</CardTitle>
          <CardDescription>Intellectual property and licensing notice</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>FRAME and AAEF by Ian Loe, Tactics Solutions, licensed CC BY-NC 4.0.</strong>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            AI Governance Command Centre operationalises FRAME as the enterprise governance envelope and AAEF as the
            agent-level evaluation discipline inside that envelope. Every metric, score, profile assignment, and return
            figure is designed to remain traceable to its underlying source evidence.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>FRAME</CardTitle>
              <Badge variant="info">Governance Envelope</Badge>
            </div>
            <CardDescription>Five enterprise deployment dimensions</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p><strong>Focus:</strong> Domain, operational scope, and intended business outcome.</p>
            <p><strong>Roles:</strong> Named accountable owner, human oversight, and escalation path.</p>
            <p><strong>Authority:</strong> Decision rights split into autonomous, human-confirmed, and out of scope.</p>
            <p><strong>Metrics:</strong> Activity metrics (usage, volume) separated from outcome metrics (business result).</p>
            <p><strong>Evaluation:</strong> Ongoing review of performance, objective alignment, governance compliance, and adoption.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>AAEF</CardTitle>
              <Badge variant="default">Agent Evaluation</Badge>
            </div>
            <CardDescription>AI Agent Evaluation Framework (30-day, 90-day, ongoing)</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p><strong>Dimensions:</strong> Task Competence, Judgement Quality, Boundary Adherence (binary), Collaboration Effectiveness, and Improvement Trajectory (improving, stable, degrading).</p>
            <p><strong>Performance Profiles:</strong> Operational, Developing, Restricted, Under Review.</p>
            <p><strong>Consequences:</strong> Maps transparently from standard oversight to enhanced oversight, restricted autonomy, or suspension of autonomous operation.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
