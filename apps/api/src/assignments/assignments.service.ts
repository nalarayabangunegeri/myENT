import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgConfigService } from '../config/org-config.service';
import { detectImage } from '../attendance/attendance.rules';
import { isPdf } from '../materials/materials.service';

// Status submission diturunkan (PRD §15.3): REVIEWED > LATE > SUBMITTED (tanpa record = NOT_SUBMITTED).
export function submissionStatus(s: { submittedAt: Date; reviewedAt: Date | null }, deadline: Date) {
  if (s.reviewedAt) return 'REVIEWED';
  return s.submittedAt > deadline ? 'LATE' : 'SUBMITTED';
}

@Injectable()
export class AssignmentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
    private notif: NotificationsService,
    private config: OrgConfigService,
  ) {}

  async create(actorId: string, title: string, description: string, meetingId: string | undefined, deadline: Date, file?: Buffer) {
    if (!(deadline instanceof Date) || isNaN(+deadline)) throw new BadRequestException('Deadline tidak valid');
    let attachmentKey: string | undefined;
    if (file?.length) {
      const maxMb = await this.config.get<number>('max_material_mb');
      if (file.length > maxMb * 1024 * 1024) throw new BadRequestException(`Maksimal ${maxMb} MB`);
      if (!isPdf(file) && !detectImage(file)) throw new BadRequestException('Lampiran harus PDF/foto');
      attachmentKey = `assignments/${randomUUID()}`;
      await this.storage.save(attachmentKey, file, isPdf(file) ? 'application/pdf' : 'image/jpeg');
    }
    const a = await this.prisma.assignment.create({
      data: { title, description: description ?? '', meetingId: meetingId || null, deadline, attachmentKey, creatorId: actorId },
    });
    await this.notif.broadcast(undefined, 'assignment', `Tugas baru: ${title}`, '');
    return a;
  }

  async list(page: number, limit: number) {
    const [total, data] = await Promise.all([
      this.prisma.assignment.count(),
      this.prisma.assignment.findMany({
        skip: (page - 1) * limit, take: limit, orderBy: { deadline: 'asc' },
        include: { creator: { select: { id: true, name: true } }, _count: { select: { submissions: true } } },
      }),
    ]);
    return { page, limit, total, data };
  }

  async submit(userId: string, assignmentId: string, file: Buffer) {
    const a = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!a) throw new NotFoundException('Tugas tidak ditemukan');
    if (!file?.length) throw new BadRequestException('File wajib');
    const maxMb = await this.config.get<number>('max_upload_mb');
    if (file.length > maxMb * 1024 * 1024) throw new BadRequestException(`Maksimal ${maxMb} MB`);
    if (!isPdf(file) && !detectImage(file)) throw new BadRequestException('File harus PDF/foto');
    const key = `submissions/${assignmentId}/${userId}/${randomUUID()}`;
    await this.storage.save(key, file, isPdf(file) ? 'application/pdf' : 'image/jpeg');
    const now = new Date();
    const prev = await this.prisma.submission.findUnique({ where: { assignmentId_userId: { assignmentId, userId } } });
    const out = await this.prisma.submission.upsert({
      where: { assignmentId_userId: { assignmentId, userId } },
      create: { assignmentId, userId, objectKey: key, submittedAt: now },
      update: { objectKey: key, submittedAt: now, reviewedAt: null, reviewNote: '' },
    });
    if (prev && prev.objectKey !== key) await this.storage.remove(prev.objectKey).catch(() => {});
    // Kumpul ulang setelah review = review hangus; catat agar tak hilang diam-diam.
    if (prev?.reviewedAt)
      await this.audit.log({
        actorId: userId, action: 'submission.resubmit', entity: 'Submission', entityId: out.id,
        oldValue: { reviewedAt: prev.reviewedAt } as any, newValue: { submittedAt: now } as any,
      }).catch(() => {});
    return out;
  }

  async myList(userId: string, page: number, limit: number) {
    const [total, subs] = await Promise.all([
      this.prisma.submission.count({ where: { userId } }),
      this.prisma.submission.findMany({
        where: { userId }, skip: (page - 1) * limit, take: limit, orderBy: { submittedAt: 'desc' },
        include: { assignment: { select: { id: true, title: true, deadline: true } } },
      }),
    ]);
    return {
      page, limit, total,
      data: subs.map((s) => ({ ...s, status: submissionStatus(s, s.assignment.deadline) })),
    };
  }

  async listSubmissions(assignmentId: string, page: number, limit: number) {
    const where = { assignmentId };
    const [total, subs] = await Promise.all([
      this.prisma.submission.count({ where }),
      this.prisma.submission.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { submittedAt: 'asc' },
        include: {
          user: { select: { id: true, nim: true, name: true } },
          assignment: { select: { deadline: true } },
        },
      }),
    ]);
    return {
      page, limit, total,
      data: subs.map((s) => ({ ...s, status: submissionStatus(s, s.assignment.deadline) })),
    };
  }

  async review(id: string, reviewNote: string) {
    const s = await this.prisma.submission.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Tidak ditemukan');
    return this.prisma.submission.update({ where: { id }, data: { reviewedAt: new Date(), reviewNote: reviewNote ?? '' } });
  }

  async fileUrl(user: any, submissionId: string, baseUrl: string) {
    const s = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!s) throw new NotFoundException('Tidak ditemukan');
    if (user.role === 'MEMBER' && s.userId !== user.id) throw new NotFoundException('Tidak ditemukan');
    if (s.fileDeletedAt) throw new GoneException('File sudah dihapus');
    return { url: await this.storage.signedUrl(s.objectKey, baseUrl) };
  }
}
