// Secret terpusat. JWT, HMAC file, dan HMAC QR WAJIB beda key — bocor 1 ≠ jebol semua.
// FILE_HMAC_SECRET / QR_HMAC_SECRET fallback ke JWT_SECRET agar deploy lama tak pecah (tulis warning di log saat fallback).
// Jangan fallback ke 'dev' — gagal cepat dengan pesan jelas (PRD §18).
export function requireJwtSecret(): string {
  const s = process.env.JWT_SECRET ?? '';
  if (s.length < 32) throw new Error('JWT_SECRET wajib min 32 karakter (set di env, lihat .env.example)');
  return s;
}

function pick(name: string): string {
  const s = process.env[name] ?? '';
  if (s.length >= 32) return s;
  if (s.length > 0) throw new Error(`${name} diisi tapi < 32 karakter`);
  return requireJwtSecret(); // back-compat: isolasi penuh setelah operator mengisi key khusus.
}

export function requireFileSecret(): string {
  return pick('FILE_HMAC_SECRET');
}

export function requireQrSecret(): string {
  return pick('QR_HMAC_SECRET');
}
