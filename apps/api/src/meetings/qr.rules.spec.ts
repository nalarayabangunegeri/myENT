import { signQr, verifyQr } from './qr.rules';

describe('qr.rules — P2', () => {
  const secret = 's3cret';
  it('token valid untuk mid yang sama, kedaluwarsa/mid lain ditolak', () => {
    const t = signQr('m1', Date.now() + 300_000, secret);
    expect(verifyQr(t, 'm1', secret)).toBe(true);
    expect(verifyQr(t, 'm2', secret)).toBe(false);
    expect(verifyQr(signQr('m1', Date.now() - 1000, secret), 'm1', secret)).toBe(false);
    expect(verifyQr(t, 'm1', 'salah')).toBe(false);
  });
});
