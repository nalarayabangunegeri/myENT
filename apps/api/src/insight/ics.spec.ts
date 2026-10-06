import { toIcs } from './ics';

describe('toIcs', () => {
  it('format VCALENDAR valid dengan escape', () => {
    const out = toIcs([{ id: '1', title: 'Rapat, rutin;oke', start: new Date('2026-10-10T01:00:00Z'), end: new Date('2026-10-10T03:00:00Z') }]);
    expect(out).toContain('BEGIN:VCALENDAR');
    expect(out).toContain('DTSTART:20261010T010000Z');
    expect(out).toContain('Rapat\\, rutin\\;oke');
  });
});
