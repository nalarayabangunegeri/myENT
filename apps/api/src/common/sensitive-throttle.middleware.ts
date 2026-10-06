import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// Rate limit generik in-process untuk endpoint sensitif (PRD §18).
// Tahan-NAT: kampus = banyak user di 1 IP. Dua ember — per IP longgar + per user ketat
// (sub dibaca tanpa verifikasi, hanya untuk kunci; otorisasi tetap di guard).
// ponytail: Map in-memory (single instance). Upgrade: Redis saat multi-instance.
@Injectable()
export class SensitiveThrottleMiddleware implements NestMiddleware {
  private ipHits = new Map<string, number[]>();
  private userHits = new Map<string, number[]>();

  private subOf(req: Request): string | null {
    try {
      const t = (req.headers.authorization ?? '').split(' ')[1];
      if (!t) return null;
      const p = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
      return typeof p.sub === 'string' ? p.sub : null;
    } catch {
      return null;
    }
  }

  private hit(map: Map<string, number[]>, key: string, limit: number): boolean {
    const now = Date.now();
    const arr = (map.get(key) ?? []).filter((t) => now - t < 60_000);
    arr.push(now);
    map.set(key, arr);
    return arr.length > limit;
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const sensitive =
      req.path.startsWith('/auth/') ||
      (req.method === 'POST' && (req.path.includes('/attendance') || req.path.includes('/absence-requests')));
    if (!sensitive) return next();
    const sub = this.subOf(req);
    if (this.hit(this.ipHits, `${req.ip}`, 600) || (sub && this.hit(this.userHits, sub, 60)))
      throw new UnauthorizedException('Terlalu banyak request, coba lagi sebentar');
    next();
  }
}
