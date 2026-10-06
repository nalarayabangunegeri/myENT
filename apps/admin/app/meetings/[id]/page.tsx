'use client';
import { use, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Empty, Err } from '@/lib/ui';

export default function MeetingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [att, setAtt] = useState<any[]>([]);
  const [reqs, setReqs] = useState<any[]>([]);
  const [kors, setKors] = useState<any[]>([]);
  const [qr, setQr] = useState('');
  const [err, setErr] = useState('');
  const [loc, setLoc] = useState({ latitude: '', longitude: '', radiusM: '' });
  const [sel, setSel] = useState<string[]>([]);
  const [adj, setAdj] = useState({ userId: '', status: 'PERMITTED', reason: '' });
  const load = () => {
    setErr('');
    // ponytail: limit 100 tanpa pagination (skala UKM). Ceiling: pager saat >100/rapat.
    api<{ data: any[] }>(`meetings/${id}/attendance?limit=100`).then((r) => setAtt(r.data)).catch((e) => setErr(e.message));
    api<{ data: any[] }>(`meetings/${id}/absence-requests?limit=100`).then((r) => setReqs(r.data)).catch((e) => setErr(e.message));
    api<{ data: any[] }>(`meetings/${id}/corrections?limit=100`).then((r) => setKors(r.data)).catch((e) => setErr(e.message));
    api<{ qr: string }>(`meetings/${id}/qr`).then((r) => setQr(r.qr)).catch(() => {});
  };
  useEffect(load, [id]);

  async function decide(rid: string, a: 'approve' | 'reject') {
    const note = prompt('Catatan (opsional)', '') ?? '';
    try {
      await api(`absence-requests/${rid}/${a}`, { method: 'PATCH', body: JSON.stringify({ reviewNote: note }) });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function bulk() {
    if (!sel.length || !confirm(`Proses ${sel.length} request?`)) return;
    try {
      const r = await api<{ results: any[] }>('absence-requests/bulk', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', ids: sel }),
      });
      const fail = r.results.filter((x: any) => x.status !== 'ok');
      if (fail.length) setErr(`${fail.length} gagal — lihat konsol`);
      console.log(r.results);
      setSel([]);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`meetings/${id}/attendance/adjust`, { method: 'POST', body: JSON.stringify(adj) });
      setAdj({ userId: '', status: 'PERMITTED', reason: '' });
      load();
    } catch (e: any) {
      setErr((e as Error).message);
    }
  }

  async function decideKor(kid: string, a: 'approve' | 'reject') {
    const note = prompt('Catatan (opsional)', '') ?? '';
    try {
      await api(`corrections/${kid}/${a}`, { method: 'PATCH', body: JSON.stringify({ reviewNote: note }) });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function saveLoc(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`meetings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          latitude: loc.latitude === '' ? null : Number(loc.latitude),
          longitude: loc.longitude === '' ? null : Number(loc.longitude),
          radiusM: loc.radiusM === '' ? null : Number(loc.radiusM),
        }),
      });
      setErr('');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Kegiatan</h1>
      <Err msg={err} />
      <div className="flex gap-4 items-start mb-4">
        {qr && <img src={qr} alt="QR presensi" className="w-32 h-32 bg-white p-1 rounded shadow" />}
        <form onSubmit={saveLoc} className="bg-white p-4 rounded shadow grid md:grid-cols-4 gap-2 text-sm">
          <input className="border p-2 rounded" placeholder="Latitude (kosong = mati)" value={loc.latitude} onChange={(e) => setLoc({ ...loc, latitude: e.target.value })} />
          <input className="border p-2 rounded" placeholder="Longitude" value={loc.longitude} onChange={(e) => setLoc({ ...loc, longitude: e.target.value })} />
          <input className="border p-2 rounded" placeholder="Radius meter" value={loc.radiusM} onChange={(e) => setLoc({ ...loc, radiusM: e.target.value })} />
          <button className="bg-blue-600 text-white p-2 rounded">Simpan lokasi</button>
        </form>
      </div>
      <h2 className="font-bold mt-4 mb-2">Request ({reqs.filter((r) => r.status === 'PENDING').length} pending)</h2>
      <button className="bg-blue-600 text-white px-2 py-1 rounded text-sm mb-2" onClick={bulk}>Approve terpilih ({sel.length})</button>
      <table className="w-full bg-white rounded shadow text-sm mb-4">
        <thead><tr className="text-left border-b"><th className="p-2">✓</th><th>Nama</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2">{r.status === 'PENDING' && <input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} />}</td>
              <td className="p-2">{r.user?.name} ({r.user?.nim})</td>
              <td>{r.reasonType} — {r.reasonDetail}</td>
              <td>{r.status}</td>
              <td>{r.status === 'PENDING' && (<><button className="text-green-700 mr-2" onClick={() => decide(r.id, 'approve')}>OK</button><button className="text-red-600" onClick={() => decide(r.id, 'reject')}>Tolak</button></>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="font-bold mt-4 mb-2">Klaim koreksi ({kors.filter((r) => r.status === 'PENDING').length} pending)</h2>
      <table className="w-full bg-white rounded shadow text-sm mb-4">
        <thead><tr className="text-left border-b"><th className="p-2">Nama</th><th>Klaim</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>
          {kors.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2">{r.user?.name}</td><td>{r.claim}</td><td>{r.status}</td>
              <td>{r.status === 'PENDING' && (<><button className="text-green-700 mr-2" onClick={() => decideKor(r.id, 'approve')}>OK</button><button className="text-red-600" onClick={() => decideKor(r.id, 'reject')}>Tolak</button></>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="font-bold mt-4 mb-2">Kehadiran ({att.length})</h2>
      <table className="w-full bg-white rounded shadow text-sm mb-4">
        <thead><tr className="text-left border-b"><th className="p-2">Nama</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>
          {att.map((a) => (
            <tr key={a.id} className="border-b"><td className="p-2">{a.user?.name}</td><td>{a.status}</td><td>{a.source}</td></tr>
          ))}
        </tbody>
      </table>
      <h2 className="font-bold mt-4 mb-2">Penyesuaian manual</h2>
      <form onSubmit={adjust} className="bg-white p-4 rounded shadow grid md:grid-cols-4 gap-2 text-sm">
        <input className="border p-2 rounded" placeholder="User ID" value={adj.userId} onChange={(e) => setAdj({ ...adj, userId: e.target.value })} required />
        <select className="border p-2 rounded" value={adj.status} onChange={(e) => setAdj({ ...adj, status: e.target.value })}>
          {['PRESENT', 'PERMITTED', 'SICK', 'DISPENSATION', 'ABSENT'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input className="border p-2 rounded" placeholder="Alasan (wajib)" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} required minLength={3} />
        <button className="bg-blue-600 text-white p-2 rounded">Sesuaikan</button>
      </form>
    </div>
  );
}
