-- CreateEnum
CREATE TYPE "StageGateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VendorReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CONDITIONAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('IN_APP', 'WEBHOOK');

-- CreateTable
CREATE TABLE "StageGateRequest" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "currentLifecycleStage" "LifecycleStage" NOT NULL,
    "targetLifecycleStage" "LifecycleStage" NOT NULL,
    "currentAutonomyLevel" "AutonomyLevel" NOT NULL,
    "targetAutonomyLevel" "AutonomyLevel" NOT NULL,
    "status" "StageGateStatus" NOT NULL DEFAULT 'PENDING',
    "readinessPassed" BOOLEAN NOT NULL DEFAULT false,
    "readinessSnapshotJson" JSONB NOT NULL,
    "justification" TEXT,
    "decisionNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageGateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorAssessment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "modelName" TEXT,
    "modelCardUrl" TEXT,
    "dataResidency" TEXT NOT NULL,
    "zeroDataRetention" BOOLEAN NOT NULL DEFAULT false,
    "subProcessors" TEXT,
    "contractRenewalDate" TIMESTAMP(3),
    "exitPlanSummary" TEXT,
    "status" "VendorReviewStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reviewerId" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "channel" "AlertChannel" NOT NULL DEFAULT 'IN_APP',
    "webhookUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "entityType" TEXT,
    "entityId" TEXT,
    "channel" "AlertChannel" NOT NULL DEFAULT 'IN_APP',
    "delivered" BOOLEAN NOT NULL DEFAULT true,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageGateRequest_assetId_status_idx" ON "StageGateRequest"("assetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VendorAssessment_assetId_key" ON "VendorAssessment"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "TelemetryApiKey_keyHash_key" ON "TelemetryApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_eventType_key" ON "AlertRule"("eventType");

-- CreateIndex
CREATE INDEX "AlertDelivery_isRead_createdAt_idx" ON "AlertDelivery"("isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "StageGateRequest" ADD CONSTRAINT "StageGateRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageGateRequest" ADD CONSTRAINT "StageGateRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageGateRequest" ADD CONSTRAINT "StageGateRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorAssessment" ADD CONSTRAINT "VendorAssessment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorAssessment" ADD CONSTRAINT "VendorAssessment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryApiKey" ADD CONSTRAINT "TelemetryApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
