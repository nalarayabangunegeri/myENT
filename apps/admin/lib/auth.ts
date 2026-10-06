import { cookies } from 'next/headers';

export const API = process.env.API_URL ?? 'http://localhost:3100';
const SECURE = process.env.NODE_ENV === 'production';

export async function setSession(access: string, refresh: string) {
  const c = await cookies();
  c.set('access', access, { httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge: 15 * 60 });
  c.set('refresh', refresh, { httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge: 14 * 86400 });
}

export async function clearSession() {
  const c = await cookies();
  c.delete('access');
  c.delete('refresh');
}

export function originOk(req: Request) {
  const o = req.headers.get('origin');
  if (!o) return true;
  const allow = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return allow.includes(o);
}
