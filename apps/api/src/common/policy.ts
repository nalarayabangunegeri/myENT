import { Role, User } from '@prisma/client';

// Satu policy layer — AGENTS §6. Tambah scope divisi di sini tanpa ubah controller (PRD §22.3).
export function can(user: Pick<User, 'role'>, action: string): boolean {  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.OFFICER)
    return [
      'user:create',
      'user:read',
      'user:reset-password',
      'audit:read',
    ].includes(action);
  return action === 'me:read';
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
