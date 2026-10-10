import { describe, expect, it } from 'vitest';
import { pathAllowed } from './allowlist';

describe('BFF allowlist', () => {
  it('jalur yang dipakai halaman lolos', () => {
    for (const p of [
      'auth/login', 'auth/me', 'users', 'users/123', 'meetings', 'meetings/123/attendance',
      'attendance/recap', 'attendance/recap/export.xlsx', 'absence-requests/bulk',
      'corrections/abc/approve', 'items', 'loans', 'materials', 'assignments',
      'submissions/abc/review', 'duty/summary', 'points/leaderboard', 'points/me',
      'analytics/trends', 'calendar.ics', 'dashboard', 'audit-logs', 'announcements', 'config',
    ]) {
      expect(pathAllowed(p), p).toBe(true);
    }
  });

  it('jalur asing/traversal ditolak', () => {
    for (const p of ['', '/', '../secret', 'auth/../x', 'evil', 'files/x', 'health', 'x%00y']) {
      expect(pathAllowed(p), p).toBe(false);
    }
  });
});
