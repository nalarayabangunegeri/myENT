// Segmen pertama path backend yang boleh diproxy BFF — bukan open proxy.
// Diuji di allowlist.test.ts: halaman mati (announcements) tertangkap di sini, bukan di prod.
export const ALLOWED = new Set([
  'auth', 'users', 'meetings', 'attendance', 'absence-requests', 'corrections',
  'items', 'loans', 'materials', 'assignments', 'submissions', 'duty',
  'points', 'analytics', 'calendar', 'calendar.ics', 'dashboard',
  'audit-logs', 'announcements', 'config',
]);

export function pathAllowed(path: string): boolean {
  const segs = path.split('/').filter(Boolean);
  return !!segs.length && ALLOWED.has(segs[0]) && !segs.some((s) => s === '..' || s.includes('\0'));
}
