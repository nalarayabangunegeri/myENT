import { createHmac, timingSafeEqual } from 'crypto';

// QR presensi P2: token HMAC {mid, exp}, kedaluwarsa singkat, diganti tiap generate.
// QR bukan satu-satunya validasi — window + selfie tetap berlaku (PRD §22.2).
export function signQr(mid: string, exp: number, secret: string) {
  const payload = Buffer.from(JSON.stringify({ mid, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyQr(token: string, mid: string, secret: string, now = Date.now()): boolean {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const want = createHmac('sha256', secret).update(payload).digest('hex');
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return false;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return d.mid === mid && typeof d.exp === 'number' && d.exp > now;
  } catch {
    return false;
  }
}
