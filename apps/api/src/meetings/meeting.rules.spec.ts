import { assertManualCancel, assertWindow, autoStatus, duplicateTimes } from './meeting.rules';
import { DAY_MS } from './meetings.service';

describe('meeting.rules — PRD §8', () => {
  const w = {
    startAt: new Date('2026-10-10T01:00:00Z'),
    endAt: new Date('2026-10-10T03:00:00Z'),
    attendanceOpenAt: new Date('2026-10-10T00:30:00Z'),
    attendanceCloseAt: new Date('2026-10-10T03:00:00Z'),
  };

  it('window valid lolos, start>=end ditolak', () => {
    expect(() => assertWindow(w)).not.toThrow();
    expect(() => assertWindow({ ...w, startAt: w.endAt })).toThrow('start_at harus < end_at');
    expect(() => assertWindow({ ...w, attendanceOpenAt: w.attendanceCloseAt })).toThrow();
  });

  it('cancel manual: COMPLETED hanya admin', () => {
    expect(() => assertManualCancel('PUBLISHED', false)).not.toThrow();
    expect(() => assertManualCancel('COMPLETED', false)).toThrow('Hanya ADMIN');
    expect(() => assertManualCancel('COMPLETED', true)).not.toThrow();
    expect(() => assertManualCancel('CANCELLED', true)).toThrow();
  });

  it('job otomatis PUBLISHED→ONGOING→COMPLETED', () => {
    const t0 = new Date('2026-10-10T02:00:00Z');
    expect(autoStatus({ status: 'PUBLISHED', startAt: w.startAt, endAt: w.endAt }, t0)).toBe('ONGOING');
    expect(autoStatus({ status: 'ONGOING', startAt: w.startAt, endAt: w.endAt }, new Date('2026-10-10T04:00:00Z'))).toBe('COMPLETED');
    expect(autoStatus({ status: 'DRAFT', startAt: w.startAt, endAt: w.endAt }, t0)).toBeNull();
  });

  it('duplikasi menggeser window relatif start', () => {
    expect(DAY_MS).toBe(86400000); // regresi: pernah 10 hari karena typo separator
    const d = duplicateTimes(w, new Date('2026-10-17T01:00:00Z'));
    expect(d.endAt.toISOString()).toBe('2026-10-17T03:00:00.000Z');
    expect(d.attendanceOpenAt.toISOString()).toBe('2026-10-17T00:30:00.000Z');
  });
});
