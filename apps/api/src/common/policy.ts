import { Role, User } from '../generated/client';

// Lapisan policy baca (PRD §22.3): OFFICER hanya divisinya; ADMIN global.
// Dipakai SERAGAM di semua list/rekap — jangan filter divisi ad-hoc di service.
// Tanpa field = filter top-level (tabel user); dengan field = via relasi.
export function divisionScope(actor: { role: string; division: string }, field?: string): any {
  if (actor.role === 'ADMIN') return {};
  const cond = { division: actor.division };
  return field ? { [field]: cond } : cond;
}

// Backlog scope divisi (§22.3): OFFICER hanya atas anggota se-divisi; ADMIN bebas.
export function canManageMember(
  actor: Pick<User, 'role' | 'division' | 'id'>,
  target: Pick<User, 'division' | 'id'>,
): boolean {
  if (actor.role === Role.ADMIN) return true;
  if (actor.role !== Role.OFFICER) return false;
  if (actor.id === target.id) return false;
  return actor.division === target.division;
}
