'use client';
import { useEffect, useState } from 'react';
import { api, dl } from '@/lib/client';
import { Empty, Err, Pager } from '@/lib/ui';

const LIMIT = 20;

export default function AuditLogs() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const [q, setQ] = useState({ actor: '', action: '', from: '', to: '' });
  const load = (p = page) => {
    setErr('');
    const params = new URLSearchParams({ limit: `${LIMIT}`, page: `${p}` });
    if (q.actor) params.set('actor', q.actor);
    if (q.action) params.set('action', q.action);
    if (q.from) params.set('from', q.from);
    if (q.to) params.set('to', q.to);
    api<{ data: any[]; total: number }>(`audit-logs?${params}`)
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-bold">Audit Log</h1>
        <button className="bg-green-700 text-white px-2 py-1 rounded text-sm" onClick={() => {
          const params = new URLSearchParams();
          if (q.actor) params.set('actor', q.actor);
          if (q.action) params.set('action', q.action);
          if (q.from) params.set('from', q.from);
          if (q.to) params.set('to', q.to);
          const s = params.toString();
          dl(`/api/audit-logs/export.xlsx${s ? `?${s}` : ''}`, 'audit-log.xlsx').catch((e) => setErr(e.message));
        }}>Export XLSX</button>
      </div>
      <Err msg={err} />
      <div className="flex gap-2 mb-2 text-sm flex-wrap">
        <input className="border p-2 rounded" placeholder="Aktor ID" value={q.actor} onChange={(e) => setQ({ ...q, actor: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Aksi" value={q.action} onChange={(e) => setQ({ ...q, action: e.target.value })} />
        <input className="border p-2 rounded" type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} />
        <input className="border p-2 rounded" type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} />
        <button className="bg-gray-200 px-2 rounded" onClick={() => load(1)}>Terapkan</button>
      </div>
      {rows.length === 0 ? <Empty /> : (
        <table className="w-full bg-white rounded shadow text-sm">
          <thead><tr className="text-left border-b"><th className="p-2">Waktu</th><th>Aksi</th><th>Entity</th><th>Alasan</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="p-2">{new Date(a.createdAt).toLocaleString('id-ID')}</td>
                <td>{a.action}</td><td>{a.entity}/{String(a.entityId).slice(0, 8)}</td><td>{a.reason ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager page={page} total={total} limit={LIMIT} onPage={load} />
    </div>
  );
}
