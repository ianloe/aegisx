export interface McpPolicyRule {
  serverName: string;
  isApproved: boolean;
  allowedTools: string[];
  requiresHitl: boolean;
}

export interface A2aPeerPolicyRule {
  targetName: string;
  isApproved: boolean;
  allowedSkills: string[];
  maxHopDepth: number;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason: string | null;
}

export function evaluateMcpCall(
  policy: McpPolicyRule | null | undefined,
  serverName: string,
  toolName: string,
): PolicyEvaluationResult {
  if (!policy) {
    return {
      allowed: false,
      reason: `Unregistered MCP server "${serverName}" invoked tool "${toolName}".`,
    };
  }
  if (!policy.isApproved) {
    return {
      allowed: false,
      reason: `MCP server "${serverName}" is marked unapproved/revoked for tool "${toolName}".`,
    };
  }
  if (policy.allowedTools.length > 0 && !policy.allowedTools.includes(toolName)) {
    return {
      allowed: false,
      reason: `Tool "${toolName}" is not in the approved scope for MCP server "${serverName}" (allowed: ${policy.allowedTools.join(", ")}).`,
    };
  }
  return { allowed: true, reason: null };
}

export function evaluateA2aCall(
  link: A2aPeerPolicyRule | null | undefined,
  targetName: string,
  skill: string,
  hopDepth: number,
): PolicyEvaluationResult {
  if (!link) {
    return {
      allowed: false,
      reason: `Unregistered A2A peer "${targetName}" invoked for skill "${skill}".`,
    };
  }
  if (!link.isApproved) {
    return {
      allowed: false,
      reason: `A2A peer link to "${targetName}" is marked unapproved/revoked.`,
    };
  }
  if (hopDepth > link.maxHopDepth) {
    return {
      allowed: false,
      reason: `A2A delegation hopDepth ${hopDepth} exceeded maxHopDepth ${link.maxHopDepth} for peer "${targetName}".`,
    };
  }
  if (link.allowedSkills.length > 0 && !link.allowedSkills.includes(skill)) {
    return {
      allowed: false,
      reason: `Skill "${skill}" is not permitted for A2A peer "${targetName}" (allowed: ${link.allowedSkills.join(", ")}).`,
    };
  }
  return { allowed: true, reason: null };
}
