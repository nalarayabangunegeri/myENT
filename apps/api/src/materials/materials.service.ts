import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgConfigService } from '../config/org-config.service';

export const isPdf = (b: Buffer) => b.length > 4 && b.toString('ascii', 0, 4) === '%PDF';

@Injectable()
export class MaterialsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: StorageService,
    private notif: NotificationsService,
    private config: OrgConfigService,
  ) {}

  async create(actorId: string, title: string, description: string, meetingId: string | undefined, file: Buffer) {
    if (!file?.length) throw new BadRequestException('File PDF wajib');
    const maxMb = await this.config.get<number>('max_material_mb');
    if (file.length > maxMb * 1024 * 1024) throw new BadRequestException(`Maksimal ${maxMb} MB`);
    if (!isPdf(file)) throw new BadRequestException('Materi harus PDF');
    const key = `materials/${randomUUID()}.pdf`;
    await this.storage.save(key, file, 'application/pdf');
    const m = await this.prisma.material.create({
      data: { title, description: description ?? '', objectKey: key, mime: 'application/pdf', size: file.length, meetingId: meetingId || null, uploaderId: actorId },
    });
    await this.audit.log({ actorId, action: 'material.upload', entity: 'Material', entityId: m.id, newValue: { title } as any });
    await this.notif.broadcast(undefined, 'material', `Materi baru: ${title}`, '');
    return m;
  }

  async list(page: number, limit: number) {
    const [total, data] = await Promise.all([
      this.prisma.material.count(),
      this.prisma.material.findMany({
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { uploader: { select: { id: true, name: true } } },
      }),
    ]);
    return { page, limit, total, data: data.map(({ objectKey, ...r }) => r) };
  }

  async fileUrl(user: any, id: string, baseUrl: string) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Tidak ditemukan');
    return { url: await this.storage.signedUrl(m.objectKey, baseUrl) };
  }

  async remove(actorId: string, isAdmin: boolean, id: string) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Tidak ditemukan');
    if (!isAdmin && m.uploaderId !== actorId) throw new ForbiddenException('Hanya pengunggah atau ADMIN');
    await this.prisma.material.delete({ where: { id } });
    await this.storage.remove(m.objectKey).catch(() => {});
    await this.audit.log({ actorId, action: 'material.delete', entity: 'Material', entityId: id, oldValue: { title: m.title } as any });
    return { ok: true };
  }
}
