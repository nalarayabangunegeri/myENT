import { Injectable } from '@nestjs/common';
import { OrgConfigService } from '../config/org-config.service';
import { percentage } from '../absence/absence.rules';

// Single source of truth status efektif + persentase (PRD §14.1, AGENTS BR-11).
// Rekap, dashboard, trend, by-division, export wajib lewat sini —
/// jangan hardcode ['PRESENT', ...] di tempat lain.
@Injectable()
export class AttendanceStatsService {
  constructor(private config: OrgConfigService) {}

  async effectiveList(): Promise<string[]> {
    return this.config.get<string[]>('effective_statuses');
  }

  async isEffective(status: string): Promise<boolean> {
    return (await this.effectiveList()).includes(status);
  }

  // Jumlah status efektif dari peta {STATUS: count}.
  async countEffective(by: Record<string, number>): Promise<number> {
    const list = await this.effectiveList();
    return list.reduce((s, k) => s + (by[k] ?? 0), 0);
  }

  pct(effective: number, counted: number): number | null {
    return percentage(effective, counted);
  }
}
