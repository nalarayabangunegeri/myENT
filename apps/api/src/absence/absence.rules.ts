// Aturan murni AbsenceRequest (PRD §11) — tanpa DB agar unit-testable.

// Mapping alasan → status; default kebijakan org (P1: pindah ke halaman konfigurasi — PRD §15.8).
export const APPROVAL_MAPPING: Record<string, 'SICK' | 'PERMITTED' | 'DISPENSATION'> = {
  SICK: 'SICK',
  ACADEMIC: 'PERMITTED',
  BEREAVEMENT: 'PERMITTED',
  ORGANIZATION: 'PERMITTED',
  DISPENSATION: 'DISPENSATION',
  OTHER: 'PERMITTED',
};

// Status kehadiran efektif; default §14.1 (P1: configurable — PRD §15.8).
export const EFFECTIVE_STATUSES = ['PRESENT', 'PERMITTED', 'SICK', 'DISPENSATION'] as const;

// Persentase 1 desimal half-up; null jika tak ada meeting terhitung ("–", PRD §14.1).
export function percentage(effective: number, counted: number): number | null {
  if (counted === 0) return null;
  return Math.round((effective / counted) * 1000) / 10;
}
