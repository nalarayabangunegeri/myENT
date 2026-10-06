import { APPROVAL_MAPPING, percentage } from './absence.rules';

describe('absence.rules — PRD §11, §14.1', () => {
  it('mapping SICK→SICK, ACADEMIC→PERMITTED, DISPENSATION→DISPENSATION', () => {
    expect(APPROVAL_MAPPING.SICK).toBe('SICK');
    expect(APPROVAL_MAPPING.ACADEMIC).toBe('PERMITTED');
    expect(APPROVAL_MAPPING.DISPENSATION).toBe('DISPENSATION');
    expect(APPROVAL_MAPPING.OTHER).toBe('PERMITTED');
  });

  it('contoh PRD §14.1 → 91,7%', () => {
    expect(percentage(8 + 2 + 1 + 0, 12)).toBe(91.7);
  });

  it('counted 0 → null ("–")', () => {
    expect(percentage(0, 0)).toBeNull();
  });
});
