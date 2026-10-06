'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

export default function Dashboard() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    api('dashboard').then(setD).catch(() => (location.href = '/login'));
  }, []);
  if (!d) return <p>Memuat…</p>;
  const cards: [string, string][] = [
    ['Anggota', `${d.activeMembers}/${d.members}`],
    ['Kegiatan', `${d.meetings}`],
    ['Tugas aktif', `${d.activeAssignments}`],
    ['Request pending', `${d.pendingRequests}`],
    ['Hadir bulan ini', d.monthAttendancePct === null ? '–' : `${d.monthAttendancePct}%`],
  ];
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {cards.map(([k, v]) => (
          <div key={k} className="bg-white p-4 rounded shadow">
            <div className="text-2xl font-bold">{v}</div>
            <div className="text-sm text-gray-500">{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
