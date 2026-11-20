-- CreateEnum
CREATE TYPE "RuntimeGateStatus" AS ENUM ('ALLOW', 'RESTRICTED', 'SUSPENDED');
CREATE TYPE "BomComponentType" AS ENUM ('MODEL', 'PROMPT', 'MCP_SERVER', 'TOOL_API', 'GUARDRAIL');
CREATE TYPE "DataSourceType" AS ENUM ('VECTOR_DB', 'DATA_WAREHOUSE', 'DOCUMENT_REPO', 'CRM_ERP', 'API_STREAM');
CREATE TYPE "EvalType" AS ENUM ('RED_TEAM', 'HALLUCINATION', 'BIAS_FAIRNESS', 'PROMPT_INJECTION', 'SAFETY_BENCHMARK');
CREATE TYPE "ExceptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterTable AIAsset
ALTER TABLE "AIAsset" ADD COLUMN "runtimeGateStatus" "RuntimeGateStatus" NOT NULL DEFAULT 'ALLOW';
ALTER TABLE "AIAsset" ADD COLUMN "runtimeGateReason" TEXT;
ALTER TABLE "AIAsset" ADD COLUMN "quarterlyBudgetAmount" DOUBLE PRECISION;
ALTER TABLE "AIAsset" ADD COLUMN "quarterlyBudgetCurrency" "Currency" NOT NULL DEFAULT 'SGD';

-- AlterTable Incident
ALTER TABLE "Incident" ADD COLUMN "regulatoryFramework" TEXT;
ALTER TABLE "Incident" ADD COLUMN "notificationDueAt" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN "reportedToRegulatorAt" TIMESTAMP(3);

-- CreateTable AiBomComponent
CREATE TABLE "AiBomComponent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "componentType" "BomComponentType" NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "provider" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiBomComponent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiBomComponent_assetId_componentType_idx" ON "AiBomComponent"("assetId", "componentType");
ALTER TABLE "AiBomComponent" ADD CONSTRAINT "AiBomComponent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable DataSourceLink
CREATE TABLE "DataSourceLink" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" "DataSourceType" NOT NULL,
    "classification" "DataSensitivity" NOT NULL DEFAULT 'INTERNAL',
    "piiIncluded" BOOLEAN NOT NULL DEFAULT false,
    "retentionPolicy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataSourceLink_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataSourceLink_assetId_idx" ON "DataSourceLink"("assetId");
ALTER TABLE "DataSourceLink" ADD CONSTRAINT "DataSourceLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable EvalScorecard
CREATE TABLE "EvalScorecard" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "suiteName" TEXT NOT NULL,
    "evalType" "EvalType" NOT NULL,
    "passRate" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "passed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvalScorecard_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EvalScorecard_assetId_evaluatedAt_idx" ON "EvalScorecard"("assetId", "evaluatedAt");
ALTER TABLE "EvalScorecard" ADD CONSTRAINT "EvalScorecard_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable PolicyException
CREATE TABLE "PolicyException" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "title" TEXT NOT NULL,
    "businessUnit" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "compensatingControls" TEXT NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PolicyException_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PolicyException_status_expiresAt_idx" ON "PolicyException"("status", "expiresAt");
ALTER TABLE "PolicyException" ADD CONSTRAINT "PolicyException_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable PolicyAttestation
CREATE TABLE "PolicyAttestation" (
    "id" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL DEFAULT '2026.1',
    "businessUnit" TEXT NOT NULL,
    "attestedByName" TEXT NOT NULL,
    "attestedByEmail" TEXT NOT NULL,
    "trainingCompleted" BOOLEAN NOT NULL DEFAULT true,
    "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyAttestation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PolicyAttestation_businessUnit_attestedAt_idx" ON "PolicyAttestation"("businessUnit", "attestedAt");

-- Seed AlertRules for FinOps Budget & Guardrail Violations
INSERT INTO "AlertRule" ("id", "eventType", "label", "description", "isEnabled", "channel", "updatedAt")
VALUES
  ('alert_rule_budget_alert', 'BUDGET_ALERT', 'FinOps Inference Budget Threshold', 'Triggers when an AI asset reaches 80% or 100% of its quarterly spend cap.', true, 'IN_APP', CURRENT_TIMESTAMP),
  ('alert_rule_guardrail_violation', 'GUARDRAIL_VIOLATION', 'AI Gateway / Guardrail Violation', 'Triggers when an AI gateway blocks or flags prompt injection, PII leakage, or toxicity.', true, 'IN_APP', CURRENT_TIMESTAMP)
ON CONFLICT ("eventType") DO NOTHING;
