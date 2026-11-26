interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function pruneExpiredBuckets(windowMs: number, nowMs: number): void {
  const cutoff = nowMs - windowMs;
  for (const [k, b] of buckets) {
    const active = b.timestamps.filter((t) => t > cutoff);
    if (active.length === 0) {
      buckets.delete(k);
    } else {
      b.timestamps = active;
    }
  }
}

/**
 * In-memory sliding-window rate limiter for auth endpoints.
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs = 5 * 60 * 1000,
  nowMs = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  if (buckets.size > MAX_BUCKETS) {
    pruneExpiredBuckets(windowMs, nowMs);
  }
  const bucket = buckets.get(key) ?? { timestamps: [] };
  const cutoff = nowMs - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= maxAttempts) {
    const oldest = bucket.timestamps[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.timestamps.push(nowMs);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
