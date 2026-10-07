import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { API, clearSession, originOk } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
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
