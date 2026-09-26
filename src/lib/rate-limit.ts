// In-memory failure counter with a sliding window. Fine for a single local server process.
// Only failures count, so busy offices sharing one address are never locked out by normal use.

const buckets = new Map<string, number[]>();

function recent(key: string, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, hits);
  return hits;
}

export function isLimited(key: string, limit: number, windowMs: number): boolean {
  return recent(key, windowMs).length >= limit;
}

export function recordFailure(key: string, windowMs: number) {
  recent(key, windowMs).push(Date.now());
  if (buckets.size > 10_000) for (const k of buckets.keys()) if (!recent(k, windowMs).length) buckets.delete(k);
}

export function resetLimit(key: string) {
  buckets.delete(key);
}
