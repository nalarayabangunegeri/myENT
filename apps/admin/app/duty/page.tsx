'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Err } from '@/lib/ui';

export default function Duty() {
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ startDate: '', days: '7', perDay: '1', division: '' });
  const gen = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ meetings: number }>('duty/roster', {
        method: 'POST',
        body: JSON.stringify({
          startDate: new Date(form.startDate).toISOString(),
          days: Number(form.days),
          perDay: Number(form.perDay),
          division: form.division || undefined,
        }),
      });
      alert(`${r.meetings} kegiatan piket (DRAFT) dibuat`);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Piket</h1>
      <Err msg={err} />
      <form onSubmit={gen} className="bg-white p-4 rounded shadow mb-4 grid md:grid-cols-5 gap-2 text-sm">
        <input type="date" className="border p-2 rounded" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        <input type="number" min={1} max={90} className="border p-2 rounded" placeholder="Hari" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
        <input type="number" min={1} max={5} className="border p-2 rounded" placeholder="Orang/hari" value={form.perDay} onChange={(e) => setForm({ ...form, perDay: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Divisi (kosong = semua)" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} />
        <button className="bg-blue-600 text-white p-2 rounded">Generate roster</button>
      </form>
      <p className="text-sm text-gray-500">Roster menghasilkan kegiatan DRAFT — publish dari halaman Kegiatan. Presensi + rekap reuse alur biasa (rekap % mengecualikan piket).</p>
    </div>
  );
}
