// Semester berjalan Jan–Jun / Jul–Des (batas kuota izin, backlog §22.3).
export function semesterStart(now = new Date()): Date {
  const m = now.getUTCMonth();
  return new Date(Date.UTC(now.getUTCFullYear(), m < 6 ? 0 : 6, 1));
}
