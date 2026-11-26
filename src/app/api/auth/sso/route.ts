import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSsoConfig } from "@/lib/auth/sso";

export async function GET(request: Request) {
  const sso = getSsoConfig();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "login") {
    if (!sso.enabled) {
      return NextResponse.json(
        { error: "Enterprise SSO is not enabled. Configure SSO_ENABLED, SSO_ISSUER_URL, and SSO_CLIENT_ID." },
        { status: 400 },
      );
    }
    const state = crypto.randomBytes(24).toString("hex");
    await prisma.authChallenge.create({
      data: {
        challenge: state,
        type: "SSO_STATE",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    const authorizeUrl = new URL("/authorize", sso.issuerUrl);
    authorizeUrl.searchParams.set("client_id", sso.clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "openid email profile");
    authorizeUrl.searchParams.set("state", state);
    return NextResponse.redirect(authorizeUrl.toString());
  }

  return NextResponse.json({
    enabled: sso.enabled,
    providerName: sso.providerName,
    issuerConfigured: Boolean(sso.issuerUrl),
    clientConfigured: Boolean(sso.clientId),
    secretConfigured: sso.hasClientSecret,
  });
}
