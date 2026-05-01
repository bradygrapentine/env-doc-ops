// SECURITY: this limiter is in-memory and per-process. A multi-instance
// deployment (PM2 cluster, multiple containers, Vercel lambdas, Node
// `cluster` workers) means an attacker round-robined across N workers gets
// N × max attempts per window. V1 assumes a single Node process. Before
// any horizontal scale-out, swap for a shared store (Redis / Upstash) —
// see backlog. The wrapper in rate-limit-policy.ts is the single point
// of change.
type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

// Sweep stale entries opportunistically so the Map doesn't grow unboundedly
// in a long-running server. Runs at most once per consume() call when a
// fresh window starts; cheap (linear in current size) and amortizes nicely.
function sweepStale(nowMs: number, windowMs: number): void {
  for (const [k, v] of buckets) {
    if (nowMs - v.windowStart >= windowMs) buckets.delete(k);
  }
}

function key(userId: string, action: string): string {
  return `${userId}|${action}`;
}

export type ConsumeResult = { ok: true } | { ok: false; retryAfterMs: number };

export function consume(
  userId: string,
  action: string,
  opts: { max: number; windowMs: number },
  nowMs: number = Date.now(),
): ConsumeResult {
  const k = key(userId, action);
  const existing = buckets.get(k);
  if (!existing || nowMs - existing.windowStart >= opts.windowMs) {
    sweepStale(nowMs, opts.windowMs);
    buckets.set(k, { count: 1, windowStart: nowMs });
    return { ok: true };
  }
  if (existing.count < opts.max) {
    existing.count += 1;
    return { ok: true };
  }
  return { ok: false, retryAfterMs: opts.windowMs - (nowMs - existing.windowStart) };
}

export function resetSucceeded(userId: string, action: string): void {
  buckets.delete(key(userId, action));
}

/** Test-only: clear all buckets between tests. */
export function _resetForTest(): void {
  buckets.clear();
}
