'use client';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function Profile() {
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [msg, setMsg] = useState('');
  const [secret, setSecret] = useState('');
  const [otpUrl, setOtpUrl] = useState('');
  const [setupPw, setSetupPw] = useState('');
  const [code, setCode] = useState('');

  async function ganti(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api('auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) });
      setOldP('');
      setNewP('');
      setMsg('Password diganti.');
    } catch (e: any) {
      setMsg(e.message ?? 'Gagal');
    }
  }

  async function keluar() {
    try {
      await api('auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } catch {
      /* tetap keluar lokal */
    }
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
      <h2 className="text-lg font-bold mt-6 mb-2">2FA (aplikasi authenticator)</h2>
      {!secret ? (
        <form
          className="bg-white p-4 rounded shadow grid gap-2 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await api<{ secret: string; otpauthUrl: string }>('auth/2fa/setup', { method: 'POST', body: JSON.stringify({ password: setupPw }) });
              setSecret(r.secret);
              setOtpUrl(r.otpauthUrl);
              setMsg('');
            } catch (e: any) {
              setMsg(e.message);
            }
          }}
        >
          <input className="border p-2 rounded" type="password" placeholder="Password saat ini" aria-label="Password saat ini" value={setupPw} onChange={(e) => setSetupPw(e.target.value)} required />
          <button className="bg-gray-200 px-2 py-1 rounded text-sm">Mulai setup 2FA</button>
        </form>
      ) : (
        <div className="bg-white p-4 rounded shadow grid gap-2 text-sm">
          <p className="break-all">Secret: {secret}</p>
          <p className="break-all text-xs text-gray-500">{otpUrl}</p>
          <p>Masukkan ke aplikasi authenticator, lalu verifikasi kode 6 digit:</p>
          <input className="border p-2 rounded" placeholder="123456" aria-label="Kode 2FA" value={code} onChange={(e) => setCode(e.target.value)} />
          <button
            className="bg-blue-600 text-white p-2 rounded"
            onClick={async () => {
              try {
                await api('auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
                setMsg('2FA aktif.');
                setSecret('');
                setOtpUrl('');
                setSetupPw('');
              } catch {
                setMsg('Kode salah.');
              }
            }}
          >
            Aktifkan
          </button>
        </div>
      )}
    </div>
  );
}
