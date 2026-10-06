'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Err } from '@/lib/ui';

export default function Config() {
  const [cfg, setCfg] = useState<Record<string, any>>({});
  const [key, setKey] = useState('');
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const load = () => api<Record<string, any>>('config').then((c) => {
    setCfg(c);
    setKey((k) => k || 'retention_selfie_months');
  }).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    let v: any = val;
    try {
      v = JSON.parse(val);
    } catch {
      /* string biasa */
    }
    try {
      await api('config', { method: 'PATCH', body: JSON.stringify({ key, value: v }) });
      setVal('');
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Konfigurasi</h1>
      <Err msg={err} />
      {key === 'effective_statuses' && (
        <p className="bg-yellow-100 border border-yellow-300 p-2 rounded text-sm mb-2">
          Perubahan status efektif berlaku pada seluruh histori rekap (PRD §15.8).
        </p>
      )}
      <form onSubmit={save} className="bg-white p-4 rounded shadow mb-4 grid md:grid-cols-3 gap-2 text-sm">
        <select className="border p-2 rounded" value={key} onChange={(e) => setKey(e.target.value)}>
          {Object.keys(cfg).map((k) => <option key={k}>{k}</option>)}
        </select>
        <input className="border p-2 rounded" placeholder='Nilai (JSON, mis. 6 atau ["A"])' value={val} onChange={(e) => setVal(e.target.value)} required />
        <button className="bg-blue-600 text-white p-2 rounded">Simpan</button>
      </form>
      <pre className="bg-white p-4 rounded shadow text-xs overflow-auto">{JSON.stringify(cfg, null, 2)}</pre>
    </div>
  );
}
