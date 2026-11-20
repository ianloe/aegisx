import { prisma } from "../prisma";

export type AiProviderType = "OPENAI" | "OPENROUTER" | "GEMINI" | "ANTHROPIC" | "CUSTOM_OPENAI";

export interface AiProviderConfig {
  enabled: boolean;
  provider: AiProviderType;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
}

export interface MaskedAiProviderConfig {
  enabled: boolean;
  provider: AiProviderType;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  maskedKey: string;
  temperature: number;
}

export const AI_PROVIDER_CONFIG_KEY = "AI_INSIGHTS_PROVIDER";

export const DEFAULT_AI_MODELS: Record<AiProviderType, string> = {
  OPENAI: "gpt-4o-mini",
  OPENROUTER: "openai/gpt-4o-mini",
  GEMINI: "gemini-2.5-flash",
  ANTHROPIC: "claude-3-5-sonnet-latest",
  CUSTOM_OPENAI: "llama3.1",
};

export const DEFAULT_AI_CONFIG: AiProviderConfig = {
  enabled: false,
  provider: "OPENROUTER",
  model: "openai/gpt-4o-mini",
  baseUrl: "",
  apiKey: "",
  temperature: 0.2,
};

export function maskApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function maskAiConfig(cfg: Partial<AiProviderConfig> | null | undefined): MaskedAiProviderConfig {
  const merged: AiProviderConfig = {
    ...DEFAULT_AI_CONFIG,
    ...(cfg ?? {}),
  };
  return {
    enabled: Boolean(merged.enabled),
    provider: merged.provider,
    model: merged.model || DEFAULT_AI_MODELS[merged.provider],
    baseUrl: merged.baseUrl || "",
    hasApiKey: Boolean(merged.apiKey && merged.apiKey.trim().length > 0),
    maskedKey: maskApiKey(merged.apiKey || ""),
    temperature: typeof merged.temperature === "number" ? merged.temperature : 0.2,
  };
}

export async function getStoredAiConfig(): Promise<AiProviderConfig> {
  const row = await prisma.governanceConfig.findUnique({
    where: { key: AI_PROVIDER_CONFIG_KEY },
  });
  const val = (row?.valueJson as unknown as Partial<AiProviderConfig>) ?? {};
  return {
    ...DEFAULT_AI_CONFIG,
    ...val,
  };
}

export function buildChatCompletionsUrl(provider: AiProviderType, customBaseUrl: string): string {
  if (provider === "OPENROUTER") return "https://openrouter.ai/api/v1/chat/completions";
  if (provider === "OPENAI") return "https://api.openai.com/v1/chat/completions";
  const base = customBaseUrl.trim().replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  return `${base}/chat/completions`;
}

export async function generateAiCompletion(params: {
  systemPrompt: string;
  userPrompt: string;
  overrideConfig?: AiProviderConfig;
}): Promise<{
  text: string;
  provider: AiProviderType;
  model: string;
}> {
  const cfg = params.overrideConfig ?? (await getStoredAiConfig());
  if (!params.overrideConfig && !cfg.enabled) {
    throw new Error("AI Insights are disabled. Enable and configure an AI provider in Admin Config.");
  }
  if (!cfg.apiKey && cfg.provider !== "CUSTOM_OPENAI") {
    throw new Error(`API key is not configured for ${cfg.provider}.`);
  }

  const model = (cfg.model || DEFAULT_AI_MODELS[cfg.provider]).trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    if (cfg.provider === "GEMINI") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
          generationConfig: { temperature: cfg.temperature ?? 0.2 },
        }),
      });
      const json = (await res.json()) as {
        error?: { message?: string };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      if (!res.ok) {
        throw new Error(json.error?.message || `Gemini API returned HTTP ${res.status}`);
      }
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
      if (!text.trim()) throw new Error("Gemini returned an empty response.");
      return { text: text.trim(), provider: cfg.provider, model };
    }

    if (cfg.provider === "ANTHROPIC") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          temperature: cfg.temperature ?? 0.2,
          system: params.systemPrompt,
          messages: [{ role: "user", content: params.userPrompt }],
        }),
      });
      const json = (await res.json()) as {
        error?: { message?: string };
        content?: Array<{ type?: string; text?: string }>;
      };
      if (!res.ok) {
        throw new Error(json.error?.message || `Anthropic API returned HTTP ${res.status}`);
      }
      const text = json.content?.filter((c) => c.type === "text").map((c) => c.text || "").join("") ?? "";
      if (!text.trim()) throw new Error("Anthropic returned an empty response.");
      return { text: text.trim(), provider: cfg.provider, model };
    }

    // OPENAI, OPENROUTER, CUSTOM_OPENAI
    if (cfg.provider === "CUSTOM_OPENAI" && !cfg.baseUrl.trim()) {
      throw new Error("Base URL is required for Custom OpenAI-Compatible providers.");
    }
    const url = buildChatCompletionsUrl(cfg.provider, cfg.baseUrl);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cfg.apiKey.trim()) {
      headers.Authorization = `Bearer ${cfg.apiKey.trim()}`;
    }
    if (cfg.provider === "OPENROUTER") {
      headers["HTTP-Referer"] = "https://github.com/ianloe/aegisx";
      headers["X-Title"] = "Aegis AI Governance Platform";
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: cfg.temperature ?? 0.2,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
      }),
    });
    const json = (await res.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!res.ok) {
      throw new Error(json.error?.message || `${cfg.provider} API returned HTTP ${res.status}`);
    }
    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error(`${cfg.provider} returned an empty response.`);
    return { text: text.trim(), provider: cfg.provider, model };
  } finally {
    clearTimeout(timeout);
  }
}
