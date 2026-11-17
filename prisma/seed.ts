import { PrismaClient, RoleCode, LifecycleStage, AutonomyLevel, DataSensitivity, SourcingType, AssetType, FrameDimension, MetricClassification, AuthorityDecisionType, AppraisalCycleType, AppraisalStatus, AaefDimension, Trajectory, ProfileCode, Severity, RiskCategory, RiskTreatment, RiskStatus, ControlEffectiveness, MappingCoverage, IncidentStatus, CostCategory, BenefitCategory, ValueConfidence, Currency, ActionStatus, EvidenceType } from "@prisma/client";
import fs from "fs";
import path from "path";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

function loadJson<T>(filename: string): T {
  const filePath = path.join(process.cwd(), "prisma", "seed-data", filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

async function seedReferenceConfig() {
  console.log("[seed] Seeding roles...");
  const roles: Array<{ code: RoleCode; name: string; description: string }> = [
    { code: "ADMIN", name: "Administrator", description: "System configuration, rubrics, profile rules, and user management." },
    { code: "GOVERNANCE_OFFICE", name: "AI Governance Office", description: "Full governance oversight, approvals, sign-offs, and crosswalk management." },
    { code: "ASSET_OWNER", name: "Asset Owner", description: "Manage assigned AI assets, authority proposals, costs, benefits, and actions." },
    { code: "ASSESSOR", name: "Assessor", description: "Conduct FRAME assessments, AAEF agent appraisals, and control effectiveness tests." },
    { code: "EXECUTIVE", name: "Executive", description: "Read-only access to portfolio dashboards, registers, and board packs." },
    { code: "AUDITOR", name: "Auditor", description: "Read-only access across all governance records plus full immutable audit log." },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: r,
    });
  }

  console.log("[seed] Seeding FRAME criteria...");
  const criteria = loadJson<Array<{
    dimension: FrameDimension;
    code: string;
    title: string;
    description: string;
    sortOrder: number;
    isPlaceholder: boolean;
    rubricJson: Record<string, string>;
  }>>("frame-criteria.json");

  for (const c of criteria) {
    await prisma.frameCriterion.upsert({
      where: { code: c.code },
      update: {
        dimension: c.dimension,
        title: c.title,
        description: c.description,
        sortOrder: c.sortOrder,
        isPlaceholder: c.isPlaceholder,
        rubricJson: c.rubricJson,
      },
      create: c,
    });
  }

  console.log("[seed] Seeding AAEF performance profiles...");
  const profiles = loadJson<Array<{
    code: ProfileCode;
    name: string;
    description: string;
    governanceConsequence: string;
    requiredAction: string;
    sortOrder: number;
    isPlaceholder: boolean;
    ruleConfigJson: Record<string, unknown>;
  }>>("aaef-profiles.json");

  for (const p of profiles) {
    await prisma.performanceProfile.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        governanceConsequence: p.governanceConsequence,
        requiredAction: p.requiredAction,
        sortOrder: p.sortOrder,
        isPlaceholder: p.isPlaceholder,
        ruleConfigJson: p.ruleConfigJson as object,
      },
      create: {
        ...p,
        ruleConfigJson: p.ruleConfigJson as object,
      },
    });
  }

  console.log("[seed] Seeding frameworks and requirements...");
  const frameworks = loadJson<Array<{
    code: string;
    name: string;
    version: string;
    description: string;
    requirements: Array<{ code: string; title: string; description: string }>;
  }>>("frameworks.json");

  for (const fw of frameworks) {
    const framework = await prisma.framework.upsert({
      where: { code: fw.code },
      update: { name: fw.name, version: fw.version, description: fw.description },
      create: { code: fw.code, name: fw.name, version: fw.version, description: fw.description },
    });

    for (const req of fw.requirements) {
      await prisma.frameworkRequirement.upsert({
        where: { frameworkId_code: { frameworkId: framework.id, code: req.code } },
        update: { title: req.title, description: req.description },
        create: {
          frameworkId: framework.id,
          code: req.code,
          title: req.title,
          description: req.description,
        },
      });
    }
  }

  console.log("[seed] Seeding governance configuration and value models...");
  const govData = loadJson<{
    configs: Array<{ key: string; description: string; valueJson: Record<string, unknown> }>;
    valueModels: Array<{ code: string; name: string; description: string; isPlaceholder: boolean; isActive: boolean; configJson: Record<string, unknown> }>;
  }>("governance-config.json");

  for (const cfg of govData.configs) {
    await prisma.governanceConfig.upsert({
      where: { key: cfg.key },
      update: {}, // Preserve admin edits on subsequent restarts
      create: {
        key: cfg.key,
        description: cfg.description,
        valueJson: cfg.valueJson as object,
      },
    });
  }

  for (const vm of govData.valueModels) {
    await prisma.valueModel.upsert({
      where: { code: vm.code },
      update: { name: vm.name, description: vm.description, isPlaceholder: vm.isPlaceholder },
      create: {
        ...vm,
        configJson: vm.configJson as object,
      },
    });
  }

  console.log("[seed] Ensuring default organisation and initial admin user...");
  let org = await prisma.organisation.findFirst();
  if (!org) {
    org = await prisma.organisation.create({
      data: { name: "Meridian Enterprise Group", defaultCurrency: Currency.SGD },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@example.org";
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin && adminPassword) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "System Administrator",
        passwordHash: hashPassword(adminPassword),
        roleId: adminRole.id,
        isActive: true,
      },
    });
    console.log(`[seed] Created initial admin user: ${adminEmail}`);
  }
}

async function seedDemoData() {
  const existingAssets = await prisma.aIAsset.count();
  if (existingAssets > 0) {
    console.log("[seed] Demo data already present; skipping demo seed.");
    return;
  }

  console.log("[seed] Loading fictional demo dataset (SEED_DEMO_DATA=true)...");
  const org = await prisma.organisation.findFirstOrThrow();

  const bus = await Promise.all([
    prisma.businessUnit.upsert({
      where: { code: "SG-RWB" },
      update: {},
      create: { organisationId: org.id, code: "SG-RWB", name: "Singapore Retail & Wealth", country: "Singapore", headName: "Mei Lin Tan" },
    }),
    prisma.businessUnit.upsert({
      where: { code: "SG-OPS" },
      update: {},
      create: { organisationId: org.id, code: "SG-OPS", name: "Singapore Operations & Risk", country: "Singapore", headName: "Rajesh Nair" },
    }),
    prisma.businessUnit.upsert({
      where: { code: "UK-COM" },
      update: {},
      create: { organisationId: org.id, code: "UK-COM", name: "UK Commercial & Advisory", country: "United Kingdom", headName: "Charlotte Davies" },
    }),
  ]);

  const roles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r.id]));
  const demoPass = process.env.INITIAL_ADMIN_PASSWORD || "DemoGovPass!2026";
  const demoHash = hashPassword(demoPass);

  const demoUsers = [
    { email: "governance@meridian-demo.example", name: "Evelyn Lim (Governance Office)", roleCode: "GOVERNANCE_OFFICE" as RoleCode, buId: bus[1].id },
    { email: "owner.sg@meridian-demo.example", name: "Daniel Koh (Asset Owner)", roleCode: "ASSET_OWNER" as RoleCode, buId: bus[0].id },
    { email: "owner.uk@meridian-demo.example", name: "Oliver Grant (Asset Owner)", roleCode: "ASSET_OWNER" as RoleCode, buId: bus[2].id },
    { email: "assessor@meridian-demo.example", name: "Priya Sharma (Lead Assessor)", roleCode: "ASSESSOR" as RoleCode, buId: bus[1].id },
    { email: "executive@meridian-demo.example", name: "David Chen (Board Executive)", roleCode: "EXECUTIVE" as RoleCode, buId: null },
    { email: "auditor@meridian-demo.example", name: "Sarah Jenkins (Internal Audit)", roleCode: "AUDITOR" as RoleCode, buId: null },
  ];

  const userMap: Record<string, string> = {};
  for (const u of demoUsers) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash: demoHash,
        roleId: roleMap[u.roleCode],
        businessUnitId: u.buId,
      },
    });
    userMap[u.roleCode + (u.email.includes("uk") ? "_UK" : "")] = created.id;
  }

  const govId = userMap["GOVERNANCE_OFFICE"];
  const ownerSgId = userMap["ASSET_OWNER"];
  const ownerUkId = userMap["ASSET_OWNER_UK"];
  const assessorId = userMap["ASSESSOR"];

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  // 12 AI assets across 3 BUs and 2 countries
  const assetDefs = [
    {
      assetCode: "AI-001", name: "Wealth Advisory Copilot", description: "Internal adviser copilot summarising client portfolios and research notes.",
      assetType: AssetType.COPILOT, bu: bus[0], country: "Singapore", ownerId: ownerSgId, overseerId: govId,
      escalationPath: "Wealth Compliance Desk -> Governance Office", rolesLastReviewedAt: daysAgo(45),
      lifecycleStage: LifecycleStage.PRODUCTION, autonomyLevel: AutonomyLevel.ASSISTIVE,
      dataSensitivity: DataSensitivity.CONFIDENTIAL, jurisdictions: ["Singapore"], sourcingType: SourcingType.VENDOR, vendorName: "Helios AI Systems", isAgent: false,
    },
    {
      assetCode: "AI-002", name: "Policy & Compliance RAG Assistant", description: "Retrieval-augmented assistant answering staff queries against internal policies and MAS notices.",
      assetType: AssetType.RAG_ASSISTANT, bu: bus[1], country: "Singapore", ownerId: ownerSgId, overseerId: govId,
      escalationPath: "Policy Owner -> Chief Risk Officer", rolesLastReviewedAt: daysAgo(30),
      lifecycleStage: LifecycleStage.PRODUCTION, autonomyLevel: AutonomyLevel.HUMAN_IN_THE_LOOP,
      dataSensitivity: DataSensitivity.INTERNAL, jurisdictions: ["Singapore"], sourcingType: SourcingType.IN_HOUSE, vendorName: null, isAgent: false,
    },
    {
      assetCode: "AI-003", name: "Autonomous Claims Triage Agent", description: "Autonomous workflow agent classifying, routing, and settling low-value operational claims.",
      assetType: AssetType.AUTONOMOUS_AGENT, bu: bus[1], country: "Singapore", ownerId: ownerSgId, overseerId: assessorId,
      escalationPath: "Claims Operations Lead -> Governance Office", rolesLastReviewedAt: daysAgo(20),
      lifecycleStage: LifecycleStage.PRODUCTION, autonomyLevel: AutonomyLevel.AUTONOMOUS,
      dataSensitivity: DataSensitivity.CONFIDENTIAL, jurisdictions: ["Singapore"], sourcingType: SourcingType.IN_HOUSE, vendorName: null, isAgent: true,
    },
    {
      assetCode: "AI-004", name: "Treasury Liquidity Rebalancing Agent", description: "Autonomous intraday liquidity monitoring and intra-group sweep proposal agent.",
      assetType: AssetType.AUTONOMOUS_AGENT, bu: bus[0], country: "Singapore", ownerId: ownerSgId, overseerId: govId,
      escalationPath: "Head of Treasury -> Risk Committee", rolesLastReviewedAt: daysAgo(210), // Intentionally lapsed (>180 days)
      lifecycleStage: LifecycleStage.PILOT, autonomyLevel: AutonomyLevel.AUTONOMOUS,
      dataSensitivity: DataSensitivity.RESTRICTED, jurisdictions: ["Singapore", "United Kingdom"], sourcingType: SourcingType.IN_HOUSE, vendorName: null, isAgent: true,
    },
    {
      assetCode: "AI-005", name: "UK Commercial Underwriting Copilot", description: "Assists commercial underwriters with risk factor extraction from broker submissions.",
      assetType: AssetType.COPILOT, bu: bus[2], country: "United Kingdom", ownerId: ownerUkId, overseerId: govId,
      escalationPath: "UK Chief Underwriter -> Governance Office", rolesLastReviewedAt: daysAgo(60),
      lifecycleStage: LifecycleStage.PRODUCTION, autonomyLevel: AutonomyLevel.HUMAN_IN_THE_LOOP,
      dataSensitivity: DataSensitivity.CONFIDENTIAL, jurisdictions: ["United Kingdom", "EU"], sourcingType: SourcingType.VENDOR, vendorName: "Kestrel Cloud", isAgent: false,
    },
    {
      assetCode: "AI-006", name: "AML Alert Disposition Agent", description: "Agentic triage of low-priority transaction monitoring alerts with human-on-the-loop audit.",
      assetType: AssetType.AUTONOMOUS_AGENT, bu: bus[1], country: "Singapore", ownerId: ownerSgId, overseerId: assessorId,
      escalationPath: "MLRO -> Governance Office", rolesLastReviewedAt: daysAgo(15),
      lifecycleStage: LifecycleStage.PRODUCTION, autonomyLevel: AutonomyLevel.HUMAN_ON_THE_LOOP,
      dataSensitivity: DataSensitivity.RESTRICTED, jurisdictions: ["Singapore"], sourcingType: SourcingType.VENDOR, vendorName: "Banyan Data Labs", isAgent: true,
    },
    {
      assetCode: "AI-007", name: "Credit Scoring Challenger Model", description: "Gradient boosted credit risk scoring model operating in shadow mode alongside legacy scorecard.",
      assetType: AssetType.MODEL, bu: bus[0], country: "Singapore", ownerId: ownerSgId, overseerId: assessorId,
      escalationPath: "Model Risk Committee", rolesLastReviewedAt: daysAgo(90),
      lifecycleStage: LifecycleStage.PILOT, autonomyLevel: AutonomyLevel.HUMAN_IN_THE_LOOP,
      dataSensitivity: DataSensitivity.RESTRICTED, jurisdictions: ["Singapore"], sourcingType: SourcingType.IN_HOUSE, vendorName: null, isAgent: false,
    },
    {
      assetCode: "AI-008", name: "UK Client Onboarding Document Verifier", description: "Vendor OCR and entity-resolution feature for KYC document checks.",
      assetType: AssetType.VENDOR_FEATURE, bu: bus[2], country: "United Kingdom", ownerId: ownerUkId, overseerId: govId,
      escalationPath: "UK Compliance Officer", rolesLastReviewedAt: daysAgo(40),
      lifecycleStage: LifecycleStage.PRODUCTION, autonomyLevel: AutonomyLevel.HUMAN_IN_THE_LOOP,
      dataSensitivity: DataSensitivity.RESTRICTED, jurisdictions: ["United Kingdom"], sourcingType: SourcingType.VENDOR, vendorName: "Kestrel Cloud", isAgent: false,
    },
    {
      assetCode: "AI-009", name: "Developer Code Review Copilot", description: "IDE assistant supporting internal engineering teams with unit test generation and code review.",
      assetType: AssetType.COPILOT, bu: bus[1], country: "Singapore", ownerId: ownerSgId, overseerId: null, // Missing overseer flag!
      escalationPath: null, rolesLastReviewedAt: daysAgo(100),
      lifecycleStage: LifecycleStage.PRODUCTION, autonomyLevel: AutonomyLevel.ASSISTIVE,
      dataSensitivity: DataSensitivity.INTERNAL, jurisdictions: ["Singapore", "United Kingdom"], sourcingType: SourcingType.VENDOR, vendorName: "Helios AI Systems", isAgent: false,
    },
    {
      assetCode: "AI-010", name: "Vendor Contract Redline Copilot", description: "Legal review assistant flagging non-standard indemnity and data clauses in supplier contracts.",
      assetType: AssetType.COPILOT, bu: bus[2], country: "United Kingdom", ownerId: ownerUkId, overseerId: govId,
      escalationPath: "General Counsel -> Governance Office", rolesLastReviewedAt: daysAgo(25),
      lifecycleStage: LifecycleStage.PILOT, autonomyLevel: AutonomyLevel.ASSISTIVE,
      dataSensitivity: DataSensitivity.CONFIDENTIAL, jurisdictions: ["United Kingdom"], sourcingType: SourcingType.VENDOR, vendorName: "Helios AI Systems", isAgent: false,
    },
    {
      assetCode: "AI-011", name: "Customer Escalation Routing Classifier", description: "Legacy NLP ticket router scheduled for decommissioning after migration to unified triage.",
      assetType: AssetType.MODEL, bu: bus[0], country: "Singapore", ownerId: ownerSgId, overseerId: govId,
      escalationPath: "Service Desk Lead", rolesLastReviewedAt: daysAgo(150),
      lifecycleStage: LifecycleStage.RETIRED, autonomyLevel: AutonomyLevel.HUMAN_ON_THE_LOOP,
      dataSensitivity: DataSensitivity.INTERNAL, jurisdictions: ["Singapore"], sourcingType: SourcingType.IN_HOUSE, vendorName: null, isAgent: false,
    },
    {
      assetCode: "AI-012", name: "ESG Supply Chain Due Diligence Agent", description: "Proposed research agent to synthesise supplier sustainability disclosures.",
      assetType: AssetType.AUTONOMOUS_AGENT, bu: bus[2], country: "United Kingdom", ownerId: ownerUkId, overseerId: govId,
      escalationPath: "UK Sustainability Lead -> Governance Office", rolesLastReviewedAt: daysAgo(10),
      lifecycleStage: LifecycleStage.IDEA, autonomyLevel: AutonomyLevel.HUMAN_ON_THE_LOOP,
      dataSensitivity: DataSensitivity.PUBLIC, jurisdictions: ["United Kingdom", "EU"], sourcingType: SourcingType.IN_HOUSE, vendorName: null, isAgent: true,
    },
  ];

  const createdAssets = [];
  for (const a of assetDefs) {
    const asset = await prisma.aIAsset.create({
      data: {
        assetCode: a.assetCode,
        name: a.name,
        description: a.description,
        assetType: a.assetType,
        businessUnitId: a.bu.id,
        country: a.country,
        ownerId: a.ownerId,
        overseerId: a.overseerId,
        escalationPath: a.escalationPath,
        rolesLastReviewedAt: a.rolesLastReviewedAt,
        lifecycleStage: a.lifecycleStage,
        autonomyLevel: a.autonomyLevel,
        dataSensitivity: a.dataSensitivity,
        jurisdictions: a.jurisdictions,
        sourcingType: a.sourcingType,
        vendorName: a.vendorName,
        isAgent: a.isAgent,
      },
    });
    createdAssets.push(asset);
  }

  // Authority Rules for first 6 assets
  for (const asset of createdAssets.slice(0, 6)) {
    await prisma.authorityRule.createMany({
      data: [
        {
          assetId: asset.id, version: 1, decisionType: AuthorityDecisionType.AUTONOMOUS,
          scopeDescription: "Draft summaries, classify inbound items, and log structured telemetry.",
          conditions: "Within approved data sensitivity tier and rate limits.", createdById: govId,
        },
        {
          assetId: asset.id, version: 1, decisionType: AuthorityDecisionType.HUMAN_CONFIRMED,
          scopeDescription: "External client communications or financial postings above SGD 500.",
          conditions: "Requires named human overseer approval prior to execution.", createdById: govId,
        },
        {
          assetId: asset.id, version: 1, decisionType: AuthorityDecisionType.OUT_OF_SCOPE,
          scopeDescription: "Modify production access controls, override AML holds, or execute unapproved transfers.",
          conditions: "Strictly prohibited; any attempt constitutes a boundary breach.", createdById: govId,
        },
      ],
    });
  }

  // FRAME Assessments for first 8 assets
  const criteria = await prisma.frameCriterion.findMany({ orderBy: { sortOrder: "asc" } });
  for (let i = 0; i < 8; i++) {
    const asset = createdAssets[i];
    const baseScore = i === 0 ? 3 : i === 3 ? 2 : i === 5 ? 3 : 2;
    const assessment = await prisma.frameAssessment.create({
      data: {
        assetId: asset.id,
        assessorId,
        assessedAt: daysAgo(14 + i * 5),
        status: "COMPLETED",
        overallScore: baseScore + 0.4,
        notes: `Baseline FRAME governance assessment for ${asset.name}.`,
      },
    });
    for (const c of criteria) {
      const score = Math.min(4, Math.max(1, baseScore + (c.dimension === "AUTHORITY" ? 1 : 0)));
      await prisma.frameScore.create({
        data: {
          assessmentId: assessment.id,
          criterionId: c.id,
          score,
          rationale: `Verified against ${c.code} evidence package.`,
          metricClassification: c.dimension === "METRICS"
            ? (i === 4 ? MetricClassification.ACTIVITY : MetricClassification.BOTH)
            : MetricClassification.NONE,
          evidenceNote: "Reviewed quarterly governance pack.",
        },
      });
    }
  }

  // AAEF Appraisals (2 full cycles for agent assets AI-003, AI-004, AI-006)
  const profiles = await prisma.performanceProfile.findMany();
  const profileMap = Object.fromEntries(profiles.map((p) => [p.code, p]));
  const agentAssets = createdAssets.filter((a) => a.isAgent);

  for (const agent of agentAssets.slice(0, 3)) {
    // Cycle 1: 30-day completed
    const c1 = await prisma.aaefAppraisal.create({
      data: {
        assetId: agent.id,
        cycleType: AppraisalCycleType.DAY_30,
        dueDate: daysAgo(90),
        completedAt: daysAgo(88),
        assessorId,
        status: AppraisalStatus.COMPLETED,
        computedTrajectory: Trajectory.STABLE,
        assignedProfileId: profileMap["DEVELOPING"].id,
        assignmentReason: "Initial 30-day cycle: boundary adherence passed, average score 2.67 (Developing threshold >= 2.2).",
        consequenceAction: profileMap["DEVELOPING"].governanceConsequence,
        signedOffById: govId,
        signedOffAt: daysAgo(87),
      },
    });
    await prisma.aaefDimensionScore.createMany({
      data: [
        { appraisalId: c1.id, dimension: AaefDimension.TASK_COMPETENCE, score: 2.8, rationale: "Consistent accuracy on standard cases." },
        { appraisalId: c1.id, dimension: AaefDimension.JUDGEMENT_QUALITY, score: 2.5, rationale: "Occasional escalation hesitation on edge cases." },
        { appraisalId: c1.id, dimension: AaefDimension.BOUNDARY_ADHERENCE, score: 4, boundaryPassed: true, rationale: "Zero boundary breaches recorded." },
        { appraisalId: c1.id, dimension: AaefDimension.COLLABORATION_EFFECTIVENESS, score: 2.7, rationale: "Clear handoff summaries." },
        { appraisalId: c1.id, dimension: AaefDimension.IMPROVEMENT_TRAJECTORY, score: 2.5, rationale: "Baseline 30-day cycle." },
      ],
    });

    // Cycle 2: 90-day completed
    const isRestricted = agent.assetCode === "AI-004";
    const c2Profile = isRestricted ? profileMap["RESTRICTED"] : profileMap["OPERATIONAL"];
    const c2 = await prisma.aaefAppraisal.create({
      data: {
        assetId: agent.id,
        cycleType: AppraisalCycleType.DAY_90,
        dueDate: daysAgo(15),
        completedAt: daysAgo(12),
        assessorId,
        status: AppraisalStatus.COMPLETED,
        computedTrajectory: isRestricted ? Trajectory.DEGRADING : Trajectory.IMPROVING,
        assignedProfileId: c2Profile.id,
        assignmentReason: isRestricted
          ? "Boundary Adherence failed (1 breach logged) and trajectory degrading; Restricted profile assigned."
          : "Boundary Adherence passed, average score 3.40 (>= 3.0), trajectory improving; Operational profile assigned.",
        consequenceAction: c2Profile.governanceConsequence,
        signedOffById: govId,
        signedOffAt: daysAgo(10),
      },
    });
    await prisma.aaefDimensionScore.createMany({
      data: [
        { appraisalId: c2.id, dimension: AaefDimension.TASK_COMPETENCE, score: isRestricted ? 2.1 : 3.5, rationale: "90-day operational telemetry review." },
        { appraisalId: c2.id, dimension: AaefDimension.JUDGEMENT_QUALITY, score: isRestricted ? 1.9 : 3.3, rationale: "Edge-case escalation review." },
        { appraisalId: c2.id, dimension: AaefDimension.BOUNDARY_ADHERENCE, score: isRestricted ? 0 : 4, boundaryPassed: !isRestricted, rationale: isRestricted ? "One unauthorised sweep threshold attempt." : "Full boundary adherence." },
        { appraisalId: c2.id, dimension: AaefDimension.COLLABORATION_EFFECTIVENESS, score: isRestricted ? 2.2 : 3.4, rationale: "Overseer feedback incorporated." },
        { appraisalId: c2.id, dimension: AaefDimension.IMPROVEMENT_TRAJECTORY, score: isRestricted ? 1.5 : 3.6, rationale: isRestricted ? "Degrading vs 30-day baseline." : "Improving vs 30-day baseline." },
      ],
    });

    if (isRestricted) {
      const rule = await prisma.authorityRule.findFirst({ where: { assetId: agent.id, decisionType: AuthorityDecisionType.OUT_OF_SCOPE } });
      await prisma.boundaryBreach.create({
        data: {
          assetId: agent.id,
          appraisalId: c2.id,
          authorityRuleId: rule?.id,
          occurredAt: daysAgo(20),
          severity: Severity.HIGH,
          description: "Agent attempted to queue an intraday sweep above sanctioned SGD 500 threshold without human confirmation.",
          remediation: "Hard-coded API cap enforced and autonomous sweep privilege revoked.",
          status: "REMEDIATED",
          reportedById: assessorId,
        },
      });
    }

    // Upcoming scheduled/overdue appraisal
    await prisma.aaefAppraisal.create({
      data: {
        assetId: agent.id,
        cycleType: AppraisalCycleType.QUARTERLY,
        dueDate: isRestricted ? daysAgo(2) : daysFromNow(75),
        status: isRestricted ? AppraisalStatus.OVERDUE : AppraisalStatus.SCHEDULED,
      },
    });
  }

  // 20 Risks across categories & assets
  const riskCategories: RiskCategory[] = [
    "SAFETY", "SECURITY", "PRIVACY", "BIAS_FAIRNESS", "REGULATORY",
    "OPERATIONAL", "REPUTATIONAL", "THIRD_PARTY", "MODEL_DRIFT",
  ];
  const createdRisks = [];
  for (let i = 1; i <= 20; i++) {
    const asset = createdAssets[(i - 1) % 10];
    const cat = riskCategories[(i - 1) % riskCategories.length];
    const inhL = ((i * 2) % 5) + 1;
    const inhI = ((i * 3) % 5) + 1;
    const resL = Math.max(1, inhL - (i % 3 === 0 ? 0 : 1));
    const resI = Math.max(1, inhI - (i % 4 === 0 ? 0 : 1));
    const r = await prisma.risk.create({
      data: {
        riskCode: `RSK-${String(i).padStart(3, "0")}`,
        assetId: asset.id,
        frameDimension: i % 2 === 0 ? FrameDimension.AUTHORITY : FrameDimension.EVALUATION,
        title: `${cat.replace("_", " ")} risk on ${asset.name}`,
        description: `Potential ${cat.toLowerCase().replace("_", " ")} exposure identified during governance review of ${asset.assetCode}.`,
        category: cat,
        cause: "Model behaviour variance or incomplete guardrail coverage.",
        impactDescription: "Operational disruption, regulatory scrutiny, or financial misstatement.",
        inherentLikelihood: inhL,
        inherentImpact: inhI,
        residualLikelihood: resL,
        residualImpact: resI,
        financialExposure: resL * resI * 12000,
        ownerId: asset.ownerId || ownerSgId,
        treatment: i % 5 === 0 ? RiskTreatment.ACCEPT : RiskTreatment.MITIGATE,
        reviewDate: i % 6 === 0 ? daysAgo(10) : daysFromNow(30 + i * 3),
        status: i % 4 === 0 ? RiskStatus.MITIGATING : RiskStatus.OPEN,
      },
    });
    createdRisks.push(r);
  }

  // 8 Controls + RiskControl + ControlMapping
  const allReqs = await prisma.frameworkRequirement.findMany();
  for (let i = 1; i <= 8; i++) {
    const ctrl = await prisma.control.create({
      data: {
        controlCode: `CTL-${String(i).padStart(3, "0")}`,
        title: `Governance Control ${i}: ${["Authority Gate", "PII Redaction", "Drift Monitor", "Human Sign-Off", "Vendor SLA Audit", "Prompt Injection Filter", "Bias Benchmark", "Kill-Switch Drill"][i - 1]}`,
        description: "Standardised technical and procedural control verified by the Governance Office.",
        ownerId: govId,
        testFrequency: "QUARTERLY",
        lastTestedAt: daysAgo(i * 10),
        effectiveness: i % 3 === 0 ? ControlEffectiveness.PARTIAL : ControlEffectiveness.EFFECTIVE,
        testNotes: "Sample testing completed with evidence retained.",
      },
    });
    await prisma.riskControl.create({ data: { riskId: createdRisks[i - 1].id, controlId: ctrl.id } });
    if (allReqs[i]) {
      await prisma.controlMapping.create({
        data: { controlId: ctrl.id, requirementId: allReqs[i].id, coverage: MappingCoverage.FULL, notes: "Mapped in baseline crosswalk." },
      });
    }
  }

  // 10 Incidents (including near misses)
  for (let i = 1; i <= 10; i++) {
    const asset = createdAssets[(i - 1) % 8];
    await prisma.incident.create({
      data: {
        incidentCode: `INC-${String(i).padStart(3, "0")}`,
        assetId: asset.id,
        riskId: createdRisks[i - 1].id,
        title: `${i % 3 === 0 ? "Near Miss: " : ""}Operational anomaly #${i} on ${asset.assetCode}`,
        isNearMiss: i % 3 === 0,
        occurredAt: daysAgo(i * 7),
        severity: i <= 2 ? Severity.HIGH : i <= 6 ? Severity.MEDIUM : Severity.LOW,
        description: "Unexpected model output or threshold alert intercepted during monitoring.",
        rootCause: "Edge-case input outside calibrated prompt template.",
        lessonsLearned: "Added regression test case and tightened overseer alert rule.",
        status: i <= 3 ? IncidentStatus.INVESTIGATING : IncidentStatus.RESOLVED,
        reportedById: assessorId,
      },
    });
  }

  // ROI Data in SGD across 4 quarters
  const quarters = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];
  for (let i = 0; i < 6; i++) {
    const asset = createdAssets[i];
    await prisma.costItem.createMany({
      data: [
        { assetId: asset.id, category: CostCategory.BUILD, description: "Initial engineering and integration", amount: 85000 + i * 15000, currency: Currency.SGD, quarter: "2026-Q1", isRecurring: false },
        { assetId: asset.id, category: CostCategory.LICENCE, description: "Annual platform and model licence", amount: 24000, currency: Currency.SGD, quarter: "2026-Q2", isRecurring: true },
        { assetId: asset.id, category: CostCategory.GOVERNANCE, description: "Assessment, legal, and oversight effort", amount: 12000, currency: Currency.SGD, quarter: "2026-Q2", isRecurring: true },
      ],
    });
    for (let q = 0; q < quarters.length; q++) {
      await prisma.benefitItem.create({
        data: {
          assetId: asset.id,
          category: q % 2 === 0 ? BenefitCategory.COST_AVOIDED : BenefitCategory.PRODUCTIVITY_HOURS,
          description: `Quarterly operational value (${quarters[q]})`,
          plannedAmount: 45000 + i * 8000,
          actualAmount: q < 2 ? 42000 + i * 9000 : 0,
          currency: Currency.SGD,
          quarter: quarters[q],
          confidence: q === 0 ? ValueConfidence.MEASURED : q === 1 ? ValueConfidence.ESTIMATED : ValueConfidence.ASSUMED,
          methodologyNote: q === 0 ? "Verified against finance ledger." : "Projected from pilot time-motion study.",
        },
      });
    }
  }

  // Sample Actions and Evidence
  await prisma.action.createMany({
    data: [
      {
        title: "Refresh lapsed Roles review for Treasury Liquidity Rebalancing Agent",
        description: "Roles review exceeded 180-day cadence.",
        assetId: createdAssets[3].id,
        ownerId: ownerSgId,
        dueDate: daysAgo(5),
        status: ActionStatus.OPEN,
        sourceType: "FRAME_ASSESSMENT",
      },
      {
        title: "Assign named human overseer for Developer Code Review Copilot",
        description: "Asset currently lacks a named overseer and escalation path.",
        assetId: createdAssets[8].id,
        ownerId: ownerSgId,
        dueDate: daysFromNow(14),
        status: ActionStatus.IN_PROGRESS,
        sourceType: "FRAME_ASSESSMENT",
      },
    ],
  });

  await prisma.evidence.create({
    data: {
      title: "Q3 Model Validation Sign-Off Pack",
      type: EvidenceType.LINK,
      url: "https://intranet.meridian-demo.example/governance/ai-003-validation",
      entityType: "ASSET",
      entityId: createdAssets[2].id,
      uploadedById: assessorId,
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      actorEmail: "system@aegisx",
      action: "SEED_DEMO_DATA",
      entityType: "SYSTEM",
      entityId: "DEMO_INIT",
      afterState: { assets: createdAssets.length, risks: createdRisks.length, incidents: 10 },
    },
  });

  console.log("[seed] Demo dataset loaded successfully.");
}

async function main() {
  await seedReferenceConfig();
  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoData();
  } else {
    console.log("[seed] SEED_DEMO_DATA is not true; skipping demo dataset.");
  }
}

main()
  .catch((err) => {
    console.error("[seed] Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
