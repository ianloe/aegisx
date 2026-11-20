import { describe, expect, it } from "vitest";
import { Currency, Severity } from "@prisma/client";
import { normalizePydanticTelemetry } from "../governance/pydantic-telemetry";

describe("PydanticAI & Logfire OTLP Telemetry Normalizer", () => {
  it("normalizes a successful PydanticAI run with token usage and cost", () => {
    const events = normalizePydanticTelemetry({
      framework: "pydantic-ai",
      assetCode: "AST-001",
      agentName: "claims_triage_agent",
      model: "openai:gpt-4o",
      status: "ok",
      usage: {
        requests: 2,
        request_tokens: 1200,
        response_tokens: 350,
        total_tokens: 1550,
      },
      costAmount: 0.045,
      currency: "USD",
      quarter: "2026-Q4",
      durationMs: 1120,
      toolCalls: 3,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      assetCode: "AST-001",
      agentName: "claims_triage_agent",
      model: "openai:gpt-4o",
      status: "ok",
      requestTokens: 1200,
      responseTokens: 350,
      totalTokens: 1550,
      requests: 2,
      costAmount: 0.045,
      currency: Currency.USD,
      quarter: "2026-Q4",
      durationMs: 1120,
      toolCalls: 3,
      source: "pydantic-ai",
    });
  });

  it("classifies UsageLimitExceeded and guardrail failures as HIGH severity breaches", () => {
    const events = normalizePydanticTelemetry({
      framework: "pydantic-ai",
      assetCode: "AST-002",
      agentName: "underwriting_agent",
      status: "usage_limit_exceeded",
      errorType: "UsageLimitExceeded",
      errorMessage: "Exceeded request_limit of 10",
    });

    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("breach");
    expect(events[0].breachSeverity).toBe(Severity.HIGH);
    expect(events[0].breachReason).toBe("Exceeded request_limit of 10");
  });

  it("normalizes OTLP resourceSpans from Pydantic Logfire with query assetCode fallback", () => {
    const events = normalizePydanticTelemetry(
      {
        resourceSpans: [
          {
            resource: {
              attributes: [{ key: "service.name", value: { stringValue: "treasury-pydantic-worker" } }],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    name: "agent run",
                    startTimeUnixNano: "1700000000000000000",
                    endTimeUnixNano: "1700000001500000000",
                    status: { code: "ERROR", message: "UnexpectedModelBehavior: tool validation failed" },
                    attributes: [
                      { key: "pydantic_ai.agent", value: { stringValue: "fx_hedging_agent" } },
                      { key: "gen_ai.request.model", value: { stringValue: "anthropic:claude-3-5-sonnet" } },
                      { key: "gen_ai.usage.input_tokens", value: { intValue: 800 } },
                      { key: "gen_ai.usage.output_tokens", value: { intValue: 120 } },
                      { key: "exception.type", value: { stringValue: "UnexpectedModelBehavior" } },
                      { key: "aegis.cost", value: { doubleValue: 0.018 } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      "AST-003",
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      assetCode: "AST-003",
      agentName: "fx_hedging_agent",
      model: "anthropic:claude-3-5-sonnet",
      status: "breach",
      breachSeverity: Severity.MEDIUM,
      requestTokens: 800,
      responseTokens: 120,
      totalTokens: 920,
      costAmount: 0.018,
      durationMs: 1500,
      source: "logfire-otlp",
    });
  });
});
