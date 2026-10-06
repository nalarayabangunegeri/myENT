import { generateSecret, totp, verifyTotp } from './totp';

describe('totp (RFC 6238)', () => {
  it('vektor uji: secret ASCII 12345678901234567890 @59s → 287082', () => {
    // GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ = base32("12345678901234567890")
    expect(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000)).toBe(287082);
  });

  it('generate + verify roundtrip, toleransi ±1 langkah', () => {
    const s = generateSecret();
    const code = String(totp(s)).padStart(6, '0');
    expect(verifyTotp(s, code)).toBe(true);
    expect(verifyTotp(s, '000000')).toBe(false);
  });
});
