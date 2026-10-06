'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Empty, Err, Pager } from '@/lib/ui';

const LIMIT = 20;

export default function Members() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ nim: '', name: '', password: '', role: 'MEMBER' });
  const load = (p = 1, s = q) => {
    setErr('');
    api<{ data: any[]; total: number }>(`users?limit=${LIMIT}&page=${p}${s ? `&search=${encodeURIComponent(s)}` : ''}`)
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
        setPage(p);
      })
      .catch((e) => setErr(e.message));
  };
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ nim: '', name: '', password: '', role: 'MEMBER' });
      load(1);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function toggleActive(u: any) {
    try {
      await api(`users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }) });
      load(page);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function csv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const r = await api<{ results: any[] }>('users/import', { method: 'POST', body: JSON.stringify({ csv: text }) });
      alert(r.results.map((x: any) => `${x.nim}: ${x.status}${x.temporaryPassword ? ` (${x.temporaryPassword})` : ''}`).join('\n'));
      load(1);
    } catch (er: any) {
      setErr(er.message);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Anggota</h1>
      <Err msg={err} />
      <div className="flex gap-2 mb-2 text-sm">
        <input className="border p-2 rounded" placeholder="Cari nama/NIM" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)} />
        <button className="bg-gray-200 px-2 rounded" onClick={() => load(1)}>Cari</button>
        <label className="bg-gray-200 px-2 rounded cursor-pointer flex items-center">Import CSV<input type="file" accept=".csv" className="hidden" onChange={csv} /></label>
      </div>
      <form onSubmit={create} className="bg-white p-4 rounded shadow mb-4 grid md:grid-cols-5 gap-2 text-sm">
        <input className="border p-2 rounded" placeholder="NIM" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })} required />
        <input className="border p-2 rounded" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="border p-2 rounded" type="password" placeholder="Password (min 10)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} />
        <select className="border p-2 rounded" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option>MEMBER</option><option>OFFICER</option><option>ADMIN</option>
        </select>
        <button className="bg-blue-600 text-white p-2 rounded">Tambah</button>
      </form>
      {rows.length === 0 ? <Empty /> : (
        <table className="w-full bg-white rounded shadow text-sm">
          <thead><tr className="text-left border-b"><th className="p-2">NIM</th><th>Nama</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="p-2">{u.nim}</td><td>{u.name}</td><td>{u.role}</td><td>{u.status}</td>
                <td><button className="text-red-600" onClick={() => confirm(`${u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'} ${u.name}?`) && toggleActive(u)}>{u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager page={page} total={total} limit={LIMIT} onPage={(p) => load(p)} />
    </div>
  );
}
