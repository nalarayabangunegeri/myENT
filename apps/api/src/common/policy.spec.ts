import { can } from './policy';

describe('can() — AGENTS §6', () => {
  it('ADMIN boleh semua', () => {
    expect(can({ role: 'ADMIN' } as any, 'anything')).toBe(true);
  });
  it('OFFICER boleh baca audit, MEMBER tidak', () => {
    expect(can({ role: 'OFFICER' } as any, 'audit:read')).toBe(true);
    expect(can({ role: 'MEMBER' } as any, 'audit:read')).toBe(false);
  });
  it('default deny', () => {
    expect(can({ role: 'MEMBER' } as any, 'user:create')).toBe(false);
  });
});
