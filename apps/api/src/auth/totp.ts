import { createHmac, randomBytes } from 'crypto';

// TOTP RFC 6238 (SHA1, 6 digit, 30 dtk) tanpa dep — otplib v13 ESM-only, tak jalan di Jest CJS.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(length = 20) {
  const b = randomBytes(length);
  let out = '';
  let bits = 0;
  let val = 0;
  for (const byte of b) {
    val = (val << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

function b32dec(s: string) {
  let bits = 0;
  let val = 0;
  const out: number[] = [];
  for (const c of s.toUpperCase().replace(/=+$/, '')) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('base32 invalid');
    val = (val << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totp(secret: string, at = Date.now(), window = 0) {
  const counter = Math.floor(at / 30000) + window;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', b32dec(secret)).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1000000;
}

export function verifyTotp(secret: string, code: string, at = Date.now()) {
  const c = Number(code);
  if (!Number.isInteger(c)) return false;
  return totp(secret, at, -1) === c || totp(secret, at, 0) === c || totp(secret, at, 1) === c;
}

export function keyuri(nim: string, secret: string, issuer = 'JURNALISTIK') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(nim)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}
