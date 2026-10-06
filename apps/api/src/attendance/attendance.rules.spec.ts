import { assertSelfWindow, detectImage, selfieKey } from './attendance.rules';

describe('attendance.rules — PRD §9–§10', () => {
  it('magic bytes: jpg/png/webp lolos, exe ditolak', () => {
    expect(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('jpg');
    expect(detectImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]))).toBe('png');
    expect(detectImage(Buffer.concat([Buffer.from('RIFFxxxxWEBP'), Buffer.alloc(4)]))).toBe('webp');
    expect(detectImage(Buffer.from('MZ fake exe'))).toBeNull();
  });

  it('window: di luar jadwal ditolak dengan pesan jelas', () => {
    const m = {
      status: 'PUBLISHED',
      attendanceOpenAt: new Date('2026-10-10T00:30:00Z'),
      attendanceCloseAt: new Date('2026-10-10T03:00:00Z'),
    };
    expect(() => assertSelfWindow(m, new Date('2026-10-10T01:00:00Z'))).not.toThrow();
    expect(() => assertSelfWindow({ ...m, status: 'DRAFT' }, new Date('2026-10-10T01:00:00Z'))).toThrow();
    expect(() => assertSelfWindow(m, new Date('2026-10-10T04:00:00Z'))).toThrow('sudah ditutup');
  });

  it('key mengikuti pola attendance/{yyyy}/{mm}/{uuid}.jpg', () => {
    expect(selfieKey(new Date('2026-10-05T00:00:00Z'), 'u1')).toBe('attendance/2026/10/u1.jpg');
  });
});
