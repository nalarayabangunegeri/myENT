// Aturan gamifikasi murni (P3 ringan): streak + badge, dihitung saat dibaca tanpa model baru.

export interface Badge {
  id: string;
  label: string;
}

// Beruntun PRESENT dari yang terbaru (hanya meeting finalized non-duty).
export function streaks(rows: { status: string }[]): { current: number; longest: number } {
  let current = 0;
  let longest = 0;
  let run = 0;
  let countingCurrent = true;
  for (const r of rows) {
    if (r.status === 'PRESENT') {
      run++;
      if (countingCurrent) current++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
      countingCurrent = false;
    }
  }
  return { current, longest };
}

export function badges(input: {
  streak: number;
  monthCounted: number;
  monthAbsent: number;
  reviewedSubs: number;
  dutyAttended: number;
}): Badge[] {
  const out: Badge[] = [];
  if (input.streak >= 7) out.push({ id: 'streak_7', label: 'Rajin 7x beruntun' });
  if (input.monthCounted > 0 && input.monthAbsent === 0) out.push({ id: 'clean_month', label: 'Bulan tanpa alpha' });
  if (input.reviewedSubs >= 5) out.push({ id: 'tasker_5', label: '5 tugas direview' });
  if (input.dutyAttended >= 5) out.push({ id: 'duty_star_5', label: 'Bintang piket 5x' });
  return out;
}
