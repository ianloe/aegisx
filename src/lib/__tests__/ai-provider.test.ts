import { describe, expect, it } from "vitest";
import { buildChatCompletionsUrl, maskAiConfig, maskApiKey } from "../ai/provider-client";

describe("BYO-AI Provider Client Helpers", () => {
  it("masks API keys without exposing secrets", () => {
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey("short")).toBe("****");
    expect(maskApiKey("sk-or-v1-1234567890abcdef")).toBe("sk-o...cdef");

    const masked = maskAiConfig({
      enabled: true,
      provider: "ANTHROPIC",
      model: "claude-3-5-sonnet-latest",
      apiKey: "sk-ant-api03-secretkey99",
    });
    expect(masked.hasApiKey).toBe(true);
    expect(masked.maskedKey).toBe("sk-a...ey99");
    expect("apiKey" in masked).toBe(false);
  });

  it("builds chat completions URLs for OpenAI, OpenRouter, and custom endpoints", () => {
    expect(buildChatCompletionsUrl("OPENAI", "")).toBe("https://api.openai.com/v1/chat/completions");
    expect(buildChatCompletionsUrl("OPENROUTER", "")).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(buildChatCompletionsUrl("CUSTOM_OPENAI", "http://localhost:11434/v1/")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
    expect(buildChatCompletionsUrl("CUSTOM_OPENAI", "https://my-gateway.internal/v1/chat/completions")).toBe(
      "https://my-gateway.internal/v1/chat/completions",
    );
  });
});
