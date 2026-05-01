type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

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
