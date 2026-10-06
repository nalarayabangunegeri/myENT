'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(false);
  const [need2fa, setNeed2fa] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nim, password }),
    });
    const d = await r.json();
    if (!r.ok) return setErr(d.message ?? 'Gagal login');
    if (d.twoFactorRequired) return setNeed2fa(d.pendingToken);
    if (d.mustChangePassword) return setMustChange(true);
    gate(d.user?.role);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pendingToken: need2fa, code }),
    });
    const d = await r.json();
    if (!r.ok) return setErr(d.message ?? 'Kode salah');
    if (d.mustChangePassword) {
      setNeed2fa('');
      return setMustChange(true);
    }
    gate(d.user?.role);
  }

  async function gate(role: string) {
    if (role !== 'OFFICER' && role !== 'ADMIN') {
      await fetch('/api/auth/logout', { method: 'POST' });
      return setErr('Hanya pengurus yang dapat masuk Web Admin');
    }
    router.push('/');
  }

  async function change(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const np = (document.getElementById('np') as HTMLInputElement).value;
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oldPassword: password, newPassword: np }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return setErr(d.message ?? 'Gagal');
    }
    router.push('/');
  }

  return (
    <div className="max-w-sm mx-auto mt-20 bg-white p-6 rounded shadow">
      <h1 className="text-xl font-bold mb-4">Masuk Pengurus</h1>
      {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
      {need2fa ? (
        <form onSubmit={verify} className="flex flex-col gap-2">
          <p className="text-sm">Masukkan kode 6 digit dari aplikasi authenticator.</p>
          <input className="border p-2 rounded" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="bg-blue-600 text-white p-2 rounded">Verifikasi</button>
        </form>
      ) : !mustChange ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <input className="border p-2 rounded" placeholder="NIM" value={nim} onChange={(e) => setNim(e.target.value)} />
          <input className="border p-2 rounded" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="bg-blue-600 text-white p-2 rounded">Masuk</button>
        </form>
      ) : (
        <form onSubmit={change} className="flex flex-col gap-2">
          <p className="text-sm">Password sementara harus diganti (min 10 karakter).</p>
          <input id="np" className="border p-2 rounded" type="password" placeholder="Password baru" minLength={10} />
          <button className="bg-blue-600 text-white p-2 rounded">Ganti & Masuk</button>
        </form>
      )}
    </div>
  );
}
