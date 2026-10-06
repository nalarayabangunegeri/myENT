import { Injectable } from '@nestjs/common';

// ponytail: in-memory throttle (single instance). Upgrade path: Redis/advisory lock saat multi-instance (AGENTS §12).
@Injectable()
export class LoginThrottle {
  private hits = new Map<string, number[]>();
  isBlocked(key: string, limit = 5, windowMs = 60_000): boolean {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    arr.push(now);
    this.hits.set(key, arr);
    return arr.length > limit;
  }
}
