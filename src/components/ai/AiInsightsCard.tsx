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

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={keyIdx++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={keyIdx++} className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function FormattedMarkdown({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: { ordered: boolean; items: string[] } | null = null;
  let keyIdx = 0;

  function flushList() {
    if (!listItems) return;
    const ListTag = listItems.ordered ? "ol" : "ul";
    blocks.push(
      <ListTag
        key={keyIdx++}
        className={`space-y-1 pl-5 ${listItems.ordered ? "list-decimal" : "list-disc"}`}
      >
        {listItems.items.map((item, idx) => (
          <li key={idx} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>,
    );
    listItems = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (/^---+$/.test(line)) {
      flushList();
      blocks.push(<hr key={keyIdx++} className="border-border my-2" />);
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const cls =
        level <= 2
          ? "text-sm font-semibold text-foreground pt-1"
          : "text-xs font-semibold uppercase tracking-wide text-foreground pt-1";
      blocks.push(
        <div key={keyIdx++} className={cls}>
          {renderInlineMarkdown(text)}
        </div>,
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (listItems && listItems.ordered) flushList();
      if (!listItems) listItems = { ordered: false, items: [] };
      listItems.items.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (listItems && !listItems.ordered) flushList();
      if (!listItems) listItems = { ordered: true, items: [] };
      listItems.items.push(orderedMatch[1]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={keyIdx++} className="leading-relaxed">
        {renderInlineMarkdown(line)}
      </p>,
    );
  }

  flushList();
  return <div className="space-y-2 text-xs text-muted-foreground">{blocks}</div>;
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
            <div className="rounded-md border border-border bg-surface-muted/40 p-3.5">
              <FormattedMarkdown content={insight ?? ""} />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
