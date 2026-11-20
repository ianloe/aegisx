import { describe, expect, it } from "vitest";
import { evaluateA2aCall, evaluateMcpCall } from "../governance/mcp-a2a";

describe("MCP & A2A Policy Evaluation", () => {
  it("allows approved MCP server calls within tool scope and blocks unapproved tools", () => {
    const policy = {
      serverName: "postgres-mcp",
      isApproved: true,
      allowedTools: ["read_query", "list_tables"],
      requiresHitl: false,
    };

    expect(evaluateMcpCall(policy, "postgres-mcp", "read_query")).toEqual({
      allowed: true,
      reason: null,
    });

    const denied = evaluateMcpCall(policy, "postgres-mcp", "drop_table");
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toContain("drop_table");

    const missing = evaluateMcpCall(null, "unknown-mcp", "exec");
    expect(missing.allowed).toBe(false);
    expect(missing.reason).toContain("Unregistered MCP server");
  });

  it("enforces A2A peer approval, skill scope, and maxHopDepth", () => {
    const link = {
      targetName: "AI-002",
      isApproved: true,
      allowedSkills: ["verify_kyc", "score_credit"],
      maxHopDepth: 2,
    };

    expect(evaluateA2aCall(link, "AI-002", "verify_kyc", 2)).toEqual({
      allowed: true,
      reason: null,
    });

    const tooDeep = evaluateA2aCall(link, "AI-002", "verify_kyc", 3);
    expect(tooDeep.allowed).toBe(false);
    expect(tooDeep.reason).toContain("hopDepth 3");

    const badSkill = evaluateA2aCall(link, "AI-002", "wire_funds", 1);
    expect(badSkill.allowed).toBe(false);
    expect(badSkill.reason).toContain("wire_funds");
  });
});
