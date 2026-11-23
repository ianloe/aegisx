import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { buildOtpAuthUri, generateTotpCode, generateTotpSecret, verifyTotpCode } from "../auth/mfa";
import { bufferToBase64Url, verifyWebAuthnAssertion } from "../auth/passkey";

describe("TOTP MFA & WebAuthn Passkey Verification", () => {
  it("generates and verifies 6-digit TOTP codes with window tolerance", () => {
    const secret = generateTotpSecret();
    const uri = buildOtpAuthUri("admin@example.org", secret);
    expect(uri).toContain("otpauth://totp/Aegis");
    expect(uri).toContain(`secret=${secret}`);

    const now = 1_700_000_000_000;
    const code = generateTotpCode(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code, 1, now)).toBe(true);
    expect(verifyTotpCode(secret, code, 1, now + 25_000)).toBe(true);
    expect(verifyTotpCode(secret, "000000", 0, now + 90_000)).toBe(false);
  });

  it("verifies a WebAuthn ES256 assertion signature against SPKI public key", () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const spkiBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");

    const challenge = bufferToBase64Url(crypto.randomBytes(32));
    const rpId = "localhost";
    const origin = "http://localhost:3000";

    const clientDataBuf = Buffer.from(
      JSON.stringify({ type: "webauthn.get", challenge, origin }),
      "utf8",
    );
    const rpIdHash = crypto.createHash("sha256").update(rpId).digest();
    const flags = Buffer.from([0x05]); // UP + UV
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(42, 0);
    const authData = Buffer.concat([rpIdHash, flags, counter]);

    const clientDataHash = crypto.createHash("sha256").update(clientDataBuf).digest();
    const signedPayload = Buffer.concat([authData, clientDataHash]);
    const sig = crypto.sign("SHA256", signedPayload, privateKey);

    const res = verifyWebAuthnAssertion({
      publicKeySpkiBase64: spkiBase64,
      authenticatorDataB64Url: bufferToBase64Url(authData),
      clientDataJsonB64Url: bufferToBase64Url(clientDataBuf),
      signatureB64Url: bufferToBase64Url(sig),
      expectedChallenge: challenge,
      expectedRpId: rpId,
      expectedOrigin: origin,
    });

    expect(res).toEqual({ valid: true, newCounter: 42 });
  });
});
