import ExcelJS from 'exceljs';

// Cegah formula injection: sel diawali = + - @ diberi ' (AGENTS §15).
export function safeCell(v: unknown): unknown {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return `'${v}`;
  return v;
}

export async function toXlsx(headers: string[], rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('rekap');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r.map(safeCell));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
