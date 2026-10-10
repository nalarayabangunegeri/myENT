import { openTotpSecret, protectTotpSecret } from './totp-crypto';

describe('totp-crypto', () => {
  const OLD = process.env.TOTP_ENC_KEY;
  afterEach(() => {
    if (OLD === undefined) delete process.env.TOTP_ENC_KEY;
    else process.env.TOTP_ENC_KEY = OLD;
  });

  it('roundtrip terenkripsi', () => {
    process.env.TOTP_ENC_KEY = 'kunci-32-karakter-untuk-test-saja-123';
    const enc = protectTotpSecret('JBSWY3DPEHPK3PXP');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(openTotpSecret(enc)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('legacy plaintext tetap terbaca', () => {
    delete process.env.TOTP_ENC_KEY;
    expect(protectTotpSecret('ABCDEF')).toBe('ABCDEF');
    expect(openTotpSecret('ABCDEF')).toBe('ABCDEF');
  });
});
