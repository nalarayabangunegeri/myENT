import './globals.css';

export const metadata = { title: 'Jurnalistik Admin' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-white border-b px-4 py-2 flex gap-4 text-sm">
          <a href="/" className="font-bold">Jurnalistik Admin</a>
          <a href="/meetings">Kegiatan</a>
          <a href="/members">Anggota</a>
          <a href="/recap">Rekap</a>
          <a href="/analytics">Analitik</a>
          <a href="/announcements">Pengumuman</a>
          <a href="/inventory">Inventaris</a>
          <a href="/duty">Piket</a>
          <a href="/materials">Materi</a>
          <a href="/assignments">Tugas</a>
          <a href="/audit-logs">Audit</a>
          <a href="/config">Konfigurasi</a>
          <a href="/profile">Profil</a>
        </nav>
        <main className="p-4 max-w-6xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
