import { RoleCode } from "@prisma/client";

export type Permission =
  | "assets:read"
  | "assets:write"
  | "frame:assess"
  | "authority:write"
  | "aaef:appraise"
  | "aaef:signoff"
  | "risks:write"
  | "controls:test"
  | "incidents:write"
  | "roi:write"
  | "actions:write"
  | "evidence:write"
  | "admin:config"
  | "audit:read";

const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  ADMIN: [
    "assets:read", "assets:write", "frame:assess", "authority:write",
    "aaef:appraise", "aaef:signoff", "risks:write", "controls:test",
    "incidents:write", "roi:write", "actions:write", "evidence:write",
    "admin:config", "audit:read",
  ],
  GOVERNANCE_OFFICE: [
    "assets:read", "assets:write", "frame:assess", "authority:write",
    "aaef:appraise", "aaef:signoff", "risks:write", "controls:test",
    "incidents:write", "roi:write", "actions:write", "evidence:write",
    "audit:read",
  ],
  ASSET_OWNER: [
    "assets:read", "assets:write", "authority:write", "risks:write",
    "incidents:write", "roi:write", "actions:write", "evidence:write",
  ],
  ASSESSOR: [
    "assets:read", "frame:assess", "aaef:appraise", "controls:test",
    "incidents:write", "actions:write", "evidence:write",
  ],
  EXECUTIVE: ["assets:read"],
  AUDITOR: ["assets:read", "audit:read"],
};

export function hasPermission(role: RoleCode, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canWrite(role: RoleCode): boolean {
  return role !== "EXECUTIVE" && role !== "AUDITOR";
}
