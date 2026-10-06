import './globals.css';
import Link from 'next/link';

export const metadata = { title: 'Jurnalistik Admin' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <a href="#main" className="sr-only">Lewati ke konten</a>
        <nav className="bg-white border-b px-4 py-2 flex gap-4 text-sm" aria-label="Navigasi utama">
          <Link href="/" className="font-bold">Jurnalistik Admin</Link>
          <Link href="/meetings">Kegiatan</Link>
          <Link href="/members">Anggota</Link>
          <Link href="/recap">Rekap</Link>
          <Link href="/analytics">Analitik</Link>
          <Link href="/announcements">Pengumuman</Link>
          <Link href="/inventory">Inventaris</Link>
          <Link href="/duty">Piket</Link>
          <Link href="/materials">Materi</Link>
          <Link href="/assignments">Tugas</Link>
          <Link href="/audit-logs">Audit</Link>
          <Link href="/config">Konfigurasi</Link>
          <Link href="/profile">Profil</Link>
        </nav>
        <main id="main" className="p-4 max-w-6xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
