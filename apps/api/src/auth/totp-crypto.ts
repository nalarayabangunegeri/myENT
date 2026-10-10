import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Enkripsi at-rest untuk totpSecret (kolom tetap String — tanpa migrasi).
// Format: `enc:v1:<iv hex>:<cipher+tag hex>`. Baris lama plaintext tetap terbaca (fallback legacy).
const PREFIX = 'enc:v1:';

function key(): Buffer | null {
  const s = process.env.TOTP_ENC_KEY ?? '';
  if (s.length < 32) return null;
  return createHash('sha256').update(s).digest();
}

export function protectTotpSecret(secret: string): string {
  const k = key();
  if (!k) return secret; // dev tanpa key: perilaku lama; prod wajib isi (cek di main.ts).
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([c.update(secret, 'utf8'), c.final(), c.getAuthTag()]);
  return `${PREFIX}${iv.toString('hex')}:${enc.toString('hex')}`;
}

export function openTotpSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext.
  const k = key();
  if (!k) throw new Error('TOTP_ENC_KEY wajib untuk membaca secret terenkripsi');
  const [ivHex, dataHex] = stored.slice(PREFIX.length).split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const tag = data.subarray(data.length - 16);
  const d = createDecipheriv('aes-256-gcm', k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]).toString('utf8');
}
