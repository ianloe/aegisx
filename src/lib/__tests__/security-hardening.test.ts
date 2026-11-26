import { describe, expect, it } from "vitest";
import { maskSecretValue, validateSafeHttpUrl } from "../security/url-guard";
import { checkRateLimit } from "../auth/rate-limit";
import { escapeCsvCell } from "../csv";
import { getRpInfo } from "../auth/passkey";

describe("Security Hardening Helpers", () => {
  it("blocks javascript: URLs, cloud metadata IPs, IPv6/mapped IPs, credentials, and private IPs on public webhooks", () => {
    expect(validateSafeHttpUrl("javascript:alert(1)").valid).toBe(false);
    expect(validateSafeHttpUrl("http://169.254.169.254/latest/meta-data/").valid).toBe(false);
    expect(validateSafeHttpUrl("http://metadata.google.internal/computeMetadata/v1/").valid).toBe(false);
    expect(validateSafeHttpUrl("http://127.0.0.1:3000/api/health").valid).toBe(false);
    expect(validateSafeHttpUrl("http://127.0.0.2/admin").valid).toBe(false);
    expect(validateSafeHttpUrl("http://10.0.0.5:8080/hook").valid).toBe(false);
    expect(validateSafeHttpUrl("http://100.64.0.1/hook").valid).toBe(false);
    expect(validateSafeHttpUrl("http://[::1]:3000/").valid).toBe(false);
    expect(validateSafeHttpUrl("http://[::ffff:169.254.169.254]/latest").valid).toBe(false);
    expect(validateSafeHttpUrl("http://[fe80::1]/").valid).toBe(false);
    expect(validateSafeHttpUrl("http://[fd00:ec2::254]/latest").valid).toBe(false);
    expect(validateSafeHttpUrl("https://user:pass@hooks.slack.com/services/T00/B00/XXX").valid).toBe(false);

    expect(validateSafeHttpUrl("https://hooks.slack.com/services/T00/B00/XXX").valid).toBe(true);
    expect(validateSafeHttpUrl("http://localhost:11434/v1", { allowPrivateNetwork: true }).valid).toBe(true);
    expect(validateSafeHttpUrl("http://169.254.169.254/latest", { allowPrivateNetwork: true }).valid).toBe(false);
    expect(validateSafeHttpUrl("http://[::ffff:169.254.169.254]/latest", { allowPrivateNetwork: true }).valid).toBe(false);
  });

  it("neutralises CSV formula injection including leading whitespace, tabs, and CR", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell(" =cmd|'/C calc'!A0")).toBe("' =cmd|'/C calc'!A0");
    expect(escapeCsvCell("\t=1+1")).toBe("'\t=1+1");
    expect(escapeCsvCell("\r+1")).toBe("\"'\\r+1\"".replace("\\r", "\r"));
    expect(escapeCsvCell("normal text")).toBe("normal text");
  });

  it("does not downgrade localhost.evil.com to http in WebAuthn RP info", () => {
    const req = new Request("https://localhost.evil.com/api/auth/passkey/options", {
      headers: { host: "localhost.evil.com" },
    });
    const info = getRpInfo(req);
    expect(info.origin).toBe("https://localhost.evil.com");
    expect(info.rpId).toBe("localhost.evil.com");
  });

  it("masks webhook URLs and secrets cleanly", () => {
    expect(maskSecretValue(null)).toBeNull();
    expect(maskSecretValue("short")).toBe("****");
    expect(maskSecretValue("https://hooks.slack.com/services/T123/B456/secret")).toBe("https:...cret");
  });

  it("enforces sliding-window rate limits", () => {
    const base = 1_700_000_000_000;
    const key = "test-login:1.2.3.4";
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000, base + i * 100).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000, base + 500);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // After window passes, requests are allowed again
    expect(checkRateLimit(key, 3, 60_000, base + 61_000).allowed).toBe(true);
  });
});
