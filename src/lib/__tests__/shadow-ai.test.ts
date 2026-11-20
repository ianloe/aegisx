import { describe, expect, it } from "vitest";
import { DiscoverySource } from "@prisma/client";
import { matchAiDomain, normalizeDiscoveryPayload } from "../governance/shadow-ai";

describe("Shadow AI Domain Catalogue & Discovery Normaliser", () => {
  it("normalises URLs/ports and matches known AI providers and subdomains", () => {
    expect(matchAiDomain("https://api.openai.com:443/v1/chat")).toMatchObject({
      domain: "api.openai.com",
      providerName: "OpenAI API",
      category: "LLM API",
      isKnownAi: true,
    });

    expect(matchAiDomain("eu.api.anthropic.com")).toMatchObject({
      domain: "eu.api.anthropic.com",
      providerName: "Anthropic API",
      category: "LLM API",
      isKnownAi: true,
    });

    expect(matchAiDomain("internal-llm.corp.local")).toMatchObject({
      domain: "internal-llm.corp.local",
      providerName: "internal-llm.corp.local",
      category: "Other AI",
      isKnownAi: false,
    });
  });

  it("normalises batched SASE and DNS discovery events", () => {
    const events = normalizeDiscoveryPayload({
      events: [
        {
          domain: "chatgpt.com",
          source: "SWG",
          department: "Marketing",
          hits: 142,
          bytesOut: 4520000,
          users: 11,
        },
        {
          host: "api.groq.com",
          feedType: "DNS",
          businessUnit: "Risk Analytics",
          requestCount: 38,
        },
        {
          domain: "random-news-site.com",
          source: "DNS",
          onlyKnownAi: true,
        },
      ],
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      domain: "chatgpt.com",
      providerName: "ChatGPT",
      source: DiscoverySource.SASE,
      businessUnit: "Marketing",
      requestCount: 142,
      bytesUploaded: 4520000,
      uniqueUsers: 11,
    });
    expect(events[1]).toMatchObject({
      domain: "api.groq.com",
      providerName: "Groq",
      source: DiscoverySource.DNS,
      businessUnit: "Risk Analytics",
      requestCount: 38,
    });
  });
});
