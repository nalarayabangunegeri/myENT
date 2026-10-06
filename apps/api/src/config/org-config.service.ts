import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Konfigurasi organisasi PRD §15.8. Default = kebijakan saat ini; P1 dapat diubah tanpa deploy.
// ponytail: cache in-memory (single instance). Upgrade: TTL/evict saat multi-instance.
export const CONFIG_DEFAULTS: Record<string, any> = {
  effective_statuses: ['PRESENT', 'PERMITTED', 'SICK', 'DISPENSATION'],
  approval_mapping: {
    SICK: 'SICK', ACADEMIC: 'PERMITTED', BEREAVEMENT: 'PERMITTED',
    ORGANIZATION: 'PERMITTED', DISPENSATION: 'DISPENSATION', OTHER: 'PERMITTED',
  },
  attachment_required: {},
  retention_selfie_months: Number(process.env.RETENTION_SELFIE_MONTHS ?? 12),
  retention_attachment_months: Number(process.env.RETENTION_ATTACHMENT_MONTHS ?? 6),
  retention_submission_months: 12,
  retention_notif_days: 90,
  max_upload_mb: 5,
  max_material_mb: 10,
  // Backlog §22.3 (null = nonaktif).
  absence_quota_per_semester: null as number | null,
  attendance_threshold_pct: null as number | null,
  max_active_loans_per_member: 2,
};

@Injectable()
export class OrgConfigService {
  private cache = new Map<string, any>();
  constructor(private prisma: PrismaService) {}

  async get<T>(key: string): Promise<T> {
    if (this.cache.has(key)) return this.cache.get(key);
    const row = await this.prisma.orgConfig.findUnique({ where: { key } }).catch(() => null);
    const v = (row?.value ?? CONFIG_DEFAULTS[key]) as T;
    this.cache.set(key, v);
    return v;
  }

  async set(key: string, value: any) {
    if (!(key in CONFIG_DEFAULTS)) throw new Error('Kunci konfigurasi tidak dikenal');
    if (key === 'max_upload_mb' || key === 'max_material_mb') {
      if (typeof value !== 'number' || !(value >= 1 && value <= 20)) throw new Error('max_*_mb harus angka 1–20');
    }
    if (key === 'max_active_loans_per_member' && (typeof value !== 'number' || !(value >= 1 && value <= 10)))
      throw new Error('max_active_loans_per_member harus angka 1–10');
    await this.prisma.orgConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
    this.cache.set(key, value);
    return { key, value };
  }

  async all() {
    const rows = await this.prisma.orgConfig.findMany();
    const out: Record<string, any> = { ...CONFIG_DEFAULTS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  }
}
