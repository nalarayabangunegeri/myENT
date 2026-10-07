// Rate limit sederhana untuk route auth BFF (login, 2FA).
// ponytail: in-memory per-instance. Ceiling: Redis/store eksternal saat admin >1 replica.
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

// true = ditolak (melebihi max dalam windowMs).
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
      if (hits.size < 4000) break;
    }
  }
  return false;
}
