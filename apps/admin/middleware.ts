import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p.startsWith('/login') || p.startsWith('/api/')) return NextResponse.next();
  if (!req.cookies.get('access') && !req.cookies.get('refresh')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
