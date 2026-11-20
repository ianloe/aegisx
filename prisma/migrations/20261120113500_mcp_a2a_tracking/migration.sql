-- CreateEnum
CREATE TYPE "ProtocolType" AS ENUM ('MCP', 'A2A');
CREATE TYPE "McpToolRiskTier" AS ENUM ('READ_ONLY', 'WRITE', 'DESTRUCTIVE');

-- CreateTable McpServerPolicy
CREATE TABLE "McpServerPolicy" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "endpointUrl" TEXT,
    "transport" TEXT NOT NULL DEFAULT 'STREAMABLE_HTTP',
    "authMode" TEXT NOT NULL DEFAULT 'OAUTH2',
    "allowedTools" TEXT[],
    "riskTier" "McpToolRiskTier" NOT NULL DEFAULT 'READ_ONLY',
    "requiresHitl" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "lastCalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "McpServerPolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "McpServerPolicy_assetId_idx" ON "McpServerPolicy"("assetId");
CREATE UNIQUE INDEX "McpServerPolicy_assetId_serverName_key" ON "McpServerPolicy"("assetId", "serverName");
ALTER TABLE "McpServerPolicy" ADD CONSTRAINT "McpServerPolicy_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable A2aPeerLink
CREATE TABLE "A2aPeerLink" (
    "id" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "targetAssetId" TEXT,
    "targetName" TEXT NOT NULL,
    "agentCardUrl" TEXT,
    "allowedSkills" TEXT[],
    "maxHopDepth" INTEGER NOT NULL DEFAULT 2,
    "allowPiiSharing" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "lastCalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "A2aPeerLink_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "A2aPeerLink_sourceAssetId_idx" ON "A2aPeerLink"("sourceAssetId");
ALTER TABLE "A2aPeerLink" ADD CONSTRAINT "A2aPeerLink_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "A2aPeerLink" ADD CONSTRAINT "A2aPeerLink_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "AIAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable ProtocolCallEvent
CREATE TABLE "ProtocolCallEvent" (
    "id" TEXT NOT NULL,
    "protocol" "ProtocolType" NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "hopDepth" INTEGER NOT NULL DEFAULT 1,
    "traceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "durationMs" INTEGER,
    "violationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProtocolCallEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProtocolCallEvent_sourceAssetId_protocol_createdAt_idx" ON "ProtocolCallEvent"("sourceAssetId", "protocol", "createdAt");
ALTER TABLE "ProtocolCallEvent" ADD CONSTRAINT "ProtocolCallEvent_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed AlertRule for unapproved MCP / A2A calls
INSERT INTO "AlertRule" ("id", "eventType", "label", "description", "isEnabled", "channel", "updatedAt")
VALUES (
    'alert_rule_unapproved_mcp_a2a',
    'UNAPPROVED_MCP_OR_A2A',
    'Unapproved MCP Tool or A2A Delegation',
    'Triggers when an AI agent calls an unapproved MCP server/tool or delegates to an unauthorised A2A peer.',
    true,
    'IN_APP',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("eventType") DO NOTHING;
