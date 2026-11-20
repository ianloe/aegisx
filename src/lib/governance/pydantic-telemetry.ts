import { Currency, Severity } from "@prisma/client";

export interface NormalizedPydanticEvent {
  assetCode: string;
  agentName: string;
  model: string | null;
  status: "ok" | "breach";
  breachSeverity: Severity;
  breachReason: string | null;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  requests: number;
  costAmount: number | null;
  currency: Currency;
  quarter: string;
  durationMs: number | null;
  toolCalls: number | null;
  source: "pydantic-ai" | "logfire-otlp";
}

export function getCurrentQuarter(date = new Date()): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

function asString(val: unknown): string | null {
  if (typeof val === "string" && val.trim().length > 0) return val.trim();
  return null;
}

function asNumber(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseCurrency(val: unknown): Currency {
  return val === "SGD" ? Currency.SGD : Currency.USD;
}

function parseSeverity(val: unknown, fallback: Severity): Severity {
  if (val === "CRITICAL" || val === "HIGH" || val === "MEDIUM" || val === "LOW") {
    return val;
  }
  return fallback;
}

/**
 * Extracts key/value attributes from either a plain object or an OTLP
 * `[{ key, value: { stringValue | intValue | doubleValue | boolValue } }]` array.
 */
function extractOtlpAttributes(rawAttrs: unknown): Record<string, unknown> {
  if (!rawAttrs) return {};
  if (!Array.isArray(rawAttrs) && typeof rawAttrs === "object") {
    return rawAttrs as Record<string, unknown>;
  }
  if (!Array.isArray(rawAttrs)) return {};

  const out: Record<string, unknown> = {};
  for (const item of rawAttrs) {
    if (!item || typeof item !== "object") continue;
    const entry = item as { key?: unknown; value?: Record<string, unknown> };
    const key = asString(entry.key);
    if (!key || !entry.value || typeof entry.value !== "object") continue;

    if ("stringValue" in entry.value) out[key] = entry.value.stringValue;
    else if ("intValue" in entry.value) out[key] = asNumber(entry.value.intValue);
    else if ("doubleValue" in entry.value) out[key] = asNumber(entry.value.doubleValue);
    else if ("boolValue" in entry.value) out[key] = entry.value.boolValue;
  }
  return out;
}

function isBreachException(exceptionType: string | null, statusStr: string | null): {
  isBreach: boolean;
  severity: Severity;
} {
  const s = (statusStr || "").toLowerCase();
  const ex = (exceptionType || "").toLowerCase();

  if (
    s === "guardrail_failed" ||
    s === "usage_limit_exceeded" ||
    ex.includes("usagelimitexceeded") ||
    ex.includes("guardrail")
  ) {
    return { isBreach: true, severity: Severity.HIGH };
  }
  if (
    s === "model_retry_exceeded" ||
    s === "error" ||
    s === "breach" ||
    ex.includes("unexpectedmodelbehavior") ||
    ex.includes("modelretry") ||
    ex.length > 0
  ) {
    return { isBreach: true, severity: Severity.MEDIUM };
  }
  return { isBreach: false, severity: Severity.LOW };
}

function normalizeDirectPayload(
  obj: Record<string, unknown>,
  queryAssetCode?: string | null,
): NormalizedPydanticEvent | null {
  const assetCode = asString(obj.assetCode) || asString(queryAssetCode);
  if (!assetCode) return null;

  const usage = (obj.usage && typeof obj.usage === "object" ? obj.usage : {}) as Record<string, unknown>;
  const requestTokens = asNumber(usage.request_tokens) ?? asNumber(usage.input_tokens) ?? asNumber(obj.requestTokens) ?? 0;
  const responseTokens = asNumber(usage.response_tokens) ?? asNumber(usage.output_tokens) ?? asNumber(obj.responseTokens) ?? 0;
  const totalTokens =
    asNumber(usage.total_tokens) ?? asNumber(obj.totalTokens) ?? requestTokens + responseTokens;
  const requests = asNumber(usage.requests) ?? asNumber(obj.requests) ?? 1;

  const statusStr = asString(obj.status) || "ok";
  const errorType = asString(obj.errorType);
  const errorMessage = asString(obj.errorMessage) || asString(obj.description);
  const breachCheck = isBreachException(errorType, statusStr);

  const agentName = asString(obj.agentName) || "pydantic-ai-agent";
  const model = asString(obj.model);
  const costAmount = asNumber(obj.costAmount) ?? asNumber(obj.costUsd) ?? asNumber(obj.costSgd);
  const currency = obj.costSgd != null ? Currency.SGD : parseCurrency(obj.currency);

  const breachReason = breachCheck.isBreach
    ? errorMessage ||
      `${agentName} (${model || "unknown model"}) reported ${errorType || statusStr}`
    : null;

  return {
    assetCode,
    agentName,
    model,
    status: breachCheck.isBreach ? "breach" : "ok",
    breachSeverity: parseSeverity(obj.severity, breachCheck.severity),
    breachReason,
    requestTokens,
    responseTokens,
    totalTokens,
    requests,
    costAmount,
    currency,
    quarter: asString(obj.quarter) || getCurrentQuarter(),
    durationMs: asNumber(obj.durationMs),
    toolCalls: asNumber(obj.toolCalls),
    source: "pydantic-ai",
  };
}

function normalizeOtlpSpan(
  span: Record<string, unknown>,
  resourceAttrs: Record<string, unknown>,
  queryAssetCode?: string | null,
): NormalizedPydanticEvent | null {
  const attrs = { ...resourceAttrs, ...extractOtlpAttributes(span.attributes) };
  const assetCode =
    asString(attrs["aegis.asset_code"]) ||
    asString(attrs["assetCode"]) ||
    asString(queryAssetCode);
  if (!assetCode) return null;

  const agentName =
    asString(attrs["pydantic_ai.agent"]) ||
    asString(attrs["gen_ai.agent.name"]) ||
    asString(attrs["service.name"]) ||
    asString(span.name) ||
    "pydantic-logfire-agent";

  const model =
    asString(attrs["gen_ai.request.model"]) ||
    asString(attrs["gen_ai.response.model"]) ||
    asString(attrs["pydantic_ai.model"]);

  const requestTokens =
    asNumber(attrs["gen_ai.usage.input_tokens"]) ??
    asNumber(attrs["gen_ai.usage.prompt_tokens"]) ??
    0;
  const responseTokens =
    asNumber(attrs["gen_ai.usage.output_tokens"]) ??
    asNumber(attrs["gen_ai.usage.completion_tokens"]) ??
    0;
  const totalTokens = requestTokens + responseTokens;

  const spanStatus = (span.status && typeof span.status === "object"
    ? span.status
    : {}) as Record<string, unknown>;
  const otelStatusCode = asString(spanStatus.code) || asString(attrs["otel.status_code"]);
  const exceptionType = asString(attrs["exception.type"]);
  const exceptionMsg =
    asString(attrs["exception.message"]) ||
    asString(spanStatus.message) ||
    asString(attrs["logfire.msg"]);

  const isErrorStatus =
    otelStatusCode === "ERROR" || otelStatusCode === "STATUS_CODE_ERROR" || otelStatusCode === "2";
  const breachCheck = isBreachException(exceptionType, isErrorStatus ? "error" : "ok");

  const startNs = asNumber(span.startTimeUnixNano);
  const endNs = asNumber(span.endTimeUnixNano);
  const durationMs =
    startNs != null && endNs != null && endNs >= startNs
      ? Math.round((endNs - startNs) / 1_000_000)
      : null;

  const costAmount = asNumber(attrs["aegis.cost"]) ?? asNumber(attrs["gen_ai.usage.cost"]);
  const currency = parseCurrency(attrs["aegis.currency"]);

  return {
    assetCode,
    agentName,
    model,
    status: breachCheck.isBreach ? "breach" : "ok",
    breachSeverity: parseSeverity(attrs["aegis.severity"], breachCheck.severity),
    breachReason: breachCheck.isBreach
      ? exceptionMsg || `${agentName} span failed (${exceptionType || otelStatusCode || "ERROR"})`
      : null,
    requestTokens,
    responseTokens,
    totalTokens,
    requests: 1,
    costAmount,
    currency,
    quarter: asString(attrs["aegis.quarter"]) || getCurrentQuarter(),
    durationMs,
    toolCalls: asNumber(attrs["pydantic_ai.tool_calls"]),
    source: "logfire-otlp",
  };
}

/**
 * Normalizes direct PydanticAI run payloads, OTLP `resourceSpans` batches
 * (e.g. from Pydantic Logfire), or arrays of spans/events into a uniform list.
 */
export function normalizePydanticTelemetry(
  rawBody: unknown,
  queryAssetCode?: string | null,
): NormalizedPydanticEvent[] {
  if (!rawBody || typeof rawBody !== "object") return [];

  if (Array.isArray(rawBody)) {
    return rawBody.flatMap((item) => normalizePydanticTelemetry(item, queryAssetCode));
  }

  const obj = rawBody as Record<string, unknown>;

  // OTLP JSON format: { resourceSpans: [{ resource: { attributes }, scopeSpans: [{ spans: [...] }] }] }
  if (Array.isArray(obj.resourceSpans)) {
    const events: NormalizedPydanticEvent[] = [];
    for (const rs of obj.resourceSpans) {
      if (!rs || typeof rs !== "object") continue;
      const rsObj = rs as Record<string, unknown>;
      const resource = (rsObj.resource && typeof rsObj.resource === "object"
        ? rsObj.resource
        : {}) as Record<string, unknown>;
      const resourceAttrs = extractOtlpAttributes(resource.attributes);
      const scopeSpans = Array.isArray(rsObj.scopeSpans) ? rsObj.scopeSpans : [];
      for (const ss of scopeSpans) {
        if (!ss || typeof ss !== "object") continue;
        const spans = Array.isArray((ss as Record<string, unknown>).spans)
          ? ((ss as Record<string, unknown>).spans as unknown[])
          : [];
        for (const span of spans) {
          if (!span || typeof span !== "object") continue;
          const ev = normalizeOtlpSpan(span as Record<string, unknown>, resourceAttrs, queryAssetCode);
          if (ev) events.push(ev);
        }
      }
    }
    return events;
  }

  // Flat spans array: { spans: [...] }
  if (Array.isArray(obj.spans)) {
    const events: NormalizedPydanticEvent[] = [];
    for (const span of obj.spans) {
      if (!span || typeof span !== "object") continue;
      const ev = normalizeOtlpSpan(span as Record<string, unknown>, {}, queryAssetCode);
      if (ev) events.push(ev);
    }
    return events;
  }

  // Direct PydanticAI run payload
  const direct = normalizeDirectPayload(obj, queryAssetCode);
  return direct ? [direct] : [];
}
