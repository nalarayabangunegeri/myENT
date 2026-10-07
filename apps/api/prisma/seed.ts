import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const nim = process.env.SEED_ADMIN_NIM ?? 'admin001';
    const pass = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe12345!';
    if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD)
      throw new Error('SEED_ADMIN_PASSWORD wajib di production');
    const name = process.env.SEED_ADMIN_NAME ?? 'Admin';
    const existing = await prisma.user.findUnique({ where: { nim } });
    if (!existing) {
      await prisma.user.create({
        data: {
          nim,
          name,
          passwordHash: await bcrypt.hash(pass, 10),
          role: 'ADMIN',
          status: 'ACTIVE',
          mustChangePassword: true,
        },
      });
      console.log(`seed admin ${nim} ok`);
    } else {
      console.log(`seed admin ${nim} exists, skip`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
main();
