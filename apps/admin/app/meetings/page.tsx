'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Empty, Err, Pager } from '@/lib/ui';

const dt = (s: string) => new Date(s).toLocaleString('id-ID');
const LIMIT = 20;

export default function Meetings() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ title: '', startAt: '', endAt: '', openAt: '', closeAt: '' });
  const load = (p = page) => {
    setErr('');
    api<{ data: any[]; total: number }>(`meetings?limit=${LIMIT}&page=${p}`)
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
        setPage(p);
      })
      .catch((e) => setErr(e.message));
  };
  useEffect(() => {
    load(1);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          attendanceOpenAt: new Date(form.openAt).toISOString(),
          attendanceCloseAt: new Date(form.closeAt).toISOString(),
        }),
      });
      setForm({ title: '', startAt: '', endAt: '', openAt: '', closeAt: '' });
      load(1);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function act(id: string, path: string, method = 'PATCH', body?: any) {
    try {
      await api(`meetings/${id}${path}`, { method, body: body ? JSON.stringify(body) : undefined });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Kegiatan</h1>
      <Err msg={err} />
      <form onSubmit={create} className="bg-white p-4 rounded shadow mb-4 grid md:grid-cols-3 gap-2">
        <input className="border p-2 rounded" placeholder="Judul" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <label className="text-xs">Mulai <input type="datetime-local" className="border p-2 rounded w-full" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required /></label>
        <label className="text-xs">Selesai <input type="datetime-local" className="border p-2 rounded w-full" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required /></label>
        <label className="text-xs">Presensi dibuka <input type="datetime-local" className="border p-2 rounded w-full" value={form.openAt} onChange={(e) => setForm({ ...form, openAt: e.target.value })} required /></label>
        <label className="text-xs">Presensi ditutup <input type="datetime-local" className="border p-2 rounded w-full" value={form.closeAt} onChange={(e) => setForm({ ...form, closeAt: e.target.value })} required /></label>
        <button className="bg-blue-600 text-white p-2 rounded">Buat DRAFT</button>
      </form>
      {rows.length === 0 ? <Empty /> : (
        <table className="w-full bg-white rounded shadow text-sm">
          <thead><tr className="text-left border-b"><th className="p-2">Judul</th><th>Mulai</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="p-2"><Link className="text-blue-600" href={`/meetings/${m.id}`}>{m.title}</Link></td>
                <td>{dt(m.startAt)}</td>
                <td>{m.status}</td>
                <td className="flex gap-1 flex-wrap p-1">
                  {m.status === 'DRAFT' && <button className="text-green-700" onClick={() => act(m.id, '', 'PATCH', { status: 'PUBLISHED' })}>Publish</button>}
                  {m.status !== 'CANCELLED' && <button className="text-red-600" onClick={() => confirm('Batalkan?') && act(m.id, '', 'PATCH', { status: 'CANCELLED' })}>Batal</button>}
                  <button className="text-gray-600" onClick={() => { const s = prompt('Mulai duplikat (YYYY-MM-DDTHH:mm)', m.startAt.slice(0, 16)); if (s) act(m.id, '/duplicate', 'POST', { startAt: new Date(s).toISOString() }); }}>Duplikat</button>
                  <button className="text-red-400" onClick={() => confirm(`Hapus ${m.title}?`) && act(m.id, '', 'DELETE')}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager page={page} total={total} limit={LIMIT} onPage={load} />
    </div>
  );
}
