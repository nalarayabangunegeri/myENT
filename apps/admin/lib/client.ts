'use client';
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    ...init,
    headers: { ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...init?.headers },
  });
  if (r.status === 401 && !path.startsWith('auth/')) {
    location.href = '/login';
    throw new Error('Sesi habis');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(Array.isArray((data as any).message) ? (data as any).message.join(', ') : (data as any).message ?? 'Gagal');
  return data as T;
}

export function dl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
