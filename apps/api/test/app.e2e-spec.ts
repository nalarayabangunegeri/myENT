import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

// Irisan vertikal MVP: login → user → meeting → presensi → request → approve → rekap.
// Butuh DATABASE_URL (postgres). Dijalankan di CI + lokal via pg ephemeral.
describe('vertical slice (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminT: string;
  let memberT: string;
  let meetingId: string;

  const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    process.env.MEETING_TICK_MS = '3600000';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const nim = `adm${uniq()}`;
    await prisma.user.create({
      data: { nim, name: 'E2E Admin', passwordHash: await bcrypt.hash('AdminPass123!', 10), role: 'ADMIN' },
    });
    adminT = (
      await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'AdminPass123!' })
    ).body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('member dibuat + login', async () => {
    const nim = `m${uniq()}`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminT}`)
      .send({ nim, name: 'E2E Member', password: 'MemberPass123!' })
      .expect(201);
    const r = await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'MemberPass123!' }).expect(200);
    memberT = r.body.accessToken;
    expect(r.body.mustChangePassword).toBe(false);
    // PRD §17: consent privasi wajib sebelum selfie pertama.
    await request(app.getHttpServer()).post('/auth/privacy-consent').set('Authorization', `Bearer ${memberT}`).expect(200);
  });

  it('meeting dibuat + publish + terlihat member', async () => {
    const now = Date.now();
    const m = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${adminT}`)
      .send({
        title: 'E2E Rapat',
        startAt: new Date(now - 3600_1000).toISOString(),
        endAt: new Date(now + 3600_1000).toISOString(),
        attendanceOpenAt: new Date(now - 3600_1000).toISOString(),
        attendanceCloseAt: new Date(now + 3600_1000).toISOString(),
        status: 'PUBLISHED',
      })
      .expect(201);
    meetingId = m.body.id;
    const list = await request(app.getHttpServer()).get('/meetings').set('Authorization', `Bearer ${memberT}`).expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
  });

  it('presensi + duplikat 409 + attendance/me', async () => {
    const jpg = await sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
    await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/attendance`)
      .set('Authorization', `Bearer ${memberT}`)
      .attach('selfie', jpg, 's.jpg')
      .expect(201);
    await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/attendance`)
      .set('Authorization', `Bearer ${memberT}`)
      .attach('selfie', jpg, 's.jpg')
      .expect(409);
    const me = await request(app.getHttpServer())
      .get(`/meetings/${meetingId}/attendance/me`)
      .set('Authorization', `Bearer ${memberT}`)
      .expect(200);
    expect(me.body.status).toBe('PRESENT');
  });

  it('tanpa consent → 403 PRIVACY_CONSENT_REQUIRED; setelah consent → bisa presensi', async () => {
    const nim = `p${uniq()}`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminT}`)
      .send({ nim, name: 'E2E Consent', password: 'ConsentPass123!' })
      .expect(201);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'ConsentPass123!' }).expect(200);
    const t = login.body.accessToken;
    const jpg = await sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer();
    const denied = await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/attendance`)
      .set('Authorization', `Bearer ${t}`)
      .attach('selfie', jpg, 's.jpg')
      .expect(403);
    expect(denied.body.message).toMatch(/PRIVACY_CONSENT_REQUIRED/);
    await request(app.getHttpServer()).post('/auth/privacy-consent').set('Authorization', `Bearer ${t}`).expect(200);
    await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/attendance`)
      .set('Authorization', `Bearer ${t}`)
      .attach('selfie', jpg, 's.jpg')
      .expect(201);
  });

  it('lockout setelah gagal berulang, pulih setelah dibuka', async () => {
    process.env.LOGIN_MAX_ATTEMPTS = '2';
    const nim = `k${uniq()}`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminT}`)
      .send({ nim, name: 'E2E Kunci', password: 'KunciPass123!' })
      .expect(201);
    const bad = { nim, password: 'salah-salah' };
    await request(app.getHttpServer()).post('/auth/login').send(bad).expect(401);
    await request(app.getHttpServer()).post('/auth/login').send(bad).expect(401);
    const locked = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ nim, password: 'KunciPass123!' })
      .expect(401);
    expect(locked.body.message).toMatch(/terkunci/);
    const u = await prisma.user.findUniqueOrThrow({ where: { nim } });
    await prisma.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null } });
    await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'KunciPass123!' }).expect(200);
    delete process.env.LOGIN_MAX_ATTEMPTS;
  });

  it('2FA: setup, enable, login dua langkah', async () => {
    const { totp } = await import('../src/auth/totp');
    const nim = `t${uniq()}`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminT}`)
      .send({ nim, name: 'E2E 2FA', password: 'TotpPass123!' })
      .expect(201);
    let r = await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'TotpPass123!' }).expect(200);
    const t0 = r.body.accessToken;
    const setup = await request(app.getHttpServer()).post('/auth/2fa/setup').set('Authorization', `Bearer ${t0}`).send({ password: 'TotpPass123!' }).expect(201);
    expect(setup.body.secret).toBeDefined();
    await request(app.getHttpServer()).post('/auth/2fa/enable').set('Authorization', `Bearer ${t0}`).send({ code: '000000' }).expect(401);
    await request(app.getHttpServer())
      .post('/auth/2fa/enable')
      .set('Authorization', `Bearer ${t0}`)
      .send({ code: String(totp(setup.body.secret)).padStart(6, '0') })
      .expect(201);
    r = await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'TotpPass123!' }).expect(200);
    expect(r.body.twoFactorRequired).toBe(true);
    await request(app.getHttpServer()).post('/auth/2fa/verify').send({ pendingToken: r.body.pendingToken, code: '000000' }).expect(401);
    const ok = await request(app.getHttpServer())
      .post('/auth/2fa/verify')
      .send({ pendingToken: r.body.pendingToken, code: String(totp(setup.body.secret)).padStart(6, '0') })
      .expect(200);
    expect(ok.body.accessToken).toBeDefined();
  });

  it('refresh reuse ditolak (rotasi atomik)', async () => {
    const nim = `r${uniq()}`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminT}`)
      .send({ nim, name: 'E2E Refresh', password: 'RefreshPass123!' })
      .expect(201);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'RefreshPass123!' }).expect(200);
    const r1 = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(200);
    expect(r1.body.accessToken).toBeDefined();
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(401);
  });

  it('request setelah PRESENT ditolak; rekap 0 sebelum finalized', async () => {
    await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/absence-requests`)
      .set('Authorization', `Bearer ${memberT}`)
      .field('reasonType', 'SICK')
      .expect(409);
    const recap = await request(app.getHttpServer()).get('/attendance/recap/me').set('Authorization', `Bearer ${memberT}`).expect(200);
    expect(recap.body.counted).toBe(0); // belum finalized
  });

  it('reject request jalan (bug actor string)', async () => {
    const nim = `j${uniq()}`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminT}`)
      .send({ nim, name: 'E2E Reject', password: 'RejectPass123!' })
      .expect(201);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ nim, password: 'RejectPass123!' }).expect(200);
    const req = await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/absence-requests`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .field('reasonType', 'SICK')
      .expect(201);
    const rej = await request(app.getHttpServer())
      .patch(`/absence-requests/${req.body.id}/reject`)
      .set('Authorization', `Bearer ${adminT}`)
      .send({ reviewNote: 'e2e' })
      .expect(200);
    expect(rej.body.status).toBe('REJECTED');
  });
});
