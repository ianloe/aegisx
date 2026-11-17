# Changelog

All notable changes to AI Governance Command Centre are documented in this file.

## [1.0.0] - 2026-11-17
### Added
- **Phase 1 (Foundation)**: Next.js App Router, TypeScript, Tailwind CSS, Prisma PostgreSQL 16 schema (27 models), multi-stage non-root `Dockerfile`, `docker-compose.yml` with health checks and persistent volumes, startup secret guard, `scrypt` authentication, 6-role RBAC, immutable `AuditLogEntry` service, Admin Configuration screens, and optional demo seed (`SEED_DEMO_DATA=true`).
- **Phase 2 (AI Asset Register)**: Searchable, filterable AI Asset Register, Asset Detail Hub showing the FRAME governance envelope around AAEF agent appraisals, and RFC 4180 CSV import/export.
- **Phase 3 (FRAME Governance Assessment)**: Five-dimension assessment workflow (`Focus`, `Roles`, `Authority`, `Metrics`, `Evaluation`), versioned Authority decision-rights matrix, Roles completeness and lapsed-review checker, Metrics activity-versus-outcome split validator, Recharts Radar chart, Portfolio Heatmap, and assessment history.
- **Phase 4 (AAEF Agent Appraisal)**: Appraisal scheduler (`30-day`, `90-day`, `quarterly`, `biannual`), five-dimension scoring, binary Boundary Adherence and Breach log with automatic profile re-evaluation, computed Improvement Trajectory, transparent rule-based Performance Profile engine (`Operational`, `Developing`, `Restricted`, `Under Review`), Governance Office sign-off, and printable appraisal form view.
- **Phase 5 (Risk, Controls, Crosswalk & Incidents)**: Risk Register across 9 categories, interactive 5x5 Inherent/Residual Heat Map, appetite threshold breach alerts, Control Library with effectiveness testing, data-driven Framework Crosswalk (`FRAME`, `AAEF`, `COSO`, `NIST AI RMF`, `ISO/IEC 42001`, `EU AI Act`, `Singapore MAS / IMDA MGF`), Incident and Near-Miss log, Evidence Store, and Action Tracker.
- **Phase 6 (ROI & Value Module)**: Cost and benefit ledgers in `SGD` (default) and `USD`, TCO, Net Benefit, ROI %, Payback Period, NPV, Cost per Outcome, visual separation of `Measured`, `Estimated`, and `Assumed` benefits everywhere, Value-at-Risk link to the Risk Register, and extension points (`TODO`) for the Agentic P&L Framework and Capability Capitalisation Model.
- **Phase 7 (Executive & Board Dashboard)**: One-page portfolio dashboard with global filters, drill-down KPI tiles and charts, and A4 British English Board Pack PDF export (`/api/board-pack/pdf`).
- **Phase 8 (Hardening & Verification)**: Vitest unit test suite (14 tests), `scripts/backup.sh` and `scripts/restore.sh` verification, and clean-state Docker persistence verification.
