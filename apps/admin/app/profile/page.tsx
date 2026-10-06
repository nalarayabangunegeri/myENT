'use client';
import { useState } from 'react';

export default function Profile() {
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [msg, setMsg] = useState('');

  async function ganti(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldP, newPassword: newP }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return setMsg(d.message ?? 'Gagal');
    }
    setOldP('');
    setNewP('');
    setMsg('Password diganti.');
  }

  async function keluar() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = '/login';
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold mb-4">Profil</h1>
      {msg && <p className="text-sm mb-2">{msg}</p>}
      <form onSubmit={ganti} className="bg-white p-4 rounded shadow grid gap-2 text-sm mb-4">
        <input className="border p-2 rounded" type="password" placeholder="Password lama" value={oldP} onChange={(e) => setOldP(e.target.value)} required />
        <input className="border p-2 rounded" type="password" placeholder="Password baru (min 10)" value={newP} onChange={(e) => setNewP(e.target.value)} required minLength={10} />
        <button className="bg-blue-600 text-white p-2 rounded">Ganti password</button>
      </form>
      <button className="bg-red-600 text-white px-4 py-2 rounded text-sm" onClick={() => confirm('Keluar?') && keluar()}>Keluar</button>
    </div>
  );
}
