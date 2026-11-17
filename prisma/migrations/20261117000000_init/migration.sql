-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'GOVERNANCE_OFFICE', 'ASSET_OWNER', 'ASSESSOR', 'EXECUTIVE', 'AUDITOR');

-- CreateEnum
CREATE TYPE "LifecycleStage" AS ENUM ('IDEA', 'PILOT', 'PRODUCTION', 'RETIRED');

-- CreateEnum
CREATE TYPE "AutonomyLevel" AS ENUM ('ASSISTIVE', 'HUMAN_IN_THE_LOOP', 'HUMAN_ON_THE_LOOP', 'AUTONOMOUS');

-- CreateEnum
CREATE TYPE "DataSensitivity" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "SourcingType" AS ENUM ('IN_HOUSE', 'VENDOR');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('COPILOT', 'MODEL', 'RAG_ASSISTANT', 'AUTONOMOUS_AGENT', 'VENDOR_FEATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "FrameDimension" AS ENUM ('FOCUS', 'ROLES', 'AUTHORITY', 'METRICS', 'EVALUATION');

-- CreateEnum
CREATE TYPE "MetricClassification" AS ENUM ('ACTIVITY', 'OUTCOME', 'BOTH', 'NONE');

-- CreateEnum
CREATE TYPE "AuthorityDecisionType" AS ENUM ('AUTONOMOUS', 'HUMAN_CONFIRMED', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "AppraisalCycleType" AS ENUM ('DAY_30', 'DAY_90', 'QUARTERLY', 'BIANNUAL');

-- CreateEnum
CREATE TYPE "AppraisalStatus" AS ENUM ('SCHEDULED', 'DUE', 'OVERDUE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AaefDimension" AS ENUM ('TASK_COMPETENCE', 'JUDGEMENT_QUALITY', 'BOUNDARY_ADHERENCE', 'COLLABORATION_EFFECTIVENESS', 'IMPROVEMENT_TRAJECTORY');

-- CreateEnum
CREATE TYPE "Trajectory" AS ENUM ('IMPROVING', 'STABLE', 'DEGRADING');

-- CreateEnum
CREATE TYPE "ProfileCode" AS ENUM ('OPERATIONAL', 'DEVELOPING', 'RESTRICTED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('SAFETY', 'SECURITY', 'PRIVACY', 'BIAS_FAIRNESS', 'REGULATORY', 'OPERATIONAL', 'REPUTATIONAL', 'THIRD_PARTY', 'MODEL_DRIFT');

-- CreateEnum
CREATE TYPE "RiskTreatment" AS ENUM ('MITIGATE', 'ACCEPT', 'TRANSFER', 'AVOID');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ControlEffectiveness" AS ENUM ('EFFECTIVE', 'PARTIAL', 'INEFFECTIVE', 'NOT_TESTED');

-- CreateEnum
CREATE TYPE "MappingCoverage" AS ENUM ('FULL', 'PARTIAL', 'SUPPORTING');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('BUILD', 'LICENCE', 'INFERENCE_COMPUTE', 'PEOPLE', 'CHANGE_MANAGEMENT', 'GOVERNANCE');

-- CreateEnum
CREATE TYPE "BenefitCategory" AS ENUM ('COST_AVOIDED', 'REVENUE_UPLIFT', 'PRODUCTIVITY_HOURS', 'RISK_REDUCTION', 'QUALITY_IMPROVEMENT');

-- CreateEnum
CREATE TYPE "ValueConfidence" AS ENUM ('MEASURED', 'ESTIMATED', 'ASSUMED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('SGD', 'USD');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('LINK', 'FILE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCurrency" "Currency" NOT NULL DEFAULT 'SGD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "headName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'COPILOT',
    "businessUnitId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "ownerId" TEXT,
    "overseerId" TEXT,
    "escalationPath" TEXT,
    "rolesLastReviewedAt" TIMESTAMP(3),
    "lifecycleStage" "LifecycleStage" NOT NULL DEFAULT 'IDEA',
    "autonomyLevel" "AutonomyLevel" NOT NULL DEFAULT 'ASSISTIVE',
    "dataSensitivity" "DataSensitivity" NOT NULL DEFAULT 'INTERNAL',
    "jurisdictions" TEXT[],
    "sourcingType" "SourcingType" NOT NULL DEFAULT 'IN_HOUSE',
    "vendorName" TEXT,
    "isAgent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameCriterion" (
    "id" TEXT NOT NULL,
    "dimension" "FrameDimension" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rubricJson" JSONB NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FrameCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameAssessment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrameAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameScore" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "metricClassification" "MetricClassification" NOT NULL DEFAULT 'NONE',
    "evidenceNote" TEXT,

    CONSTRAINT "FrameScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorityRule" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "decisionType" "AuthorityDecisionType" NOT NULL,
    "scopeDescription" TEXT NOT NULL,
    "conditions" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceProfile" (
    "id" TEXT NOT NULL,
    "code" "ProfileCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "governanceConsequence" TEXT NOT NULL,
    "requiredAction" TEXT NOT NULL,
    "ruleConfigJson" JSONB NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PerformanceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AaefAppraisal" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "cycleType" "AppraisalCycleType" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "assessorId" TEXT,
    "status" "AppraisalStatus" NOT NULL DEFAULT 'SCHEDULED',
    "computedTrajectory" "Trajectory",
    "assignedProfileId" TEXT,
    "assignmentReason" TEXT,
    "overrideProfileId" TEXT,
    "overrideReason" TEXT,
    "consequenceAction" TEXT,
    "signedOffById" TEXT,
    "signedOffAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AaefAppraisal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AaefDimensionScore" (
    "id" TEXT NOT NULL,
    "appraisalId" TEXT NOT NULL,
    "dimension" "AaefDimension" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "boundaryPassed" BOOLEAN,
    "rationale" TEXT NOT NULL,

    CONSTRAINT "AaefDimensionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoundaryBreach" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "appraisalId" TEXT,
    "authorityRuleId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "remediation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoundaryBreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "riskCode" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "frameDimension" "FrameDimension",
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "cause" TEXT NOT NULL,
    "impactDescription" TEXT NOT NULL,
    "inherentLikelihood" INTEGER NOT NULL,
    "inherentImpact" INTEGER NOT NULL,
    "residualLikelihood" INTEGER NOT NULL,
    "residualImpact" INTEGER NOT NULL,
    "financialExposure" DOUBLE PRECISION,
    "ownerId" TEXT NOT NULL,
    "treatment" "RiskTreatment" NOT NULL DEFAULT 'MITIGATE',
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
    "controlCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "testFrequency" TEXT NOT NULL DEFAULT 'QUARTERLY',
    "lastTestedAt" TIMESTAMP(3),
    "effectiveness" "ControlEffectiveness" NOT NULL DEFAULT 'NOT_TESTED',
    "testNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskControl" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    CONSTRAINT "RiskControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkRequirement" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "FrameworkRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlMapping" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "coverage" "MappingCoverage" NOT NULL DEFAULT 'FULL',
    "notes" TEXT,

    CONSTRAINT "ControlMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "incidentCode" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "riskId" TEXT,
    "title" TEXT NOT NULL,
    "isNearMiss" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "lessonsLearned" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostItem" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'SGD',
    "quarter" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitItem" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "category" "BenefitCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL,
    "actualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'SGD',
    "quarter" TEXT NOT NULL,
    "confidence" "ValueConfidence" NOT NULL DEFAULT 'ESTIMATED',
    "methodologyNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValueModel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB NOT NULL,

    CONSTRAINT "ValueModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "url" TEXT,
    "filePath" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetId" TEXT,
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_code_key" ON "BusinessUnit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AIAsset_assetCode_key" ON "AIAsset"("assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "FrameCriterion_code_key" ON "FrameCriterion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FrameScore_assessmentId_criterionId_key" ON "FrameScore"("assessmentId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceProfile_code_key" ON "PerformanceProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AaefDimensionScore_appraisalId_dimension_key" ON "AaefDimensionScore"("appraisalId", "dimension");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_riskCode_key" ON "Risk"("riskCode");

-- CreateIndex
CREATE UNIQUE INDEX "Control_controlCode_key" ON "Control"("controlCode");

-- CreateIndex
CREATE UNIQUE INDEX "RiskControl_riskId_controlId_key" ON "RiskControl"("riskId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_code_key" ON "Framework"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkRequirement_frameworkId_code_key" ON "FrameworkRequirement"("frameworkId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ControlMapping_controlId_requirementId_key" ON "ControlMapping"("controlId", "requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_incidentCode_key" ON "Incident"("incidentCode");

-- CreateIndex
CREATE UNIQUE INDEX "ValueModel_code_key" ON "ValueModel"("code");

-- CreateIndex
CREATE INDEX "Evidence_entityType_entityId_idx" ON "Evidence"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceConfig_key_key" ON "GovernanceConfig"("key");

-- CreateIndex
CREATE INDEX "AuditLogEntry_entityType_entityId_idx" ON "AuditLogEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_createdAt_idx" ON "AuditLogEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAsset" ADD CONSTRAINT "AIAsset_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAsset" ADD CONSTRAINT "AIAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAsset" ADD CONSTRAINT "AIAsset_overseerId_fkey" FOREIGN KEY ("overseerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameAssessment" ADD CONSTRAINT "FrameAssessment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameAssessment" ADD CONSTRAINT "FrameAssessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameScore" ADD CONSTRAINT "FrameScore_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "FrameAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameScore" ADD CONSTRAINT "FrameScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "FrameCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityRule" ADD CONSTRAINT "AuthorityRule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityRule" ADD CONSTRAINT "AuthorityRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AaefAppraisal" ADD CONSTRAINT "AaefAppraisal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AaefAppraisal" ADD CONSTRAINT "AaefAppraisal_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AaefAppraisal" ADD CONSTRAINT "AaefAppraisal_assignedProfileId_fkey" FOREIGN KEY ("assignedProfileId") REFERENCES "PerformanceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AaefAppraisal" ADD CONSTRAINT "AaefAppraisal_overrideProfileId_fkey" FOREIGN KEY ("overrideProfileId") REFERENCES "PerformanceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AaefAppraisal" ADD CONSTRAINT "AaefAppraisal_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AaefDimensionScore" ADD CONSTRAINT "AaefDimensionScore_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "AaefAppraisal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoundaryBreach" ADD CONSTRAINT "BoundaryBreach_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoundaryBreach" ADD CONSTRAINT "BoundaryBreach_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "AaefAppraisal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoundaryBreach" ADD CONSTRAINT "BoundaryBreach_authorityRuleId_fkey" FOREIGN KEY ("authorityRuleId") REFERENCES "AuthorityRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoundaryBreach" ADD CONSTRAINT "BoundaryBreach_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameworkRequirement" ADD CONSTRAINT "FrameworkRequirement_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlMapping" ADD CONSTRAINT "ControlMapping_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlMapping" ADD CONSTRAINT "ControlMapping_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "FrameworkRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitItem" ADD CONSTRAINT "BenefitItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AIAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

