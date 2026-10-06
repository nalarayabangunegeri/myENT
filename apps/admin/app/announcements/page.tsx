'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Empty, Err } from '@/lib/ui';

export default function Announce() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ title: '', body: '', division: '', cohort: '' });
  const load = () => api<{ data: any[] }>('audit-logs?action=announcement.create&limit=20').then((r) => setRows(r.data)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Kirim ke ${form.division || 'semua anggota aktif'}?`)) return;
    try {
      await api('announcements', {
        method: 'POST',
        body: JSON.stringify({ title: form.title, body: form.body, division: form.division || undefined, cohortYear: form.cohort ? Number(form.cohort) : undefined }),
      });
      setForm({ title: '', body: '', division: '', cohort: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Pengumuman</h1>
      <Err msg={err} />
      <form onSubmit={send} className="bg-white p-4 rounded shadow mb-4 grid gap-2 text-sm max-w-xl">
        <input className="border p-2 rounded" placeholder="Judul" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={3} />
        <textarea className="border p-2 rounded" placeholder="Isi" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Divisi target (kosong = semua)" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Angkatan (kosong = semua)" value={form.cohort} onChange={(e) => setForm({ ...form, cohort: e.target.value })} />
        <button className="bg-blue-600 text-white p-2 rounded">Kirim broadcast</button>
      </form>
      <h2 className="font-bold mb-2">Terkirim</h2>
      {rows.length === 0 ? <Empty /> : (
      <table className="w-full bg-white rounded shadow text-sm">
        <thead><tr className="text-left border-b"><th className="p-2">Waktu</th><th>Judul</th><th>Penerima</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="p-2">{new Date(a.createdAt).toLocaleString('id-ID')}</td>
              <td>{(a.newValue as any)?.title}</td><td>{(a.newValue as any)?.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
