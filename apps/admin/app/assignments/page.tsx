'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Btn, Card, Empty, Err, Loading, PageHeader, Pager, StatusPill, Thead, field } from '@/lib/ui';

const LIMIT = 20;

export default function Assignments() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [first, setFirst] = useState(true);
  const [err, setErr] = useState('');
  const [subs, setSubs] = useState<any[]>([]);
  const [cur, setCur] = useState('');
  const [form, setForm] = useState({ title: '', deadline: '' });
  const load = (p = page) => api<{ data: any[]; total: number }>(`assignments?page=${p}&limit=${LIMIT}`)
    .then((r) => {
      setRows(r.data);
      setTotal(r.total);
      setPage(p);
      setFirst(false);
    })
    .catch((e) => {
      setErr(e.message);
      setFirst(false);
    });
  useEffect(() => {
    load(1);
  }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('deadline', new Date(form.deadline).toISOString());
      const f = new FormData(e.currentTarget).get('attachment') as File | null;
      if (f?.size) {
        if (f.size > 5 * 1024 * 1024) return setErr('Lampiran maksimal 5 MB');
        fd.append('attachment', f);
      }
      await api('assignments', { method: 'POST', body: fd });
      e.currentTarget.reset();
      setForm({ title: '', deadline: '' });
      load(1);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function show(id: string) {
    try {
      setCur(id);
      const r = await api<{ data: any[] }>(`assignments/${id}/submissions?limit=100`);
      setSubs(r.data);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Tugas" sub="Buat tugas dan review submission" />
      <Err msg={err} />
      <Card className="p-4">
        <form onSubmit={create} className="grid gap-2 md:grid-cols-4">
          <input className={field} placeholder="Judul" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input type="datetime-local" className={field} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required />
          <input name="attachment" type="file" className={field} />
          <Btn primary>Buat</Btn>
        </form>
      </Card>
      <Card className="p-4">
        {first ? <Loading /> : rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <Thead cols={['Judul', 'Deadline', 'Terkumpul', 'Aksi']} />
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/60 ${cur === a.id ? 'bg-brand-100/50' : ''}`}>
                    <td className="py-2.5 pr-2 font-medium">{a.title}</td>
                    <td className="py-2.5 pr-2 text-gray-500">{new Date(a.deadline).toLocaleString('id-ID')}</td>
                    <td className="py-2.5 pr-2">{a._count?.submissions ?? ''}</td>
                    <td className="py-2.5"><button className="font-medium text-brand-700 hover:text-brand-800" onClick={() => show(a.id)}>Submission</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} total={total} limit={LIMIT} onPage={load} />
      </Card>
      {subs.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Submission</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <Thead cols={['Nama', 'Status', 'Aksi']} />
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="py-2.5 pr-2 font-medium">{s.user?.name}</td>
                    <td className="py-2.5 pr-2"><StatusPill value={s.status} /></td>
                    <td className="py-2.5">{!s.reviewedAt && <button className="font-medium text-emerald-700 hover:text-emerald-900" onClick={async () => { const n = prompt('Catatan review', '') ?? ''; try { await api(`submissions/${s.id}/review`, { method: 'PATCH', body: JSON.stringify({ reviewNote: n }) }); show(cur); } catch (e: any) { setErr(e.message); } }}>Review</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
