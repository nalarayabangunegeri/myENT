import { NextRequest, NextResponse } from 'next/server';

// UX gate saja — otorisasi sesungguhnya di backend (AGENTS §4).
// Tolak cookie dummy/kedaluwarsa agar tidak lolos hanya karena "ada".
function tokenAlive(v: string | undefined): boolean {
  if (!v) return false;
  try {
    const parts = v.split('.');
    if (parts.length !== 3) return false;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' && exp * 1000 > Date.now() + 10_000;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p.startsWith('/login') || p.startsWith('/api/')) return NextResponse.next();
  // Lolos bila access masih hidup ATAU refresh (opaque) ada — proxy akan refresh diam-diam.
  if (!tokenAlive(req.cookies.get('access')?.value) && !req.cookies.get('refresh')?.value) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/).*)'] };
