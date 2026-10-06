import { canManageMember } from './policy';
import { semesterStart } from '../absence/semester';

describe('backlog rules', () => {
  it('scope divisi: officer se-divisi, admin bebas', () => {
    const off = { id: 'o1', role: 'OFFICER', division: 'Foto' } as any;
    expect(canManageMember(off, { id: 'm1', division: 'Foto' } as any)).toBe(true);
    expect(canManageMember(off, { id: 'm2', division: 'Tulis' } as any)).toBe(false);
    expect(canManageMember({ id: 'a', role: 'ADMIN', division: '' } as any, { id: 'm2', division: 'Tulis' } as any)).toBe(true);
    expect(canManageMember(off, { id: 'o1', division: 'Foto' } as any)).toBe(false);
  });

  it('semester: Jan–Jun vs Jul–Des', () => {
    expect(semesterStart(new Date('2026-03-15T00:00:00Z')).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(semesterStart(new Date('2026-10-05T00:00:00Z')).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});
