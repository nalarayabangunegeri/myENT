// CSV minimal untuk import anggota: nim,nama,divisi,angkatan[,email] — PRD §6.1.
// ponytail: split manual (tanpa lib). Ceiling: tanpa quote-escape; upgrade ke lib CSV jika butuh koma dalam nama.
export interface CsvRow {
  nim: string;
  name: string;
  division: string;
  cohortYear: number;
  email?: string;
}

export function parseMemberCsv(text: string): { rows: CsvRow[]; errors: { line: number; reason: string }[] } {
  const rows: CsvRow[] = [];
  const errors: { line: number; reason: string }[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (line === 1 && /^nim\s*,/i.test(trimmed)) return; // header opsional
    const cols = trimmed.split(',').map((c) => c.trim());
    const [nim, name, division = '', cohort = '0', email] = cols;
    if (!nim || !name) return void errors.push({ line, reason: 'nim dan nama wajib' });
    const cohortYear = Number(cohort || 0);
    if (!Number.isInteger(cohortYear)) return void errors.push({ line, reason: 'angkatan harus bilangan bulat' });
    rows.push({ nim, name, division, cohortYear, ...(email ? { email } : {}) });
  });
  return { rows, errors };
}
