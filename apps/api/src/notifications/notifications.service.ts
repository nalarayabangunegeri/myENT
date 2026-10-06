import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Notifikasi in-app adalah sumber kebenaran; push FCM hanya pengantar best-effort (PRD §15.4).
@Injectable()
export class NotificationsService {
  private fcmOn = false;
  constructor(private prisma: PrismaService) {}

  async notifyUsers(userIds: string[], type: string, title: string, body = '', ref?: { refType: string; refId: string }) {
    if (!userIds.length) return { count: 0 };
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type, title, body, ...ref })),
    });
    this.push(userIds, title, body).catch(() => {});
    return { count: userIds.length };
  }

  async broadcast(division: string | undefined, type: string, title: string, body = '') {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', ...(division ? { division } : {}) },
      select: { id: true },
    });
    return this.notifyUsers(users.map((u) => u.id), type, title, body);
  }

  async inbox(userId: string, page: number, limit: number, unreadOnly?: boolean) {
    const where: any = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [total, unread, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.notification.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { page, limit, total, unread, data };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('Tidak ditemukan');
    return this.prisma.notification.update({ where: { id }, data: { readAt: n.readAt ?? new Date() } });
  }

  async registerDevice(userId: string, token: string) {
    await this.prisma.device.upsert({
      where: { token }, create: { userId, token }, update: { userId },
    });
    return { ok: true };
  }

  async unregisterDevice(userId: string, token: string) {
    await this.prisma.device.deleteMany({ where: { userId, token } });
    return { ok: true };
  }

  private async push(userIds: string[], title: string, body: string) {
    if (!process.env.FCM_PROJECT_ID || !process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
    const devices = await this.prisma.device.findMany({ where: { userId: { in: userIds } }, select: { token: true } });
    if (!devices.length) return;
    // Lazy agar boot tak gagal tanpa kredensial.
    const mod: any = await import('firebase-admin').catch(() => null);
    const admin = mod?.default ?? mod;
    if (!admin?.messaging) return;
    try {
      if (!this.fcmOn) {
        admin.initializeApp({ projectId: process.env.FCM_PROJECT_ID });
        this.fcmOn = true;
      }
      await admin.messaging().sendEachForMulticast({
        tokens: devices.map((d) => d.token),
        notification: { title, body: body.slice(0, 200) },
      });
    } catch {
      /* push gagal ≠ notifikasi hilang */
    }
  }
}
