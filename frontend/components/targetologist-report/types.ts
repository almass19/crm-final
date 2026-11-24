import type { Bucket, Cohort, Period, Quality, Summary } from '@/lib/targetologist-report';

export interface PersonRow {
  id: string;
  name: string;
  active: number;
  inWork: number;
  renewal: number;
  paused: number;
  newCount: number;
  due: number;
  renewed: number;
  lost: number;
  retDue: number | null;
  complaints: number;
  slowReplies: number;
  overdue: number;
}

export interface ReportData {
  period: Period;
  months: string[];
  today: string;
  selected: string;
  buckets: Bucket[];
  summary: Summary;
  quality: Quality;
  people: PersonRow[];
  cohorts: Cohort[];
  cohortTotals: Omit<Cohort, 'ym' | 'label'>;
}

export const fmtPct = (n: number | null): string => (n === null || !Number.isFinite(n) ? '—' : `${Math.round(n * 100)}%`);

// Colours of the targetologist sheet: navy header, blue plan, green fact.
export const HEAD = 'bg-[#1f3864] text-white text-xs font-bold px-2 py-2 border border-slate-300 text-center';
export const PLAN_BG = 'bg-[#dde7f3]';
export const FACT_BG = 'bg-[#e2efda]';
export const GREY_BG = 'bg-slate-100';
export const CELL = 'border border-slate-300 px-2 py-1.5 tabular-nums';

/** Retention cell: red under the target, green at or above it. */
export function retentionBg(v: number | null, target: number): string {
  if (v === null || !Number.isFinite(v)) return '';
  return v >= target ? 'bg-[#c6efce]' : 'bg-[#ffc7ce]';
}
