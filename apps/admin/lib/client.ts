'use client';
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30_000);
  try {
    const r = await fetch(`/api/${path}`, {
      ...init,
      signal: ctl.signal,
      headers: { ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...init?.headers },
    });
    if (r.status === 401 && !path.startsWith('auth/')) {
      location.href = '/login';
      const e: any = new Error('Sesi habis');
      e.status = 401;
      throw e;
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e: any = new Error(Array.isArray((data as any).message) ? (data as any).message.join(', ') : (data as any).message ?? `Gagal (${r.status})`);
      e.status = r.status;
      throw e;
    }
    return data as T;
  } finally {
    clearTimeout(t);
  }
}

export async function dl(url: string, filename: string) {
  const r = await fetch(url);
  if (r.status === 401) {
    location.href = '/login';
    throw new Error('Sesi habis');
  }
  if (!r.ok) throw new Error(`Unduhan gagal (${r.status})`);
  const blob = await r.blob();
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 5_000);
}
