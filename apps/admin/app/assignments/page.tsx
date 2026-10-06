'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Empty, Err } from '@/lib/ui';

export default function Assignments() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [subs, setSubs] = useState<any[]>([]);
  const [cur, setCur] = useState('');
  const [form, setForm] = useState({ title: '', deadline: '' });
  const load = () => api<{ data: any[] }>('assignments?limit=50').then((r) => setRows(r.data)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('deadline', new Date(form.deadline).toISOString());
    const f = (document.getElementById('af') as HTMLInputElement).files?.[0];
    if (f) fd.append('attachment', f);
    await api('assignments', { method: 'POST', body: fd });
    setForm({ title: '', deadline: '' });
    load();
  }

  async function show(id: string) {
    setCur(id);
    const r = await api<{ data: any[] }>(`assignments/${id}/submissions?limit=100`);
    setSubs(r.data);
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Tugas</h1>
      <Err msg={err} />
      <form onSubmit={create} className="bg-white p-4 rounded shadow mb-4 grid md:grid-cols-4 gap-2 text-sm">
        <input className="border p-2 rounded" placeholder="Judul" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input type="datetime-local" className="border p-2 rounded" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required />
        <input id="af" type="file" className="border p-2 rounded" />
        <button className="bg-blue-600 text-white p-2 rounded">Buat</button>
      </form>
      {rows.length === 0 ? <Empty /> : (
      <table className="w-full bg-white rounded shadow text-sm mb-4">
        <thead><tr className="text-left border-b"><th className="p-2">Judul</th><th>Deadline</th><th>Terkumpul</th><th>Aksi</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="p-2">{a.title}</td><td>{new Date(a.deadline).toLocaleString('id-ID')}</td>
              <td>{a._count?.submissions ?? ''}</td>
              <td><button className="text-blue-600" onClick={() => show(a.id)}>Submission</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      {subs.length > 0 && (
        <table className="w-full bg-white rounded shadow text-sm">
          <thead><tr className="text-left border-b"><th className="p-2">Nama</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="p-2">{s.user?.name}</td><td>{s.status}</td>
                <td>{!s.reviewedAt && <button className="text-green-700" onClick={() => { const n = prompt('Catatan review', '') ?? ''; api(`submissions/${s.id}/review`, { method: 'PATCH', body: JSON.stringify({ reviewNote: n }) }).then(() => show(cur)); }}>Review</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
