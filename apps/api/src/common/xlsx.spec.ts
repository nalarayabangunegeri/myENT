import { safeCell } from './xlsx';

describe('safeCell — anti formula injection', () => {
  it('escape = + - @', () => {
    expect(safeCell('=cmd|calc')).toBe("'=cmd|calc");
    expect(safeCell('+628')).toBe("'+628");
    expect(safeCell('Budi')).toBe('Budi');
    expect(safeCell(91.7)).toBe(91.7);
  });
});
