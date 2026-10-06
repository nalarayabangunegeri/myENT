'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Empty, Err } from '@/lib/ui';

export default function Materials() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('');
  const load = () => api<{ data: any[] }>('materials?limit=50').then((r) => setRows(r.data)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !title) return alert('Isi judul dulu');
    const fd = new FormData();
    fd.append('title', title);
    fd.append('file', f);
    await api('materials', { method: 'POST', body: fd });
    setTitle('');
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Materi</h1>
      <Err msg={err} />
      <div className="flex gap-2 mb-2 text-sm">
        <input className="border p-2 rounded" placeholder="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="bg-gray-200 px-2 rounded cursor-pointer flex items-center">Upload PDF<input type="file" accept=".pdf" className="hidden" onChange={upload} /></label>
      </div>
      {rows.length === 0 ? <Empty /> : (
      <table className="w-full bg-white rounded shadow text-sm">
        <thead><tr className="text-left border-b"><th className="p-2">Judul</th><th>Ukuran</th><th>Aksi</th></tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b">
              <td className="p-2">{m.title}</td><td>{(m.size / 1024).toFixed(0)} KB</td>
              <td className="flex gap-2">
                <a className="text-blue-600" href={`/api/materials/${m.id}/file`} target="_blank">Buka</a>
                <button className="text-red-600" onClick={() => confirm('Hapus?') && api(`materials/${m.id}`, { method: 'DELETE' }).then(load)}>Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
