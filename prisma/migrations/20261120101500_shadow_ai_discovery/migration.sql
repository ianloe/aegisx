-- CreateEnum
CREATE TYPE "DiscoverySource" AS ENUM ('SASE', 'DNS', 'IDP', 'CLOUD', 'EXPENSE');

-- CreateEnum
CREATE TYPE "DiscoveryStatus" AS ENUM ('DETECTED', 'UNDER_REVIEW', 'SANCTIONED', 'BLOCKED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ShadowAiCandidate" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other AI',
    "source" "DiscoverySource" NOT NULL DEFAULT 'SASE',
    "businessUnit" TEXT NOT NULL DEFAULT 'Unassigned',
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "bytesUploaded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 1,
    "status" "DiscoveryStatus" NOT NULL DEFAULT 'DETECTED',
    "matchedAssetId" TEXT,
    "notes" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShadowAiCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShadowAiCandidate_status_lastSeenAt_idx" ON "ShadowAiCandidate"("status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShadowAiCandidate_domain_businessUnit_source_key" ON "ShadowAiCandidate"("domain", "businessUnit", "source");

-- AddForeignKey
ALTER TABLE "ShadowAiCandidate" ADD CONSTRAINT "ShadowAiCandidate_matchedAssetId_fkey" FOREIGN KEY ("matchedAssetId") REFERENCES "AIAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default alert rule for Shadow AI detection
INSERT INTO "AlertRule" ("id", "eventType", "label", "description", "isEnabled", "channel", "updatedAt")
VALUES (
    'alert_rule_shadow_ai_detected',
    'SHADOW_AI_DETECTED',
    'Shadow AI Detected (SASE / DNS / IdP)',
    'Triggers when network or identity telemetry detects unregistered AI service usage.',
    true,
    'IN_APP',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("eventType") DO NOTHING;
