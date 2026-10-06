'use client';
import { useEffect, useState } from 'react';
import { api, dl } from '@/lib/client';
import { Empty, Err, Pager } from '@/lib/ui';

const COLS = ['name', 'present', 'permitted', 'sick', 'dispensation', 'absent', 'percentage'];
const LIMIT = 20;

export default function Recap() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState({ search: '', sortBy: 'name', order: 'asc', from: '', to: '' });
  const toISO = (s: string) => {
    if (!s) return undefined;
    const d = new Date(s);
    return isNaN(+d) ? undefined : d.toISOString();
  };
  const load = (p = page) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    const params = new URLSearchParams({ limit: `${LIMIT}`, page: `${p}`, search: q.search, sortBy: q.sortBy, order: q.order });
    const f = toISO(q.from);
    const t = toISO(q.to);
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    api<{ data: any[]; total: number }>(`attendance/recap?${params}`)
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
        setPage(p);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    load(1);
  }, []);

  function exp() {
    const params = new URLSearchParams({ search: q.search, sortBy: q.sortBy, order: q.order });
    const f = toISO(q.from);
    const t = toISO(q.to);
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    const s = params.toString();
    dl(`/api/attendance/recap/export.xlsx${s ? `?${s}` : ''}`, 'rekap.xlsx').catch((e) => setErr(e.message));
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-bold">Rekap ({total})</h1>
        <button className="bg-green-700 text-white px-2 py-1 rounded text-sm" onClick={exp}>Export XLSX</button>
      </div>
      <Err msg={err} />
      <div className="flex gap-2 mb-2 text-sm">
        <input className="border p-2 rounded" placeholder="Cari nama/NIM" aria-label="Cari nama/NIM" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select className="border p-2 rounded" aria-label="Urut kolom" value={q.sortBy} onChange={(e) => setQ({ ...q, sortBy: e.target.value })}>
          {COLS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="border p-2 rounded" aria-label="Urutan" value={q.order} onChange={(e) => setQ({ ...q, order: e.target.value })}>
          <option>asc</option><option>desc</option>
        </select>
        <input className="border p-2 rounded" type="date" aria-label="Dari tanggal" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} />
        <input className="border p-2 rounded" type="date" aria-label="Sampai tanggal" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} />
        <button className="bg-gray-200 px-2 rounded disabled:opacity-50" disabled={busy} onClick={() => load(1)}>Terapkan</button>
      </div>
      {rows.length === 0 ? <Empty /> : (
      <table className="w-full bg-white rounded shadow text-sm">
        <thead><tr className="text-left border-b"><th className="p-2">Nama</th><th>NIM</th><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Disp</th><th>Alpha</th><th>%</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user.id} className="border-b">
              <td className="p-2">{r.user.name}</td><td>{r.user.nim}</td><td>{r.present}</td><td>{r.permitted}</td>
              <td>{r.sick}</td><td>{r.dispensation}</td><td>{r.absent}</td><td>{r.percentage ?? '–'}{r.percentage !== null && '%'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      <Pager page={page} total={total} limit={LIMIT} onPage={load} />
    </div>
  );
}
