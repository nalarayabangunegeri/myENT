import { SensitiveThrottleMiddleware } from './sensitive-throttle.middleware';

describe('SensitiveThrottleMiddleware (tahan NAT)', () => {
  const next = () => {};
  const req = (ip: string, sub?: string) =>
    ({
      ip,
      path: '/meetings/x/attendance',
      method: 'POST',
      headers: sub
        ? { authorization: `Bearer ${Buffer.from(JSON.stringify({ alg: 'x' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.s` }
        : {},
    }) as any;

  it('150 user di 1 IP tidak saling memblokir; 1 user brute-force diblokir', () => {
    const m = new SensitiveThrottleMiddleware();
    const res = {} as any;
    for (let i = 0; i < 150; i++) m.use(req('10.0.0.1', `u${i}`), res, next); // lolos semua
    expect(() => {
      for (let i = 0; i < 61; i++) m.use(req('10.0.0.1', 'brutal'), res, next);
    }).toThrow('Terlalu banyak request');
  });
});
