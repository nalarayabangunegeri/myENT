'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Btn, Card, Empty, Err, PageHeader, Thead, field } from '@/lib/ui';

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
    e.target.value = '';
    if (!f || !title) return setErr('Isi judul dulu');
    if (f.size > 10 * 1024 * 1024) return setErr('PDF maksimal 10 MB');
    if (f.type !== 'application/pdf') return setErr('Materi harus PDF');
    const fd = new FormData();
    fd.append('title', title);
    fd.append('file', f);
    try {
      await api('materials', { method: 'POST', body: fd });
      setTitle('');
      load();
    } catch (er: any) {
      setErr(er.message);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Materi"
        sub="Arsip materi PDF untuk anggota"
        actions={<label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-800">Upload PDF<input type="file" accept=".pdf" className="hidden" onChange={upload} /></label>}
      />
      <Err msg={err} />
      <Card className="p-4">
        <input className={`${field} w-full sm:max-w-md`} placeholder="Judul materi (isi dulu sebelum upload)" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Card>
      <Card className="p-4">
        {rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <Thead cols={['Judul', 'Ukuran', 'Aksi']} />
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="py-2.5 pr-2 font-medium">{m.title}</td>
                    <td className="py-2.5 pr-2 text-gray-500">{(m.size / 1024).toFixed(0)} KB</td>
                    <td className="py-2.5">
                      <span className="flex gap-3">
                        <a className="font-medium text-brand-700 hover:text-brand-800" href={`/api/materials/${m.id}/file`} target="_blank">Buka</a>
                        <button className="font-medium text-rose-600 hover:text-rose-800" onClick={async () => { if (!confirm('Hapus?')) return; try { await api(`materials/${m.id}`, { method: 'DELETE' }); load(); } catch (er: any) { setErr(er.message); } }}>Hapus</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
