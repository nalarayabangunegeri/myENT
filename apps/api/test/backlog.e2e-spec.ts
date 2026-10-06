import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

// E2E modul baru: duty, loans, corrections, analytics, points, config, scope divisi.
// Butuh DATABASE_URL (postgres). Overdue time-based tidak diuji di sini (ter-smoke manual).
describe('backlog modules (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminT: string;
  let offFoto: string;
  let memFoto: string;
  let memTulis: string;
  let div: string;
  const uniq = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const jpg = () =>
    sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer();

  async function mkUser(nim: string, role: string, division: string, pass = 'MemberPass123!') {
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminT}`)
      .send({ nim, name: `E2E ${nim}`, password: pass, role, division })
      .expect(201);
    const r = await request(app.getHttpServer()).post('/auth/login').send({ nim, password: pass }).expect(200);
    return r.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.MEETING_TICK_MS = '3600000';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const nim = `ad${uniq()}`;
    await prisma.user.create({
      data: { nim, name: 'E2E Admin', passwordHash: await bcrypt.hash('AdminPass123!', 10), role: 'ADMIN' },
    });
    adminT = (await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'AdminPass123!' })).body.accessToken;
    div = `D${Date.now() % 100000}`;
    offFoto = await mkUser(`of${uniq()}`, 'OFFICER', div);
    memFoto = await mkUser(`mf${uniq()}`, 'MEMBER', div);
    memTulis = await mkUser(`mt${uniq()}`, 'MEMBER', 'Tulis');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('duty roster + summary', async () => {
    const start = new Date().toISOString();
    const r = await request(app.getHttpServer())
      .post('/duty/roster')
      .set('Authorization', `Bearer ${offFoto}`)
      .send({ startDate: start, days: 2, division: div })
      .expect(201);
    expect(r.body.meetings).toBe(2);
    const mine = await request(app.getHttpServer()).get('/duty/assignments/me').set('Authorization', `Bearer ${memFoto}`).expect(200);
    expect(mine.body.length).toBeGreaterThanOrEqual(1);
    const sum = await request(app.getHttpServer()).get('/duty/summary/me').set('Authorization', `Bearer ${memFoto}`).expect(200);
    expect(sum.body).toEqual({ scheduled: 0, attended: 0 }); // belum finalized
  });

  it('loans: pinjam, ganda 409, kembali, kuota', async () => {
    const srv = request(app.getHttpServer());
    const ids: string[] = [];
    for (const code of ['A', 'B', 'C']) {
      const it = await srv.post('/items').set('Authorization', `Bearer ${offFoto}`).send({ name: `Item ${code}`, code: `E${Date.now() % 100000}${code}` }).expect(201);
      ids.push(it.body.id);
    }
    const buf = await jpg();
    const due = new Date(Date.now() + 86400000).toISOString();
    for (const id of ids.slice(0, 2)) {
      await srv.post('/loans').set('Authorization', `Bearer ${memFoto}`).field('itemId', id).field('dueAt', due).attach('photo', buf, 'p.jpg').expect(201);
    }
    // pinjam ganda atas barang sama → 409; barang ketiga → 400 kuota (default 2)
    await srv.post('/loans').set('Authorization', `Bearer ${memTulis}`).field('itemId', ids[0]).field('dueAt', due).attach('photo', buf, 'p.jpg').expect(409);
    await srv.post('/loans').set('Authorization', `Bearer ${memFoto}`).field('itemId', ids[2]).field('dueAt', due).attach('photo', buf, 'p.jpg').expect(400);
    const mine = await srv.get('/loans/me').set('Authorization', `Bearer ${memFoto}`).expect(200);
    const back = await srv.post(`/loans/${mine.body.data[0].id}/return`).set('Authorization', `Bearer ${offFoto}`).field('noteIn', 'ok').field('damaged', 'false').attach('photo', buf, 'p.jpg').expect(201);
    expect(back.body.status).toBe('RETURNED');
  });

  it('corrections: klaim, duplikat 409, approve → PRESENT', async () => {
    const srv = request(app.getHttpServer());
    const past = new Date(Date.now() - 7200000).toISOString();
    const pastEnd = new Date(Date.now() - 3600000).toISOString();
    const m = await srv
      .post('/meetings')
      .set('Authorization', `Bearer ${offFoto}`)
      .send({ title: 'E2E Tutup', status: 'PUBLISHED', startAt: past, endAt: pastEnd, attendanceOpenAt: past, attendanceCloseAt: pastEnd })
      .expect(201);
    const k = await srv.post(`/meetings/${m.body.id}/corrections`).set('Authorization', `Bearer ${memFoto}`).send({ claim: 'Sebenarnya saya hadir kemarin' }).expect(201);
    await srv.post(`/meetings/${m.body.id}/corrections`).set('Authorization', `Bearer ${memFoto}`).send({ claim: 'Kedua kalinya klaim' }).expect(409);
    await srv.patch(`/corrections/${k.body.id}/approve`).set('Authorization', `Bearer ${offFoto}`).send({ reviewNote: 'ok' }).expect(200);
    const att = await srv.get(`/meetings/${m.body.id}/attendance/me`).set('Authorization', `Bearer ${memFoto}`).expect(200);
    expect([att.body.status, att.body.source]).toEqual(['PRESENT', 'MANUAL']);
  });

  it('scope divisi: officer lintas divisi ditolak', async () => {
    const srv = request(app.getHttpServer());
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 3600000).toISOString();
    const m = await srv
      .post('/meetings')
      .set('Authorization', `Bearer ${offFoto}`)
      .send({ title: 'E2E Scope', status: 'PUBLISHED', startAt: now, endAt: later, attendanceOpenAt: now, attendanceCloseAt: later })
      .expect(201);
    const r = await srv.post(`/meetings/${m.body.id}/absence-requests`).set('Authorization', `Bearer ${memTulis}`).field('reasonType', 'SICK').expect(201);
    await srv.patch(`/absence-requests/${r.body.id}/approve`).set('Authorization', `Bearer ${offFoto}`).send({}).expect(403);
  });

  it('analytics + points + config', async () => {
    const srv = request(app.getHttpServer());
    await srv.get('/analytics/trends?months=3').set('Authorization', `Bearer ${offFoto}`).expect(200);
    await srv.get('/analytics/by-division').set('Authorization', `Bearer ${offFoto}`).expect(200);
    await srv.get('/analytics/frequent-absentees?limit=3').set('Authorization', `Bearer ${offFoto}`).expect(200);
    await srv.get('/analytics/trends').set('Authorization', `Bearer ${memFoto}`).expect(403);
    const pts = await srv.get('/points/me').set('Authorization', `Bearer ${memFoto}`).expect(200);
    expect(pts.body).toEqual(expect.objectContaining({ points: expect.any(Number), streak: expect.any(Number), badges: expect.any(Array) }));
    await srv.get('/config').set('Authorization', `Bearer ${offFoto}`).expect(403);
    const cfg = await srv.get('/config').set('Authorization', `Bearer ${adminT}`).expect(200);
    expect(cfg.body).toEqual(expect.objectContaining({ max_active_loans_per_member: 2 }));
  });
});
