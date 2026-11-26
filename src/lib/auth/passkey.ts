import crypto from "crypto";

export function base64UrlToBuffer(b64url: string): Buffer {
  const padded = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

export function bufferToBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateWebAuthnChallenge(): string {
  return bufferToBase64Url(crypto.randomBytes(32));
}

export function getRpInfo(request: Request): { rpId: string; origin: string } {
  if (process.env.APP_ORIGIN) {
    try {
      const originUrl = new URL(process.env.APP_ORIGIN);
      return {
        rpId: process.env.WEBAUTHN_RP_ID || originUrl.hostname,
        origin: originUrl.origin,
      };
    } catch {
      // Fall through to host header if APP_ORIGIN is malformed
    }
  }
  const rawHost = (request.headers.get("host") || "localhost:3000").trim();
  const hostHeader = /^[a-zA-Z0-9.-]+(:\d+)?$/.test(rawHost) ? rawHost : "localhost:3000";
  const hostname = hostHeader.split(":")[0]?.toLowerCase() || "localhost";
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const proto = isLocal ? "http" : "https";
  const rpId = process.env.WEBAUTHN_RP_ID || hostname;
  return {
    rpId,
    origin: `${proto}://${hostHeader}`,
  };
}

export function verifyWebAuthnAssertion(params: {
  publicKeySpkiBase64: string;
  authenticatorDataB64Url: string;
  clientDataJsonB64Url: string;
  signatureB64Url: string;
  expectedChallenge: string;
  expectedRpId: string;
  expectedOrigin: string;
}): { valid: boolean; newCounter: number; error?: string } {
  try {
    const clientDataBuf = base64UrlToBuffer(params.clientDataJsonB64Url);
    const clientData = JSON.parse(clientDataBuf.toString("utf8")) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };

    if (clientData.type !== "webauthn.get") {
      return { valid: false, newCounter: 0, error: "Invalid WebAuthn ceremony type." };
    }
    if (clientData.challenge !== params.expectedChallenge) {
      return { valid: false, newCounter: 0, error: "WebAuthn challenge mismatch." };
    }
    if (clientData.origin !== params.expectedOrigin) {
      return { valid: false, newCounter: 0, error: `Origin mismatch (${clientData.origin}).` };
    }

    const authData = base64UrlToBuffer(params.authenticatorDataB64Url);
    if (authData.length < 37) {
      return { valid: false, newCounter: 0, error: "Malformed authenticatorData." };
    }

    const rpIdHash = authData.subarray(0, 32);
    const expectedRpIdHash = crypto.createHash("sha256").update(params.expectedRpId).digest();
    if (!crypto.timingSafeEqual(rpIdHash, expectedRpIdHash)) {
      return { valid: false, newCounter: 0, error: "RP ID hash mismatch." };
    }

    const flags = authData[32];
    const userPresent = (flags & 0x01) !== 0;
    if (!userPresent) {
      return { valid: false, newCounter: 0, error: "User presence flag not set." };
    }

    const newCounter = authData.readUInt32BE(33);
    const clientDataHash = crypto.createHash("sha256").update(clientDataBuf).digest();
    const signedPayload = Buffer.concat([authData, clientDataHash]);
    const signature = base64UrlToBuffer(params.signatureB64Url);

    const keyObj = crypto.createPublicKey({
      key: Buffer.from(params.publicKeySpkiBase64, "base64"),
      format: "der",
      type: "spki",
    });

    const verifier = crypto.createVerify("SHA256");
    verifier.update(signedPayload);
    const ok = verifier.verify(keyObj, signature);

    if (!ok) {
      return { valid: false, newCounter: 0, error: "Invalid Passkey signature." };
    }

    return { valid: true, newCounter };
  } catch (err) {
    return {
      valid: false,
      newCounter: 0,
      error: err instanceof Error ? err.message : "Passkey verification error.",
    };
  }
}
