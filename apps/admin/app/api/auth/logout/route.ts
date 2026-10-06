import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API, clearSession } from '@/lib/auth';

export async function POST() {
  const c = await cookies();
  const refresh = c.get('refresh')?.value;
  if (refresh)
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => {});
  await clearSession();
  return NextResponse.json({ ok: true });
}
