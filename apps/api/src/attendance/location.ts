import { BadRequestException } from '@nestjs/common';

// Verifikasi lokasi P2: hanya saat presensi, tanpa background tracking (PRD §17).
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const d = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(d(lat2 - lat1) / 2) ** 2 + Math.cos(d(lat1)) * Math.cos(d(lat2)) * Math.sin(d(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function assertInside(
  m: { latitude: number | null; longitude: number | null; radiusM: number | null },
  loc: { latitude?: number; longitude?: number },
) {
  if (m.latitude == null || m.longitude == null || m.radiusM == null) return; // tanpa verifikasi
  if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number')
    throw new BadRequestException('Lokasi wajib untuk kegiatan ini');
  const d = haversineM(m.latitude, m.longitude, loc.latitude, loc.longitude);
  if (d > m.radiusM) throw new BadRequestException(`Di luar radius (${Math.round(d)} m)`);
}
