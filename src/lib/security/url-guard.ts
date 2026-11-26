import dns from "dns/promises";
import net from "net";

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 ("this" network)
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / IMDS)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a >= 224) return true; // Multicast / reserved
  return false;
}

function parseIpv4MappedIpv6(bare: string): string | null {
  if (!bare.startsWith("::ffff:")) return null;
  const rest = bare.slice(7);
  if (net.isIP(rest) === 4) return rest;
  const hexParts = rest.split(":");
  if (hexParts.length === 2 && hexParts.every((p) => /^[0-9a-f]{1,4}$/i.test(p))) {
    const hi = parseInt(hexParts[0], 16);
    const lo = parseInt(hexParts[1], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

function isCloudMetadataIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (bare === "169.254.169.254" || bare.startsWith("169.254.")) return true;
  if (bare === "fd00:ec2::254") return true; // AWS IPv6 IMDS
  const mappedV4 = parseIpv4MappedIpv6(bare);
  if (mappedV4) {
    return isCloudMetadataIp(mappedV4);
  }
  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const version = net.isIP(bare);
  if (version === 4) {
    return isPrivateOrReservedIpv4(bare);
  }
  if (version === 6) {
    if (bare === "::1" || bare === "::" || bare === "0:0:0:0:0:0:0:1" || bare === "0:0:0:0:0:0:0:0") {
      return true;
    }
    const mappedV4 = parseIpv4MappedIpv6(bare);
    if (mappedV4) {
      return isPrivateOrReservedIpv4(mappedV4);
    }
    // Link-local fe80::/10, Unique local fc00::/7 (fc00..fdff), Multicast ff00::/8
    if (/^(fe[89ab]|fc|fd|ff)/i.test(bare)) {
      return true;
    }
    return false;
  }
  return false;
}

/**
 * Validates outbound URLs against SSRF targets (cloud metadata services,
 * non-HTTP(S) schemes, embedded credentials, and optionally private/loopback addresses).
 */
export function validateSafeHttpUrl(
  rawUrl: string,
  options: { allowPrivateNetwork?: boolean } = {},
): { valid: boolean; url?: URL; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { valid: false, error: "Only http:// and https:// URLs are permitted." };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with embedded credentials are not permitted." };
  }

  const host = parsed.hostname.toLowerCase();
  const bareHost = host.replace(/^\[|\]$/g, "");

  // Always block cloud metadata endpoints (AWS/GCP/Azure IMDS)
  if (
    bareHost === "metadata.google.internal" ||
    bareHost === "metadata" ||
    isCloudMetadataIp(bareHost)
  ) {
    return { valid: false, error: "Cloud metadata addresses are blocked." };
  }

  if (!options.allowPrivateNetwork) {
    if (
      bareHost === "localhost" ||
      bareHost.endsWith(".localhost") ||
      bareHost.endsWith(".local") ||
      bareHost.endsWith(".internal") ||
      (net.isIP(bareHost) !== 0 && isPrivateOrReservedIp(bareHost))
    ) {
      return { valid: false, error: "Private or loopback network URLs are blocked." };
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Performs DNS resolution check in addition to static URL validation to prevent
 * DNS-rebinding or hostname-aliased SSRF (e.g. nip.io resolving to 169.254.169.254).
 */
export async function validateSafeOutboundUrl(
  rawUrl: string,
  options: { allowPrivateNetwork?: boolean } = {},
): Promise<{ valid: boolean; url?: URL; error?: string }> {
  const staticCheck = validateSafeHttpUrl(rawUrl, options);
  if (!staticCheck.valid || !staticCheck.url) {
    return staticCheck;
  }

  const bareHost = staticCheck.url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIP(bareHost) !== 0) {
    return staticCheck;
  }

  try {
    const records = await dns.lookup(bareHost, { all: true });
    for (const rec of records) {
      if (isCloudMetadataIp(rec.address)) {
        return { valid: false, error: "Cloud metadata addresses are blocked." };
      }
      if (!options.allowPrivateNetwork && isPrivateOrReservedIp(rec.address)) {
        return { valid: false, error: "Private or loopback network URLs are blocked." };
      }
    }
  } catch {
    // Allow DNS resolution failures to be handled by the caller's fetch timeout/error
  }

  return staticCheck;
}

export function maskSecretValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 10) return "****";
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}
