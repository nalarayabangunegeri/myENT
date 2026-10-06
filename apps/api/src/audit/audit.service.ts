import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ponytail: tx opsional (single-instance Prisma). Upgrade path: pass tx client when inside $transaction (sudah didukung via param).
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    data: {
      actorId?: string | null;
      action: string;
      entity: string;
      entityId: string;
      oldValue?: Prisma.InputJsonValue;
      newValue?: Prisma.InputJsonValue;
      reason?: string;
    },
    tx?: any,
  ) {
    const db: any = tx ?? this.prisma;
    return db.auditLog.create({ data: { ...data } });
  }
}
