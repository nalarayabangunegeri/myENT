'use client';

export function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex gap-2 items-center text-sm mt-2">
      <button className="bg-gray-200 px-2 py-1 rounded disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
      <span>Halaman {page}/{pages} ({total})</span>
      <button className="bg-gray-200 px-2 py-1 rounded disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}

export function Empty({ text = 'Belum ada data' }: { text?: string }) {
  return <p className="text-gray-500 text-sm py-4 text-center">{text}</p>;
}

export function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="text-red-600 text-sm mb-2">{msg}</p>;
}
