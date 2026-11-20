"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  scope: "EXECUTIVE_DASHBOARD" | "SHADOW_AI" | "ASSURANCE_AND_RISK";
  title: string;
  description: string;
}

export function AiInsightsCard({ scope, title, description }: Props) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ provider: string; model: string; generatedAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to generate AI insights.");
      } else {
        setInsight(data.insight);
        setMeta({
          provider: data.provider,
          model: data.model,
          generatedAt: data.generatedAt,
        });
      }
    } catch {
      setError("Network error while requesting AI insights.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {meta && (
            <Badge variant="outline">
              {meta.provider} · {meta.model}
            </Badge>
          )}
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={generate}>
            {loading ? "Analysing..." : insight ? "Refresh Insights" : "Generate AI Insights"}
          </Button>
        </div>
      </CardHeader>
      {(insight || error) && (
        <CardContent>
          {error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              {error}{" "}
              <Link href="/admin" className="font-semibold underline underline-offset-2">
                Configure AI Provider in Admin Config
              </Link>
            </div>
          ) : (
            <div className="whitespace-pre-wrap rounded-md border border-border bg-surface-muted/40 p-3.5 text-xs leading-relaxed">
              {insight}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
