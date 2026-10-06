import { badges, streaks } from './points.rules';

describe('points.rules — gamifikasi', () => {
  it('streak dari yang terbaru; putus oleh non-PRESENT', () => {
    expect(streaks([{ status: 'PRESENT' }, { status: 'PRESENT' }, { status: 'SICK' }, { status: 'PRESENT' }])).toEqual({
      current: 2,
      longest: 2,
    });
    expect(streaks([{ status: 'PRESENT' }, { status: 'PRESENT' }, { status: 'PRESENT' }])).toEqual({ current: 3, longest: 3 });
    expect(streaks([])).toEqual({ current: 0, longest: 0 });
  });

  it('badge sesuai ambang', () => {
    const b = badges({ streak: 7, monthCounted: 3, monthAbsent: 0, reviewedSubs: 5, dutyAttended: 0 });
    expect(b.map((x) => x.id)).toEqual(['streak_7', 'clean_month', 'tasker_5']);
    expect(badges({ streak: 1, monthCounted: 0, monthAbsent: 0, reviewedSubs: 0, dutyAttended: 0 })).toEqual([]);
  });
});
