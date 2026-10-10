import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { API, originOk } from '@/lib/auth';
import { RefreshCoalescer } from '@/lib/refresh-coalescer';

// Proxy umum ke API: token dari cookie httpOnly, refresh diam-diam saat 401.
// Coalescing per refresh-token: sesi A tak memengaruhi sesi B (KURANG.md §7).
const coalescer = new RefreshCoalescer();
// Segmen pertama path backend yang boleh diproxy — bukan open proxy.
const ALLOWED = new Set([
  'auth', 'users', 'meetings', 'attendance', 'absence-requests', 'corrections',
  'items', 'loans', 'materials', 'assignments', 'submissions', 'duty',
  'points', 'analytics', 'calendar', 'calendar.ics', 'dashboard',
  'audit-logs', 'notifications', 'config',
]);
const MAX_BODY = 12 * 1024 * 1024;
function doRefresh(refreshToken: string): Promise<boolean> {
  return coalescer.run(refreshToken, () => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 30_000);
    return fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: ctl.signal,
    })
      .then(async (rr) => {
        if (!rr.ok) return false;
        const t = await rr.json();
        await (await import('@/lib/auth')).setSession(t.accessToken, t.refreshToken);
        return true;
      })
      .catch(() => false)
      .finally(() => clearTimeout(t));
  });
}
async function forward(req: NextRequest, path: string, retry = true): Promise<Response> {
  const segs = path.split('/').filter(Boolean);
  if (!segs.length || !ALLOWED.has(segs[0]) || segs.some((s) => s === '..' || s.includes('\0')))
    return NextResponse.json({ message: 'Tidak ditemukan' }, { status: 404 });
  const c = await cookies();
  const access = c.get('access')?.value;
  const url = `${API}/${path}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  if (access) headers.authorization = `Bearer ${access}`;
  const ct = req.headers.get('content-type') ?? '';
  if (ct) headers['content-type'] = ct; // teruskan boundary multipart apa adanya
  const init: RequestInit = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method)) {
    // Buffer dulu lalu batasi: cek content-length saja lolos via chunked.
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.byteLength > MAX_BODY) return NextResponse.json({ message: 'File terlalu besar' }, { status: 413 });
    init.body = buf;
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30_000);
  try {
    let r = await fetch(url, { ...init, signal: ctl.signal });
    if (r.status === 401 && retry && c.get('refresh')?.value) {
      if (await doRefresh(c.get('refresh')!.value)) return forward(req, path, false);
    }
    // Produksi: 5xx backend jangan diteruskan mentah (bisa memuat detail internal).
    if (r.status >= 500 && process.env.NODE_ENV === 'production')
      return NextResponse.json({ message: 'Terjadi gangguan, coba lagi' }, { status: r.status });
    return r;
  } catch {
    return NextResponse.json({ message: 'API tak merespons, coba lagi' }, { status: 504 });
  } finally {
    clearTimeout(t);
  }
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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!originOk(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  return GET(req, ctx);
}
