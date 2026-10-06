'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

export default function Analytics() {
  const [trends, setTrends] = useState<any>({ data: [] });
  const [abs, setAbs] = useState<any[]>([]);
  const [div, setDiv] = useState<any[]>([]);
  useEffect(() => {
    api<any>('analytics/trends?months=6').then(setTrends);
    api<any[]>('analytics/frequent-absentees?limit=10').then(setAbs);
    api<any[]>('analytics/by-division').then(setDiv);
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Analitik</h1>
      <h2 className="font-bold mb-2">Tren bulanan {trends.truncated && '(terpotong)'}</h2>
      <table className="w-full bg-white rounded shadow text-sm mb-4">
        <thead><tr className="text-left border-b"><th className="p-2">Bulan</th><th>Total</th><th>Efektif</th><th>%</th></tr></thead>
        <tbody>
          {(trends.data ?? []).map((t: any) => (
            <tr key={t.month} className="border-b"><td className="p-2">{t.month}</td><td>{t.total}</td><td>{t.effective}</td><td>{t.percentage ?? '–'}</td></tr>
          ))}
        </tbody>
      </table>
      <h2 className="font-bold mb-2">Sering alpha</h2>
      <table className="w-full bg-white rounded shadow text-sm mb-4">
        <thead><tr className="text-left border-b"><th className="p-2">Nama</th><th>Alpha</th></tr></thead>
        <tbody>
          {abs.map((a: any) => (
            <tr key={a.user?.id} className="border-b"><td className="p-2">{a.user?.name} ({a.user?.nim})</td><td>{a.alphas}</td></tr>
          ))}
        </tbody>
      </table>
      <h2 className="font-bold mb-2">Per divisi</h2>
      <table className="w-full bg-white rounded shadow text-sm mb-4">
        <thead><tr className="text-left border-b"><th className="p-2">Divisi</th><th>Total</th><th>%</th></tr></thead>
        <tbody>
          {div.map((d: any) => (
            <tr key={d.division} className="border-b"><td className="p-2">{d.division}</td><td>{d.total}</td><td>{d.percentage ?? '–'}</td></tr>
          ))}
        </tbody>
      </table>
      <h2 className="font-bold mb-2">Poin keaktifan</h2>
      <Points />
    </div>
  );
}

function Points() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<any[]>('points/leaderboard').then(setRows);
  }, []);
  return (
    <table className="w-full bg-white rounded shadow text-sm">
      <thead><tr className="text-left border-b"><th className="p-2">Nama</th><th>Poin</th></tr></thead>
      <tbody>
        {rows.map((r: any) => (
          <tr key={r.user.id} className="border-b"><td className="p-2">{r.user.name}</td><td>{r.points}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
