import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Shell from './shell';

export const metadata = { title: 'Jurnalistik Admin' };

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`min-h-screen text-gray-900 antialiased ${jakarta.className}`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
