import { describe, expect, it } from 'vitest';
import { rateLimited } from './ratelimit';

describe('ratelimit', () => {
  it('meloloskan sampai batas lalu menolak', () => {
    const k = `t-${Date.now()}-1`;
    for (let i = 0; i < 5; i++) expect(rateLimited(k, 5, 60_000)).toBe(false);
    expect(rateLimited(k, 5, 60_000)).toBe(true);
  });

  it('key berbeda terisolasi', () => {
    const a = `t-${Date.now()}-a`;
    const b = `t-${Date.now()}-b`;
    for (let i = 0; i < 3; i++) rateLimited(a, 3, 60_000);
    expect(rateLimited(a, 3, 60_000)).toBe(true);
    expect(rateLimited(b, 3, 60_000)).toBe(false);
  });

  it('window kedaluwarsa membuka lagi', async () => {
    const k = `t-${Date.now()}-w`;
    expect(rateLimited(k, 1, 30)).toBe(false);
    expect(rateLimited(k, 1, 30)).toBe(true);
    await new Promise((r) => setTimeout(r, 40));
    expect(rateLimited(k, 1, 30)).toBe(false);
  });
});
