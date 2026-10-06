import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { API, originOk, setSession } from '@/lib/auth';

// Proxy umum ke API: token dari cookie httpOnly, refresh diam-diam saat 401.
async function forward(req: NextRequest, path: string, retry = true): Promise<Response> {
  const c = await cookies();
  const access = c.get('access')?.value;
  const url = `${API}/${path}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  if (access) headers.authorization = `Bearer ${access}`;
  const ct = req.headers.get('content-type') ?? '';
  if (ct && !ct.includes('multipart/form-data')) headers['content-type'] = ct;
  const init: RequestInit = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method)) init.body = Buffer.from(await req.arrayBuffer());
  let r = await fetch(url, init);
  if (r.status === 401 && retry && c.get('refresh')?.value) {
    const rr = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: c.get('refresh')!.value }),
    });
    if (rr.ok) {
      const t = await rr.json();
      await setSession(t.accessToken, t.refreshToken);
      return forward(req, path, false);
    }
  }
  return r;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const r = await forward(req, (await ctx.params).path.join('/'));
  const h: Record<string, string> = { 'content-type': r.headers.get('content-type') ?? 'application/json' };
  const cd = r.headers.get('content-disposition');
  if (cd) h['content-disposition'] = cd;
  return new NextResponse(r.body, { status: r.status, headers: h });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!originOk(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  return GET(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!originOk(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  return GET(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!originOk(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  return GET(req, ctx);
}
