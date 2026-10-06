import { NextRequest, NextResponse } from 'next/server';
import { API, setSession } from '@/lib/auth';

async function turnstileOk(token: string | undefined, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Tanpa secret = tolak, kecuali dimatikan eksplisit (dev lokal saja).
  if (!secret) return process.env.TURNSTILE_DISABLED === 'true';
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    signal: AbortSignal.timeout(10_000),
  }).then((x) => x.json()).catch(() => null);
  return r?.success === true;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!(await turnstileOk(body['cf-turnstile-response'], ip)))
    return NextResponse.json({ message: 'Verifikasi manusia gagal' }, { status: 403 });
  const { 'cf-turnstile-response': _, ...login } = body;
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(login),
  });
  const data = await r.json();
  if (!r.ok) return NextResponse.json(data, { status: r.status });
  if (data.twoFactorRequired) return NextResponse.json(data);
  if (!data.accessToken || !data.refreshToken) return NextResponse.json(data, { status: 200 });
  await setSession(data.accessToken, data.refreshToken);
  const me = await fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${data.accessToken}` }, signal: AbortSignal.timeout(10_000) }).then((x) => x.json()).catch(() => null);
  return NextResponse.json({ mustChangePassword: data.mustChangePassword, user: me });
}
