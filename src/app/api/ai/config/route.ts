import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import {
  AI_PROVIDER_CONFIG_KEY,
  AiProviderConfig,
  DEFAULT_AI_MODELS,
  generateAiCompletion,
  getStoredAiConfig,
  maskAiConfig,
} from "@/lib/ai/provider-client";

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "GOVERNANCE_OFFICE")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const stored = await getStoredAiConfig();
  return NextResponse.json({ config: maskAiConfig(stored) });
}

const patchSchema = z.object({
  action: z.enum(["SAVE", "TEST"]).default("SAVE"),
  enabled: z.boolean(),
  provider: z.enum(["OPENAI", "OPENROUTER", "GEMINI", "ANTHROPIC", "CUSTOM_OPENAI"]),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(1.5).default(0.2),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "admin:config")) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI provider configuration", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await getStoredAiConfig();
  const nextConfig: AiProviderConfig = {
    enabled: parsed.data.enabled,
    provider: parsed.data.provider,
    model: parsed.data.model?.trim() || DEFAULT_AI_MODELS[parsed.data.provider],
    baseUrl: parsed.data.baseUrl?.trim() || "",
    apiKey: parsed.data.apiKey && parsed.data.apiKey.trim().length > 0 ? parsed.data.apiKey.trim() : existing.apiKey,
    temperature: parsed.data.temperature,
  };

  if (parsed.data.action === "TEST") {
    try {
      const testRes = await generateAiCompletion({
        systemPrompt: "You are a connectivity test assistant for Aegis AI Governance Platform.",
        userPrompt: "Reply with one short sentence confirming the AI provider connection is working.",
        overrideConfig: nextConfig,
      });
      return NextResponse.json({
        ok: true,
        reply: testRes.text,
        provider: testRes.provider,
        model: testRes.model,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "AI provider connection test failed." },
        { status: 400 },
      );
    }
  }

  await prisma.governanceConfig.upsert({
    where: { key: AI_PROVIDER_CONFIG_KEY },
    update: {
      valueJson: nextConfig as unknown as object,
      description: "BYO-AI provider settings for Aegis AI Insights",
      updatedById: session.id,
    },
    create: {
      key: AI_PROVIDER_CONFIG_KEY,
      valueJson: nextConfig as unknown as object,
      description: "BYO-AI provider settings for Aegis AI Insights",
      updatedById: session.id,
    },
  });

  await writeAuditLog(prisma, {
    actorId: session.id,
    actorEmail: session.email,
    action: "AI_PROVIDER_CONFIG_UPDATED",
    entityType: "GOVERNANCE_CONFIG",
    entityId: AI_PROVIDER_CONFIG_KEY,
    afterState: maskAiConfig(nextConfig),
  });

  return NextResponse.json({ config: maskAiConfig(nextConfig) });
}
