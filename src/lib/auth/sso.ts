export interface SsoConfig {
  enabled: boolean;
  providerName: string;
  issuerUrl: string;
  clientId: string;
  hasClientSecret: boolean;
}

export function getSsoConfig(): SsoConfig {
  const issuerUrl = (process.env.SSO_ISSUER_URL || "").trim();
  const clientId = (process.env.SSO_CLIENT_ID || "").trim();
  const hasClientSecret = Boolean((process.env.SSO_CLIENT_SECRET || "").trim());
  const enabled = process.env.SSO_ENABLED === "true" && Boolean(issuerUrl) && Boolean(clientId);

  return {
    enabled,
    providerName: (process.env.SSO_PROVIDER_NAME || "Enterprise SSO (OIDC)").trim(),
    issuerUrl,
    clientId,
    hasClientSecret,
  };
}
