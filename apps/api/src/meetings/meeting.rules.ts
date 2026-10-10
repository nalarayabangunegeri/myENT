import { BadRequestException, ForbiddenException } from '@nestjs/common';

// Aturan murni PRD §8 — tanpa DB agar unit-testable. Service hanya memanggil ini.

// ponytail: Date di-body diasumsikan sudah jadi Date via ValidationPipe(transform). NaN = invalid.
export function assertWindow(s: { startAt: Date; endAt: Date; attendanceOpenAt: Date; attendanceCloseAt: Date }) {
  for (const d of [s.startAt, s.endAt, s.attendanceOpenAt, s.attendanceCloseAt])
    if (!(d instanceof Date) || isNaN(+d)) throw new BadRequestException('Waktu tidak valid');
  if (!(s.startAt < s.endAt)) throw new BadRequestException('start_at harus < end_at');
  if (!(s.attendanceOpenAt < s.attendanceCloseAt))
    throw new BadRequestException('attendance_open_at harus < attendance_close_at');
}

// Status manual oleh manusia: hanya CANCELLED (ONGOING/COMPLETED milik job — PRD §8).
// COMPLETED → CANCELLED hanya ADMIN.
export function assertManualCancel(from: string, isAdmin: boolean) {
  if (from === 'COMPLETED' && !isAdmin) throw new ForbiddenException('Hanya ADMIN dapat membatalkan COMPLETED');
  if (!['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED'].includes(from))
    throw new BadRequestException(`Tidak bisa membatalkan dari status ${from}`);
}

// Duplikasi: durasi + offset window relatif startAt dipertahankan (PRD §8).
export function duplicateTimes(
  src: { startAt: Date; endAt: Date; attendanceOpenAt: Date; attendanceCloseAt: Date },
  newStartAt: Date,
) {
  const shift = +newStartAt - +src.startAt;
  return {
    startAt: newStartAt,
    endAt: new Date(+src.endAt + shift),
    attendanceOpenAt: new Date(+src.attendanceOpenAt + shift),
    attendanceCloseAt: new Date(+src.attendanceCloseAt + shift),
  };
}
