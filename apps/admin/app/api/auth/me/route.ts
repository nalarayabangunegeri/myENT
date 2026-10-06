import { NextResponse } from 'next/server';
import { GET as proxy } from '../../[...path]/route';
import type { NextRequest } from 'next/server';

// /api/auth/me → proxy ke API /auth/me (dipakai guard halaman + ganti password wajib).
export async function GET(req: NextRequest) {
  return proxy(req, { params: Promise.resolve({ path: ['auth', 'me'] }) });
}
