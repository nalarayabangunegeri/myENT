import { parseMemberCsv } from './csv';

describe('parseMemberCsv', () => {
  it('header opsional, baris rusak dilaporkan', () => {
    const { rows, errors } = parseMemberCsv('nim,nama,divisi,angkatan\nM001,Luthfi,Foto,2023\n,Broken,,x');
    expect(rows).toEqual([{ nim: 'M001', name: 'Luthfi', division: 'Foto', cohortYear: 2023 }]);
    expect(errors).toHaveLength(1);
  });
});
