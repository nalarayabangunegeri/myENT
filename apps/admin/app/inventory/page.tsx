'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Empty, Err } from '@/lib/ui';

export default function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', code: '', category: '' });
  const [filter, setFilter] = useState('');
  const [ret, setRet] = useState<{ id: string; damaged: boolean; note: string } | null>(null);
  const [hist, setHist] = useState<any[]>([]);
  const load = () => {
    api<any[]>('items').then(setItems).catch((e) => setErr(e.message));
    api<any[]>(`loans${filter ? `?status=${filter}` : ''}`).then(setLoans).catch((e) => setErr(e.message));
  };
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('items', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', code: '', category: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function doReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!ret) return;
    const f = (document.getElementById('retphoto') as HTMLInputElement).files?.[0];
    if (!f) return setErr('Foto akhir wajib');
    const fd = new FormData();
    fd.append('photo', f);
    fd.append('noteIn', ret.note);
    fd.append('damaged', ret.damaged ? 'true' : 'false');
    try {
      await api(`loans/${ret.id}/return`, { method: 'POST', body: fd });
      setRet(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Inventaris</h1>
      <Err msg={err} />
      <form onSubmit={add} className="bg-white p-4 rounded shadow mb-4 grid md:grid-cols-4 gap-2 text-sm">
        <input className="border p-2 rounded" placeholder="Nama (Kamera A)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="border p-2 rounded" placeholder="Kode (CAM-01)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <input className="border p-2 rounded" placeholder="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <button className="bg-blue-600 text-white p-2 rounded">Tambah</button>
      </form>
      {items.length === 0 ? <Empty /> : (
        <table className="w-full bg-white rounded shadow text-sm mb-4">
          <thead><tr className="text-left border-b"><th className="p-2">Kode</th><th>Nama</th><th>Kondisi</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b"><td className="p-2">{it.code}</td><td>{it.name}</td><td>{it.condition}</td><td>{it.status}</td><td><button className="text-blue-600" onClick={async () => { const r = await api<{ data: any[] }>(`items/${it.id}/history?limit=20`); setHist(r.data); }}>Riwayat</button></td></tr>
            ))}
          </tbody>
        </table>
      )}
      {hist.length > 0 && (
        <table className="w-full bg-white rounded shadow text-sm mb-4">
          <thead><tr className="text-left border-b"><th className="p-2">Waktu</th><th>Aksi</th><th>Sebelum</th><th>Sesudah</th><th>Catatan</th></tr></thead>
          <tbody>
            {hist.map((h: any) => (
              <tr key={h.id} className="border-b"><td className="p-2">{new Date(h.createdAt).toLocaleString('id-ID')}</td><td>{h.action}</td><td>{h.oldValue}</td><td>{h.newValue}</td><td>{h.note}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex gap-2 mb-2 text-sm">
        <h2 className="font-bold">Pinjaman</h2>
        <select className="border p-1 rounded" value={filter} onChange={(e) => { setFilter(e.target.value); }}>
          <option value="">Semua</option><option>ACTIVE</option><option>OVERDUE</option><option>RETURNED</option>
        </select>
        <button className="bg-gray-200 px-2 rounded" onClick={load}>Muat</button>
      </div>
      {ret && (
        <form onSubmit={doReturn} className="bg-white p-4 rounded shadow my-2 grid md:grid-cols-4 gap-2 text-sm">
          <span className="text-sm">{ret.damaged ? 'Tandai RUSAK' : 'Terima kembali'}</span>
          <input id="retphoto" type="file" accept="image/*" className="border p-2 rounded" />
          <input className="border p-2 rounded" placeholder="Catatan kondisi" value={ret.note} onChange={(e) => setRet({ ...ret, note: e.target.value })} />
          <div className="flex gap-1">
            <button className="bg-blue-600 text-white px-2 rounded">Kirim</button>
            <button type="button" className="bg-gray-200 px-2 rounded" onClick={() => setRet(null)}>Batal</button>
          </div>
        </form>
      )}
      {loans.length === 0 ? <Empty text="Belum ada pinjaman" /> : (
        <table className="w-full bg-white rounded shadow text-sm">
          <thead><tr className="text-left border-b"><th className="p-2">Barang</th><th>Peminjam</th><th>Tenggat</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="p-2">{l.item?.code}</td>
                <td>{l.snapName} ({l.snapNim})</td>
                <td>{new Date(l.dueAt).toLocaleDateString('id-ID')}</td>
                <td>{l.status}</td>
                <td className="flex gap-1">
                  {['ACTIVE', 'OVERDUE'].includes(l.status) && (<>
                    <button className="text-green-700" onClick={() => setRet({ id: l.id, damaged: false, note: '' })}>Terima</button>
                    <button className="text-red-600" onClick={() => setRet({ id: l.id, damaged: true, note: '' })}>Rusak</button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
