import { NextRequest, NextResponse } from 'next/server';
import { API, setSession } from '@/lib/auth';

async function turnstileOk(token: string | undefined) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Tanpa secret = tolak, kecuali dimatikan eksplisit (dev lokal saja).
  if (!secret) return process.env.TURNSTILE_DISABLED === 'true';
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  }).then((x) => x.json()).catch(() => null);
  return r?.success === true;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!(await turnstileOk(body['cf-turnstile-response'])))
    return NextResponse.json({ message: 'Verifikasi manusia gagal' }, { status: 403 });
  const { 'cf-turnstile-response': _, ...login } = body;
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(login),
  });
  const data = await r.json();
  if (!r.ok) return NextResponse.json(data, { status: r.status });
  await setSession(data.accessToken, data.refreshToken);
  const me = await fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${data.accessToken}` } }).then((x) => x.json());
  return NextResponse.json({ mustChangePassword: data.mustChangePassword, user: me });
}
