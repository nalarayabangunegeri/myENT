import { NextRequest, NextResponse } from 'next/server';
import { API, setSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) return NextResponse.json(data, { status: r.status });
  await setSession(data.accessToken, data.refreshToken);
  const me = await fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${data.accessToken}` } }).then((x) => x.json());
  return NextResponse.json({ mustChangePassword: data.mustChangePassword, user: me });
}
