import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgConfigService } from '../config/org-config.service';
import { detectImage } from '../attendance/attendance.rules';

@Injectable()
export class LoanService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: StorageService,
    private notif: NotificationsService,
    private config: OrgConfigService,
  ) {}

  private photoKey(itemId: string) {
    return `loans/${itemId}/${randomUUID()}.jpg`;
  }

  private async hist(itemId: string, actorId: string | null, action: string, oldValue: string, newValue: string, note = '') {
    await this.prisma.itemHistory.create({ data: { itemId, actorId, action, oldValue, newValue, note } });
  }

  private async checkPhoto(file?: Buffer) {
    if (!file?.length) throw new BadRequestException('Foto wajib');
    const maxMb = await this.config.get<number>('max_upload_mb');
    if (file.length > maxMb * 1024 * 1024) throw new BadRequestException(`Maksimal ${maxMb} MB`);
    if (!detectImage(file)) throw new BadRequestException('Foto harus JPG/PNG/WebP');
  }

  async createItem(actorId: string, name: string, code: string, category: string, condition: string) {
    try {
      const item = await this.prisma.item.create({ data: { name, code, category: category ?? '', condition: condition ?? 'Baik' } });
      await this.audit.log({ actorId, action: 'item.create', entity: 'Item', entityId: item.id, newValue: { name, code } as any });
      await this.hist(item.id, actorId, 'created', '', `${name} (${code})`);
      return item;
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Kode barang sudah dipakai');
      throw e;
    }
  }

  async updateItem(actorId: string, id: string, dto: { name?: string; category?: string; condition?: string; status?: 'AVAILABLE' | 'MAINTENANCE' }) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Tidak ditemukan');
    if (item.status === 'BORROWED') throw new BadRequestException('Barang sedang dipinjam');
    if (dto.status && !['AVAILABLE', 'MAINTENANCE'].includes(dto.status)) throw new BadRequestException('Status tidak valid');
    const updated = await this.prisma.item.update({ where: { id }, data: { ...dto } });
    await this.audit.log({ actorId, action: 'item.update', entity: 'Item', entityId: id, oldValue: { status: item.status, condition: item.condition } as any, newValue: { status: updated.status, condition: updated.condition } as any });
    if (item.condition !== updated.condition || item.status !== updated.status)
      await this.hist(id, actorId, 'updated', `${item.condition}/${item.status}`, `${updated.condition}/${updated.status}`);
    return updated;
  }

  async itemHistory(id: string, page: number, limit: number) {
    const where = { itemId: id };
    const [total, data] = await Promise.all([
      this.prisma.itemHistory.count({ where }),
      this.prisma.itemHistory.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    ]);
    return { page, limit, total, data };
  }

  async listItems(status?: string) {
    return this.prisma.item.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { name: 'asc' },
    });
  }

  async borrow(user: any, itemId: string, dueAt: Date, noteOut: string, photo: Buffer) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Barang tidak ditemukan');
    if (item.status !== 'AVAILABLE') throw new ConflictException(`Barang ${item.status === 'BORROWED' ? 'sedang dipinjam' : 'dalam perawatan'}`);
    if (!(dueAt instanceof Date) || isNaN(+dueAt) || dueAt <= new Date()) throw new BadRequestException('Tenggat harus di masa depan');
    const max = await this.config.get<number>('max_active_loans_per_member');
    const active = await this.prisma.loan.count({ where: { borrowerId: user.id, status: { in: ['ACTIVE', 'OVERDUE'] } } });
    if (active >= max) throw new BadRequestException(`Maksimal ${max} pinjaman aktif`);
    await this.checkPhoto(photo);
    const key = this.photoKey(itemId);
    await this.storage.save(key, photo, 'image/jpeg');
    try {
      const loan = await this.prisma.$transaction(async (tx: any) => {
        const l = await tx.loan.create({
          data: {
            itemId, borrowerId: user.id,
            snapName: user.name, snapNim: user.nim, snapDivision: user.division ?? '', snapCohort: user.cohortYear ?? 0,
            photoOutKey: key, noteOut: noteOut ?? '', dueAt,
          },
        });
        await tx.item.update({ where: { id: itemId }, data: { status: 'BORROWED' } });
        return l;
      });
      await this.audit.log({ actorId: user.id, action: 'loan.create', entity: 'Loan', entityId: loan.id, newValue: { itemId, dueAt } as any });
      return loan;
    } catch (e: any) {
      await this.storage.remove(key);
      // Partial unique (satu aktif per barang) + validasi di atas; P2002 = balapan.
      if (e?.code === 'P2002') throw new ConflictException('Barang baru saja dipinjam orang lain');
      throw e;
    }
  }

  async returnLoan(actorId: string, id: string, photo: Buffer, noteIn: string, damaged: boolean) {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Tidak ditemukan');
    if (!['ACTIVE', 'OVERDUE'].includes(loan.status)) throw new BadRequestException('Sudah selesai');
    await this.checkPhoto(photo);
    const key = this.photoKey(loan.itemId);
    await this.storage.save(key, photo, 'image/jpeg');
    const now = new Date();
    const out = await this.prisma.$transaction(async (tx: any) => {
      const l = await tx.loan.update({
        where: { id }, data: { status: 'RETURNED', photoInKey: key, noteIn: noteIn ?? '', returnedAt: now },
      });
      await tx.item.update({ where: { id: loan.itemId }, data: { status: damaged ? 'MAINTENANCE' : 'AVAILABLE' } });
      return l;
    });
    await this.audit.log({
      actorId, action: 'loan.return', entity: 'Loan', entityId: id,
      oldValue: { status: loan.status } as any, newValue: { status: 'RETURNED', damaged } as any,
    });
    await this.hist(loan.itemId, actorId, damaged ? 'damaged' : 'returned', loan.status, damaged ? 'MAINTENANCE' : 'AVAILABLE', noteIn);
    await this.notif.notifyUsers([loan.borrowerId], 'loan-returned', 'Pengembalian diterima', '').catch(() => {});
    return out;
  }

  async cancel(userId: string, id: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan || loan.borrowerId !== userId) throw new NotFoundException('Tidak ditemukan');
    if (loan.status !== 'ACTIVE') throw new BadRequestException('Hanya yang aktif bisa dibatalkan');
    await this.prisma.$transaction(async (tx: any) => {
      await tx.loan.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.item.update({ where: { id: loan.itemId }, data: { status: 'AVAILABLE' } });
    });
    if (loan.photoOutKey) await this.storage.remove(loan.photoOutKey);
    return { ok: true };
  }

  async myList(userId: string) {
    return this.prisma.loan.findMany({
      where: { borrowerId: userId },
      include: { item: { select: { id: true, name: true, code: true } } },
      orderBy: { borrowedAt: 'desc' },
      take: 100,
    });
  }

  async list(status?: string) {
    return this.prisma.loan.findMany({
      where: status ? { status: status as any } : {},
      include: { item: { select: { id: true, name: true, code: true } } },
      orderBy: { borrowedAt: 'desc' },
      take: 200,
    });
  }

  async photoUrl(user: any, id: string, which: string, baseUrl: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Tidak ditemukan');
    if (user.role === 'MEMBER' && loan.borrowerId !== user.id) throw new NotFoundException('Tidak ditemukan');
    const key = which === 'in' ? loan.photoInKey : loan.photoOutKey;
    if (!key || loan.photoDeletedAt) throw new GoneException('File sudah dihapus');
    return { url: await this.storage.signedUrl(key, baseUrl) };
  }

  // Overdue + reminder H-1 (dipanggil dari tick; idempotent via WHERE/flag).
  async overdueTick(now = new Date()) {
    const over = await this.prisma.loan.updateMany({
      where: { status: 'ACTIVE', dueAt: { lte: now } },
      data: { status: 'OVERDUE' },
    });
    if (over.count) {
      const rows = await this.prisma.loan.findMany({ where: { status: 'OVERDUE' }, select: { borrowerId: true } });
      await this.notif.notifyUsers([...new Set(rows.map((r) => r.borrowerId))], 'loan-overdue', 'Ada pinjaman lewat tenggat', '').catch(() => {});
    }
    const soon = new Date(now.getTime() + 24 * 86400_000);
    const due = await this.prisma.loan.findMany({
      where: { status: 'ACTIVE', dueRemindedAt: null, dueAt: { gte: now, lte: soon } },
      select: { id: true, borrowerId: true },
    });
    for (const l of due) {
      await this.notif.notifyUsers([l.borrowerId], 'loan-due', 'Pinjaman jatuh tempo besok', '').catch(() => {});
      await this.prisma.loan.update({ where: { id: l.id }, data: { dueRemindedAt: now } });
    }
    return { overdue: over.count, reminded: due.length };
  }
}
