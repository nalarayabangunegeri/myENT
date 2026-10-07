// Secret terpusat untuk HMAC non-JWT (QR, signed URL lokal).
// Jangan fallback ke 'dev' — gagal cepat dengan pesan jelas (PRD §18).
export function requireJwtSecret(): string {
  const s = process.env.JWT_SECRET ?? '';
  if (s.length < 32) throw new Error('JWT_SECRET wajib min 32 karakter (set di env, lihat .env.example)');
  return s;
}
