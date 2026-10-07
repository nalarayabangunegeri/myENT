import { defineConfig } from 'prisma/config';

// Prisma 7: URL koneksi pindah ke sini (schema.prisma tak lagi memuat `url`).
// Path relatif terhadap file ini (apps/api/). CLI tetap bisa dipanggil
// dengan --schema seperti sebelumnya; config ini ditemukan otomatis.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
