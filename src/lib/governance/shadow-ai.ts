import { DiscoverySource } from "@prisma/client";

export interface AiProviderSignature {
  domain: string;
  providerName: string;
  category: string;
}

export const AI_PROVIDER_CATALOGUE: AiProviderSignature[] = [
  { domain: "api.openai.com", providerName: "OpenAI API", category: "LLM API" },
  { domain: "chatgpt.com", providerName: "ChatGPT", category: "Consumer Chat" },
  { domain: "chat.openai.com", providerName: "ChatGPT", category: "Consumer Chat" },
  { domain: "openai.com", providerName: "OpenAI", category: "LLM API" },
  { domain: "api.anthropic.com", providerName: "Anthropic API", category: "LLM API" },
  { domain: "claude.ai", providerName: "Claude", category: "Consumer Chat" },
  { domain: "anthropic.com", providerName: "Anthropic", category: "LLM API" },
  { domain: "generativelanguage.googleapis.com", providerName: "Google Gemini API", category: "LLM API" },
  { domain: "gemini.google.com", providerName: "Google Gemini", category: "Consumer Chat" },
  { domain: "aistudio.google.com", providerName: "Google AI Studio", category: "LLM API" },
  { domain: "perplexity.ai", providerName: "Perplexity", category: "Consumer Chat" },
  { domain: "poe.com", providerName: "Poe", category: "Consumer Chat" },
  { domain: "api.groq.com", providerName: "Groq", category: "LLM API" },
  { domain: "groq.com", providerName: "Groq", category: "LLM API" },
  { domain: "api.together.xyz", providerName: "Together AI", category: "LLM API" },
  { domain: "api.replicate.com", providerName: "Replicate", category: "LLM API" },
  { domain: "api.cohere.ai", providerName: "Cohere", category: "LLM API" },
  { domain: "api.mistral.ai", providerName: "Mistral AI", category: "LLM API" },
  { domain: "chat.mistral.ai", providerName: "Mistral Le Chat", category: "Consumer Chat" },
  { domain: "api.deepseek.com", providerName: "DeepSeek", category: "LLM API" },
  { domain: "chat.deepseek.com", providerName: "DeepSeek", category: "Consumer Chat" },
  { domain: "openrouter.ai", providerName: "OpenRouter", category: "LLM API" },
  { domain: "huggingface.co", providerName: "Hugging Face", category: "Model Hub" },
  { domain: "ollama.ai", providerName: "Ollama", category: "Local / Edge LLM" },
  { domain: "cursor.sh", providerName: "Cursor", category: "Coding Assistant" },
  { domain: "cursor.com", providerName: "Cursor", category: "Coding Assistant" },
  { domain: "api.githubcopilot.com", providerName: "GitHub Copilot", category: "Coding Assistant" },
  { domain: "codeium.com", providerName: "Windsurf / Codeium", category: "Coding Assistant" },
  { domain: "otter.ai", providerName: "Otter.ai", category: "Meeting Assistant" },
  { domain: "fireflies.ai", providerName: "Fireflies.ai", category: "Meeting Assistant" },
  { domain: "read.ai", providerName: "Read.ai", category: "Meeting Assistant" },
  { domain: "midjourney.com", providerName: "Midjourney", category: "Image / Media" },
  { domain: "elevenlabs.io", providerName: "ElevenLabs", category: "Image / Media" },
  { domain: "runwayml.com", providerName: "Runway", category: "Image / Media" },
  { domain: "smith.langchain.com", providerName: "LangSmith", category: "Agent / Observability" },
  { domain: "logfire.pydantic.dev", providerName: "Pydantic Logfire", category: "Agent / Observability" },
];

export interface MatchedAiDomain {
  domain: string;
  providerName: string;
  category: string;
  isKnownAi: boolean;
}

export function normalizeHostname(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const withoutProto = trimmed.replace(/^https?:\/\//, "");
  const hostPort = withoutProto.split("/")[0]?.split("?")[0] ?? "";
  return hostPort.split(":")[0]?.replace(/\.+$/, "") ?? "";
}

export function matchAiDomain(
  rawDomain: string,
  customProviderName?: string | null,
  customCategory?: string | null,
): MatchedAiDomain {
  const domain = normalizeHostname(rawDomain);
  const exact = AI_PROVIDER_CATALOGUE.find((entry) => entry.domain === domain);
  if (exact) {
    return {
      domain,
      providerName: customProviderName || exact.providerName,
      category: customCategory || exact.category,
      isKnownAi: true,
    };
  }

  const suffix = AI_PROVIDER_CATALOGUE.find(
    (entry) => domain.endsWith(`.${entry.domain}`),
  );
  if (suffix) {
    return {
      domain,
      providerName: customProviderName || suffix.providerName,
      category: customCategory || suffix.category,
      isKnownAi: true,
    };
  }

  return {
    domain,
    providerName: customProviderName || domain,
    category: customCategory || "Other AI",
    isKnownAi: false,
  };
}

export interface NormalizedDiscoveryEvent {
  domain: string;
  providerName: string;
  category: string;
  source: DiscoverySource;
  businessUnit: string;
  requestCount: number;
  bytesUploaded: number;
  uniqueUsers: number;
  isKnownAi: boolean;
}

function parseSource(val: unknown): DiscoverySource {
  const s = typeof val === "string" ? val.trim().toUpperCase() : "";
  if (s === "SASE" || s === "SWG" || s === "CASB") return DiscoverySource.SASE;
  if (s === "DNS") return DiscoverySource.DNS;
  if (s === "IDP" || s === "OAUTH" || s === "SSO") return DiscoverySource.IDP;
  if (s === "CLOUD") return DiscoverySource.CLOUD;
  if (s === "EXPENSE" || s === "FINANCE") return DiscoverySource.EXPENSE;
  return DiscoverySource.SASE;
}

function asPositiveInt(val: unknown, fallback: number): number {
  const n = typeof val === "number" ? val : typeof val === "string" ? Number(val) : NaN;
  if (Number.isFinite(n) && n >= 0) return Math.round(n);
  return fallback;
}

function asNonNegativeNumber(val: unknown, fallback: number): number {
  const n = typeof val === "number" ? val : typeof val === "string" ? Number(val) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return fallback;
}

/**
 * Normalises SASE, DNS, IdP, Cloud, or Expense Shadow AI discovery feeds
 * (single event, `{ events: [...] }`, or top-level array).
 */
export function normalizeDiscoveryPayload(rawBody: unknown): NormalizedDiscoveryEvent[] {
  if (!rawBody || typeof rawBody !== "object") return [];

  const items: unknown[] = Array.isArray(rawBody)
    ? rawBody
    : Array.isArray((rawBody as Record<string, unknown>).events)
      ? ((rawBody as Record<string, unknown>).events as unknown[])
      : [rawBody];

  const results: NormalizedDiscoveryEvent[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const rawDomain =
      (typeof obj.domain === "string" && obj.domain) ||
      (typeof obj.host === "string" && obj.host) ||
      (typeof obj.destination === "string" && obj.destination) ||
      (typeof obj.appDomain === "string" && obj.appDomain) ||
      "";

    const customProvider = typeof obj.providerName === "string" ? obj.providerName.trim() : null;
    const customCategory = typeof obj.category === "string" ? obj.category.trim() : null;
    const matched = matchAiDomain(rawDomain, customProvider, customCategory);
    if (!matched.domain) continue;

    // If caller only sends raw DNS/SASE traffic without pre-filtering,
    // allow filtering via `onlyKnownAi: true` or keep explicit submissions.
    if (obj.onlyKnownAi === true && !matched.isKnownAi) continue;

    const businessUnit =
      (typeof obj.businessUnit === "string" && obj.businessUnit.trim()) ||
      (typeof obj.department === "string" && obj.department.trim()) ||
      (typeof obj.sourceGroup === "string" && obj.sourceGroup.trim()) ||
      "Unassigned";

    results.push({
      domain: matched.domain,
      providerName: matched.providerName,
      category: matched.category,
      source: parseSource(obj.source ?? obj.feedType),
      businessUnit,
      requestCount: Math.max(1, asPositiveInt(obj.requestCount ?? obj.hits ?? obj.count, 1)),
      bytesUploaded: asNonNegativeNumber(obj.bytesUploaded ?? obj.bytesOut, 0),
      uniqueUsers: Math.max(1, asPositiveInt(obj.uniqueUsers ?? obj.users, 1)),
      isKnownAi: matched.isKnownAi,
    });
  }

  return results;
}
