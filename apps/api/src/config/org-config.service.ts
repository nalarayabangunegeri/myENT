import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Konfigurasi organisasi PRD §15.8. Default = kebijakan saat ini; P1 dapat diubah tanpa deploy.
// ponytail: cache in-memory (single instance). Upgrade: TTL/evict saat multi-instance.
const EFFECTIVE_ALLOWED = ['PRESENT', 'PERMITTED', 'SICK', 'DISPENSATION'];
const APPROVAL_VALUES = ['SICK', 'PERMITTED', 'DISPENSATION'];
const ABSENCE_REASONS = ['SICK', 'ACADEMIC', 'BEREAVEMENT', 'ORGANIZATION', 'DISPENSATION', 'OTHER'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertEffectiveStatuses(v: unknown) {
  if (!Array.isArray(v) || v.length === 0) throw new Error('effective_statuses harus array non-kosong');
  for (const s of v) {
    if (typeof s !== 'string' || !EFFECTIVE_ALLOWED.includes(s))
      throw new Error('effective_statuses hanya boleh PRESENT/PERMITTED/SICK/DISPENSATION (ABSENT dilarang)');
  }
  if (new Set(v).size !== v.length) throw new Error('effective_statuses tidak boleh duplikat');
}

function assertApprovalMapping(v: unknown) {
  if (!isPlainObject(v)) throw new Error('approval_mapping harus object');
  for (const [k, val] of Object.entries(v)) {
    if (!ABSENCE_REASONS.includes(k)) throw new Error(`approval_mapping key tidak dikenal: ${k}`);
    if (typeof val !== 'string' || !APPROVAL_VALUES.includes(val))
      throw new Error('approval_mapping value hanya boleh SICK/PERMITTED/DISPENSATION');
  }
}

function assertAttachmentRequired(v: unknown) {
  if (!isPlainObject(v)) throw new Error('attachment_required harus object');
  for (const [k, val] of Object.entries(v)) {
    if (!ABSENCE_REASONS.includes(k)) throw new Error(`attachment_required key tidak dikenal: ${k}`);
    if (typeof val !== 'boolean') throw new Error('attachment_required value harus boolean');
  }
}

function assertIntRange(v: unknown, name: string, min: number, max: number) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new Error(`${name} harus integer ${min}–${max}`);
}
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
  // P2-01: klaim correction hanya dalam N hari setelah window tutup.
  correction_window_days: 3,
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
    if (key === 'effective_statuses') assertEffectiveStatuses(value);
    if (key === 'approval_mapping') assertApprovalMapping(value);
    if (key === 'attachment_required') assertAttachmentRequired(value);
    if (key === 'retention_selfie_months') assertIntRange(value, key, 1, 36);
    if (key === 'retention_attachment_months') assertIntRange(value, key, 1, 24);
    if (key === 'retention_submission_months') assertIntRange(value, key, 1, 36);
    if (key === 'retention_notif_days') assertIntRange(value, key, 7, 365);
    if (key === 'correction_window_days') assertIntRange(value, key, 1, 14);
    if (key === 'absence_quota_per_semester') {
      if (value !== null) assertIntRange(value, key, 1, 20);
    }
    if (key === 'attendance_threshold_pct') {
      if (value !== null && (typeof value !== 'number' || value < 0 || value > 100))
        throw new Error('attendance_threshold_pct harus null atau angka 0–100');
    }
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
